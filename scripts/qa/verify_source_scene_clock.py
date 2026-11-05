"""Check real source-atlas playback against its 1.28s clock through ScenePlayer.

Run against Vite dev source modules. This checks timing and original/derived
pixel anchors; it does not establish physical display FPS or visual naturalness.
"""
import argparse,json
from pathlib import Path
from playwright.sync_api import sync_playwright
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url',default='http://127.0.0.1:5180/')
parser.add_argument('--output',type=Path,default=Path('artifacts/reference-scene/source-clock.json'))
args=parser.parse_args();base=args.url.rstrip('/')
result={'status':'failed','checks':[],'samples':[]}
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1200,'height':1000})
 errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
 page.route('**/__source-clock.html',lambda route:route.fulfill(content_type='text/html',body='<html><body></body></html>'))
 page.goto(base+'/__source-clock.html')
 state=page.evaluate('''async()=>{
  const{ScenePlayer}=await import('/src/features/referenceScene/ScenePlayer.ts');
  const{createSourceRenderer}=await import('/src/features/referenceScene/createSourceRenderer.ts');
  const{validateSourceTiming}=await import('/src/features/referenceScene/sourceTiming.ts');
  const canvas=document.createElement('canvas');document.body.append(canvas);
  const put=CanvasRenderingContext2D.prototype.drawImage;let paints=0;
  CanvasRenderingContext2D.prototype.drawImage=function(...args){if(this.canvas===canvas)paints++;return put.apply(this,args)};
  const reports=[],anchors={};let subject;
  for(const mode of ['original','smooth']){
   history.replaceState(null,'',location.pathname+(mode==='original'?'?motion=original':''));
   const prefix=mode==='original'?'source':'smooth';
   const manifest=await fetch('/assets/reference-scene/'+prefix+'-manifest.json').then(r=>r.json());
   const timing=validateSourceTiming(manifest);
   const definition={version:1,width:320,height:240,canonical:{src:'/assets/reference-scene/'+manifest.canonical,width:320,height:240},layers:{atlas:{src:'/assets/reference-scene/'+manifest.atlas,width:manifest.tileWidth*manifest.atlasColumns,height:manifest.tileHeight*manifest.atlasRows}},description:'source timing QA',motionSource:'source-timing'};
   const times=[...Array.from({length:16},(_,i)=>i*80),-1,1280,2560,12000,24000];
   anchors[mode]=[];
   for(const time of times){
    subject?.destroy();
    await new Promise((resolve,reject)=>{
     subject=new ScenePlayer(canvas,definition,createSourceRenderer,{timeMs:time,onState(s){if(s.playback==='static')resolve();if(s.playback==='failed')reject(Error('Source renderer failed'))}});
    });
    const index=Number(canvas.dataset.sourceFrame),wrapped=((time%1280)+1280)%1280;
    const expected=mode==='original'?Math.floor(wrapped/80):Math.floor(wrapped/10);
    reports.push({mode,timeMs:time,actual:index,expected,sourceDuration:Number(canvas.dataset.sourceDuration),playback:canvas.dataset.playback});
    if(time>=0&&time<1280){const pixels=canvas.getContext('2d').getImageData(0,0,320,240).data;let hash=2166136261;for(const value of pixels){hash^=value;hash=Math.imul(hash,16777619)}anchors[mode].push(hash>>>0)}
   }
   const before=paints;await new Promise(resolve=>setTimeout(resolve,100));reports.push({mode,inspectionPaints:paints-before});
  }
  subject?.destroy();return{reports,anchors};
 }''')
 result['samples']=state['reports']
 assert all(sample['actual']==sample['expected'] and sample['sourceDuration']==1280 and sample['playback']=='static' for sample in state['reports'] if 'actual' in sample)
 result['checks'].append('original_and_derived_clock_preserve_all_16_anchors_and_1280ms_loop')
 assert all(sample['inspectionPaints']==0 for sample in state['reports'] if 'inspectionPaints' in sample)
 result['checks'].append('explicit_source_seeks_do_not_schedule_continuous_painting')
 assert state['anchors']['original']==state['anchors']['smooth']
 result['checks'].append('all_16_derived_anchor_pixels_match_original_pixel_conversion')
 assert not errors,errors;result['checks'].append('no_browser_errors');result['status']='passed';browser.close()
args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'status':result['status'],'checks':result['checks'],'output':str(args.output)}))
