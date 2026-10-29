"""Compare reachable raster candidates against the original full field at all reviewed grids."""
import argparse
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url',default='http://127.0.0.1:5173/')
parser.add_argument('--output',type=Path,default=Path('artifacts/reference-rebuild/raster-cache.json'))
args=parser.parse_args()
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page()
    page.goto(args.url.rstrip('/')+'/?view=portrait&pose=1')
    page.wait_for_selector('canvas[data-ready=true]')
    result=page.evaluate(r'''async()=>{
      const {PortraitRig}=await import('/src/features/portrait/renderer/portraitRig.ts');
      const {loadImage}=await import('/src/features/portrait/renderer/portraitAsset.ts');
      const {createMotionTable}=await import('/src/features/portrait/animation/portraitTimeline.ts');
      const cases=[
        {label:'default',direction:1,gust:.35,stiffness:18,damping:5,gain:1},
        {label:'reversed-strong-gust',direction:-1,gust:2,stiffness:18,damping:5,gain:1},
        {label:'soft-least-damped',direction:1,gust:2,stiffness:5,damping:1,gain:1},
        {label:'stiff-most-damped',direction:1,gust:.1,stiffness:40,damping:12,gain:1},
        {label:'partial-wind',direction:1,gust:.35,stiffness:18,damping:5,gain:.35},
        {label:'zero-direction',direction:0,gust:2,stiffness:5,damping:1,gain:1},
      ];
      const times=[0,17.5,500,1200,2400,4400,6000,8400,11300,11999.5];
      const results=[];
      const count=(spans)=>spans.reduce((sum,list)=>{
        for(let index=0;index<list.length;index+=3)sum+=list[index+2]-list[index+1]+1;
        return sum;
      },0);
      for(const size of [192,256,320]){
        const suffix=size===256?'':`-${size}`;
        const [open,closed,underpaint]=await Promise.all(['base','eyelids','underpaint'].map(name=>loadImage(`/assets/portrait-natural/${name}${suffix}.png`)));
        const rig=new PortraitRig(open,closed,size,underpaint);
        const full=rig.layers.map(layer=>layer.spans);
        const canvas=document.createElement('canvas');canvas.width=canvas.height=size;
        const ctx=canvas.getContext('2d',{willReadFrequently:true});
        for(const config of cases){
          const table=createMotionTable(config);let mismatch=0;let optimizedCount=0;const differences=[];
          for(const time of times){
            rig.paint(ctx,table,time,config.gain,1);
            const optimized=new Uint32Array(ctx.getImageData(0,0,size,size).data.buffer);
            const cached=rig.layers.map(layer=>layer.spans);optimizedCount=count(cached);
            rig.layers.forEach((layer,index)=>layer.spans=full[index]);
            rig.paint(ctx,table,time,config.gain,1);
            const original=new Uint32Array(ctx.getImageData(0,0,size,size).data.buffer);
            let changed=0;for(let i=0;i<original.length;i++)if(original[i]!==optimized[i])changed++;
            differences.push({time,mismatched_pixels:changed});mismatch+=changed;
            rig.layers.forEach((layer,index)=>layer.spans=cached[index]);
          }
          results.push({size,case:config.label,phases:times.length,mismatched_pixels:mismatch,full_candidates:count(full),cached_candidates:optimizedCount,candidate_reduction:1-optimizedCount/count(full),differences});
        }
      }
      return {status:results.every(result=>result.mismatched_pixels===0)?'passed':'failed',comparisons:results.length*times.length,results};
    }''')
    browser.close()
path=args.output;path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({key:value for key,value in result.items() if key!='results'}))
for case in result['results']:
    print({key:value for key,value in case.items() if key!='differences'})
raise SystemExit(0 if result['status']=='passed' else 1)
