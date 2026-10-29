"""Measure one production portrait page after settling; outputs artifacts/performance.json."""
import argparse
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url',default='http://127.0.0.1:4173/website/')
parser.add_argument('--output',default='artifacts/performance.json')
args=parser.parse_args()
URL=args.url.rstrip('/')+'/'
import json,statistics
from pathlib import Path
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1200,'height':1000},device_scale_factor=1)
 errors=[];responses=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('response',lambda r:responses.append({'url':r.url,'status':r.status}))
 page.add_init_script('''window.__measure=false;window.__dur=[];window.__paints=[];const r=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>r(ts=>{const start=performance.now();try{cb(ts)}finally{if(window.__measure)window.__dur.push(performance.now()-start)}});const put=CanvasRenderingContext2D.prototype.putImageData;CanvasRenderingContext2D.prototype.putImageData=function(...args){if(window.__measure)window.__paints.push(performance.now());return put.apply(this,args)};''')
 page.goto(URL)
 page.wait_for_selector('canvas[data-ready=true]')
 page.wait_for_timeout(1500)
 data=page.evaluate('''async()=>{window.__long=[];const obs=new PerformanceObserver(xs=>xs.getEntries().forEach(e=>window.__long.push({start:e.startTime,duration:e.duration})));obs.observe({type:'longtask'});window.__dur=[];window.__paints=[];const start=performance.now();window.__measure=true;await new Promise(r=>setTimeout(r,5000));window.__measure=false;const end=performance.now();obs.disconnect();return{start,end,durations:window.__dur,paints:window.__paints,longtasks:window.__long.filter(x=>x.start>=start)}}''')
 elapsed=(data['end']-data['start'])/1000
 values=sorted(data['durations'])
 result={'url':URL,'conditions':'fresh single-page headless Chromium,1200x1000,DPR1,no throttle,1.5s settle,no screenshot during sample','sample_seconds':round(elapsed,3),'paints':len(data['paints']),'fps':round(len(data['paints'])/elapsed,2),'callback_cpu_median_ms':round(statistics.median(values),3),'callback_cpu_p95_ms':round(values[int(len(values)*.95)],3),'long_tasks':data['longtasks'],'runtime_images':[r['url'] for r in responses if '/assets/portrait-natural/' in r['url']],'browser_errors':errors,'http_errors':[r for r in responses if r['status']>=400]}
 # production route/metadata/image check occurs AFTER the timed sample.
 for path in ['og-portrait.png','portrait-rest.png','assets/portrait-natural/base.png','assets/portrait-natural/eyelids.png']:
  response=page.request.get(URL+path)
  assert response.status==200,(path,response.status)
 result['metadata_and_asset_http200']=True
 assert not errors and not result['http_errors']
 output=Path(args.output);output.parent.mkdir(parents=True,exist_ok=True)
 output.write_text(json.dumps(result,indent=2)+'\n')
 print(json.dumps(result))
 b.close()
