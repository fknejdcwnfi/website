#!/usr/bin/env python3
"""Measure the real production scene at native browser cadence without screenshots."""
import argparse,json,statistics
from pathlib import Path
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--url',default='http://127.0.0.1:4173/website/');p.add_argument('--output',type=Path,default=Path('artifacts/reference-scene/performance.json'));args=p.parse_args()
with sync_playwright()as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);q=b.new_page(viewport={'width':1440,'height':1100});errors=[];http=[];workers=[];q.on('pageerror',lambda e:errors.append(str(e)));q.on('response',lambda r:http.append({'url':r.url,'status':r.status})if r.status>=400 else None);q.on('worker',lambda w:workers.append(w.url))
 q.add_init_script('''window.__sceneMeasure={active:false,cost:[],paints:0,long:[]};const nativeRAF=requestAnimationFrame;window.requestAnimationFrame=cb=>nativeRAF(t=>{const start=performance.now();cb(t);if(__sceneMeasure.active)__sceneMeasure.cost.push(performance.now()-start)});const draw=CanvasRenderingContext2D.prototype.drawImage;CanvasRenderingContext2D.prototype.drawImage=function(...args){if(__sceneMeasure.active&&this.canvas.dataset.scene)__sceneMeasure.paints++;return draw.apply(this,args)};new PerformanceObserver(list=>{if(__sceneMeasure.active)for(const e of list.getEntries())__sceneMeasure.long.push(e.duration)}).observe({type:'longtask',buffered:false})''')
 q.goto(args.url);q.wait_for_selector('canvas[data-ready=true][data-playback=looping]');ready=q.evaluate('performance.now()');q.wait_for_timeout(2500)
 result=q.evaluate('''async()=>{const m=window.__sceneMeasure;m.active=true;const start=performance.now();await new Promise(r=>setTimeout(r,12800));m.active=false;return{...m,seconds:(performance.now()-start)/1000}}''');b.close()
a=sorted(result['cost']);quant=lambda p:a[min(len(a)-1,int((len(a)-1)*p))]
report={'conditions':'Fresh single production Chromium page;1440x1100;DPR1;native rAF;no CPU/network throttling;2.5s settle;12.8s sample (10 source loops);no screenshots or concurrent browsers','physicalDisplayVerified':False,'readyMsLocal':round(ready,2),'paints':result['paints'],'seconds':round(result['seconds'],3),'paintsPerSecond':round(result['paints']/result['seconds'],2),'callbackMs':{'median':round(statistics.median(a),3),'p95':round(quant(.95),3),'max':round(max(a),3)},'longTasksMs':result['long'],'workers':workers,'browserErrors':errors,'httpErrors':http}
assert not errors and not http,report
args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
