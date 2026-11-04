#!/usr/bin/env python3
"""Measure cold portrait preparation separately from steady-state render throughput."""
import argparse,json
from pathlib import Path
from playwright.sync_api import sync_playwright
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url',default='http://127.0.0.1:4173/website/')
parser.add_argument('--output',type=Path,default=Path('artifacts/video-layered/startup.json'))
args=parser.parse_args();runs=[]
INIT=r'''window.__startup={workers:0,ticks:[],longtasks:[]};
const NativeWorker=Worker;window.Worker=class extends NativeWorker{constructor(...args){super(...args);window.__startup.workers++}};
new PerformanceObserver(list=>window.__startup.longtasks.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration})))).observe({type:'longtask',buffered:true});
window.__startup.timer=setInterval(()=>window.__startup.ticks.push(performance.now()),16);'''
with sync_playwright() as p:
 for reduced in [False,True]:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  page=browser.new_page(viewport={'width':1200,'height':1000},device_scale_factor=1,reduced_motion='reduce' if reduced else 'no-preference')
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.add_init_script(INIT);page.goto(args.url,wait_until='domcontentloaded')
  page.wait_for_selector('canvas[data-ready=true][data-painted=true]',timeout=30000)
  data=page.evaluate('''()=>{
   clearInterval(window.__startup.timer);const data=window.__startup,canvas=document.querySelector('canvas');
   const intervals=data.ticks.slice(1).map((t,i)=>t-data.ticks[i]).sort((a,b)=>a-b);
   return {ready_ms:performance.now(),workers:data.workers,timer_callbacks:data.ticks.length,
    timer_interval_p95_ms:intervals.length?intervals[Math.ceil(intervals.length*.95)-1]:null,
    timer_interval_max_ms:intervals.length?intervals[intervals.length-1]:null,long_tasks:data.longtasks,
    renderer:canvas.dataset.renderer,playback:canvas.dataset.playback};
  }''')
  data.update({'mode':'reduced_motion' if reduced else 'animated','errors':errors});runs.append(data);browser.close()
result={'conditions':'fresh single-page production Chromium;1200x1000;DPR1;no CPU throttle;no screenshots;startup timer probes responsiveness, not FPS','runs':runs}
args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result))
