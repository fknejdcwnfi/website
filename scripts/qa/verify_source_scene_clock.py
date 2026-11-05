"""Check real source-atlas playback against its 1.28s clock through ScenePlayer.

Run against Vite dev source modules. This checks timing and original/derived
styled pixel anchors; it does not establish original RGB equality, physical display FPS or visual naturalness.
"""
import argparse,json
from pathlib import Path
from playwright.sync_api import sync_playwright
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url',default='http://127.0.0.1:5180/')
parser.add_argument('--output',type=Path,default=Path('artifacts/scenic-snow/source-clock.json'))
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
  const source=await fetch('/assets/reference-scene/pixel-source-manifest.json').then(r=>r.json());
  const sourceTiming=validateSourceTiming(source);
  const{referenceSceneDefinition}=await import('/src/features/referenceScene/definition.ts');
  const canvas=document.createElement('canvas');document.body.append(canvas);
  let paints=0;
  for(const method of ['drawImage','putImageData']){const original=CanvasRenderingContext2D.prototype[method];CanvasRenderingContext2D.prototype[method]=function(...args){if(this.canvas===canvas)paints++;return original.apply(this,args)}}
  const reports=[],anchors={},restored={};let subject;
  const reduce=bytes=>{const input=new Uint32Array(bytes.buffer,bytes.byteOffset,bytes.length/4),native=new Uint8ClampedArray(source.width*source.height*4),output=new Uint32Array(native.buffer),stride=source.width*2;for(let y=0;y<source.height;y++)for(let x=0;x<source.width;x++){const i=y*2*stride+x*2,v=[input[i],input[i+1],input[i+stride],input[i+stride+1]];let best=v[0],count=0;for(const candidate of v){const n=v.filter(value=>value===candidate).length;if(n>count){best=candidate;count=n}}output[y*source.width+x]=best}return native};
  const hash=bytes=>{let result=2166136261;for(const value of bytes)result=Math.imul(result^value,16777619);return result>>>0};
  for(const mode of ['original','smooth']){
   history.replaceState(null,'',location.pathname+(mode==='original'?'?motion=original':''));
   const prefix=mode==='original'?'source':'smooth';
   const manifest=await fetch('/assets/reference-scene/pixel-'+prefix+'-manifest.json').then(r=>r.json());
   const timing=validateSourceTiming(manifest);
   const definition=referenceSceneDefinition;
   const times=[...sourceTiming.startsMs,-1,timing.durationMs,2*timing.durationMs,12000,24000];
   anchors[mode]=[];restored[mode]=[];
   for(const time of times){
    subject?.destroy();
    await new Promise((resolve,reject)=>{
     subject=new ScenePlayer(canvas,definition,createSourceRenderer,{timeMs:time,onState(s){if(s.playback==='static')resolve();if(s.playback==='failed')reject(Error('Source renderer failed'))}});
    });
    const index=Number(canvas.dataset.sourceFrame),wrapped=((time%timing.durationMs)+timing.durationMs)%timing.durationMs;
    const expected=timing.startsMs.findLastIndex(start=>start<=wrapped);
    reports.push({mode,timeMs:time,actual:index,expected,sourceDuration:Number(canvas.dataset.sourceDuration),playback:canvas.dataset.playback});
    if(time>=0&&time<timing.durationMs){const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;anchors[mode].push(hash(pixels));restored[mode].push(hash(reduce(pixels)))}
   }
   const before=paints;await new Promise(resolve=>setTimeout(resolve,100));reports.push({mode,inspectionPaints:paints-before});
  }
  subject?.destroy();return{reports,anchors,restored,sourceChecksums:source.frameChecksums,canvasSize:[canvas.width,canvas.height],sourceDurationMs:sourceTiming.durationMs,sourceAnchorCount:sourceTiming.frameCount};
 }''')
 result['samples']=state['reports']
 assert all(sample['actual']==sample['expected'] and sample['sourceDuration']==state['sourceDurationMs'] and sample['playback']=='static' for sample in state['reports'] if 'actual' in sample)
 result['checks'].append('original_and_derived_clock_preserve_all_16_anchors_and_1280ms_loop')
 assert all(sample['inspectionPaints']==0 for sample in state['reports'] if 'inspectionPaints' in sample)
 result['checks'].append('explicit_source_seeks_do_not_schedule_continuous_painting')
 assert state['anchors']['original']==state['anchors']['smooth']
 result['checks'].append('all_16_derived_hd_anchors_match_styled_anchor_mode')
 assert state['restored']['original']==state['sourceChecksums'] and state['restored']['smooth']==state['sourceChecksums'],state['restored']
 result['checks'].append('all_hd_anchors_restore_exact_native_styled_pixels_by_2x2_majority')
 result['scope']='Styled source-timed atlas and HD reconstruction; does not compare restyled RGB with the original GIF'
 result['canvasSize']=state['canvasSize']
 assert not errors,errors;result['checks'].append('no_browser_errors');result['status']='passed';browser.close()
args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'status':result['status'],'checks':result['checks'],'output':str(args.output)}))
