#!/usr/bin/env python3
"""Measure portrait and weather separately at native production-browser cadence.

Both rAF callbacks may share one display timestamp. Aggregate their CPU work per
unique timestamp; their sum is not twice the display FPS. No screenshots run here.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path
import statistics
from urllib.parse import urljoin
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url', default='http://127.0.0.1:4173/website/')
parser.add_argument('--output', type=Path, default=Path('artifacts/scenic-snow/performance.json'))
parser.add_argument('--loops', type=int, default=10)
args = parser.parse_args()
if not 1 <= args.loops <= 40:
    parser.error('Use 1–40 complete source loops.')

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1440, 'height': 1100}, device_scale_factor=1)
    errors, http_errors, workers = [], [], []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('response', lambda response: http_errors.append({'url': response.url, 'status': response.status}) if response.status >= 400 else None)
    page.on('worker', lambda worker: workers.append(worker.url))
    page.add_init_script('''
        window.__sceneMeasure={active:false,frames:new Map(),callbacks:[],sourceFrames:[],long:[],current:null};
        const nativeRAF=requestAnimationFrame;
        window.requestAnimationFrame=callback=>nativeRAF.call(window,timestamp=>{
            const measure=window.__sceneMeasure;
            if(!measure.active){callback(timestamp);return}
            const start=performance.now(),entry={portrait:false,weather:false,timestamp};
            measure.current=entry;
            try {callback(timestamp)} finally {
                const cost=performance.now()-start;
                let frame=measure.frames.get(timestamp);
                if(!frame){frame={timestamp,cost:0,callbacks:0,portrait:false,weather:false};measure.frames.set(timestamp,frame)}
                frame.cost+=cost;frame.callbacks++;frame.portrait ||= entry.portrait;frame.weather ||= entry.weather;
                measure.callbacks.push({cost,portrait:entry.portrait,weather:entry.weather});
                if(entry.portrait)measure.sourceFrames.push(document.querySelector('.reference-scene__canvas').dataset.sourceFrame);
                measure.current=null;
            }
        });
        for(const method of ['putImageData','drawImage','clearRect']){
            const original=CanvasRenderingContext2D.prototype[method];
            CanvasRenderingContext2D.prototype[method]=function(...args){
                const measure=window.__sceneMeasure,entry=measure.active&&measure.current;
                if(entry){
                    if((method==='putImageData'||method==='drawImage')&&this.canvas.classList.contains('reference-scene__canvas'))entry.portrait=true;
                    if(method==='clearRect'&&this.canvas.dataset.weather==='snow')entry.weather=true;
                }
                return original.apply(this,args);
            };
        }
        new PerformanceObserver(list=>{if(__sceneMeasure.active)for(const entry of list.getEntries())__sceneMeasure.long.push(entry.duration)}).observe({type:'longtask',buffered:false});
    ''')
    page.goto(args.url)
    page.wait_for_selector('.reference-scene__canvas[data-ready=true][data-playback=looping]')
    page.wait_for_selector('.reference-scene[data-upgraded=true]')
    page.wait_for_function("document.querySelector('.reference-scene__boot-host').hidden&&document.querySelector('.reference-scene__scenery').complete")
    ready_ms = page.evaluate('performance.now()')
    manifest = page.evaluate('async url=>(await fetch(url)).json()', urljoin(args.url, 'assets/reference-scene/pixel-smooth-manifest.json'))
    presentation = page.locator('.reference-scene__stage').evaluate('''element=>{
        const stage=element.getBoundingClientRect(),circle=element.querySelector('.reference-scene__viewport'),rect=circle.getBoundingClientRect(),style=getComputedStyle(circle),canvas=element.querySelector('.reference-scene__canvas'),snow=element.querySelector('.reference-scene__snow'),image=element.querySelector('.reference-scene__scenery');
        return{stage:[stage.width,stage.height],cssWidth:rect.width,cssHeight:rect.height,canvasWidth:canvas.width,canvasHeight:canvas.height,snowCanvas:[snow.width,snow.height],scenery:[image.naturalWidth,image.naturalHeight],radius:style.borderRadius,border:style.borderTopWidth,shadow:style.boxShadow,dpr:devicePixelRatio,bootstrapReleased:!window.__vermouthBootVideo?.getAttribute('src')};
    }''')
    page.wait_for_timeout(2500)
    sample_ms = manifest['durationMs'] * args.loops
    result = page.evaluate('''async milliseconds=>{
        const measurement=window.__sceneMeasure;measurement.active=true;
        const start=performance.now();await new Promise(resolve=>setTimeout(resolve,milliseconds));
        measurement.active=false;return{frames:[...measurement.frames.values()],callbacks:measurement.callbacks,sourceFrames:measurement.sourceFrames,long:measurement.long,seconds:(performance.now()-start)/1000};
    }''', sample_ms)
    browser.close()

frames = result['frames']; seconds = result['seconds']
assert frames, 'No native rAF timestamps were measured'
portrait = [frame for frame in frames if frame['portrait']]
weather = [frame for frame in frames if frame['weather']]
assert portrait and weather, 'Both the HD portrait and independent weather must paint'
def cost_report(values):
    if not values: return None
    ordered = sorted(values)
    quantile = lambda proportion: ordered[min(len(ordered)-1,int((len(ordered)-1)*proportion))]
    return {'median':round(statistics.median(ordered),3),'p95':round(quantile(.95),3),'max':round(max(ordered),3)}
timestamps = sorted(frame['timestamp'] for frame in frames)
intervals = [after-before for before,after in zip(timestamps,timestamps[1:]) if after>before]
report = {
    'conditions':f'Fresh single production Chromium page; 1440x1100; DPR1; native rAF; no CPU/network throttling; HD upgrade and scenery ready; 2.5s settle; {sample_ms/1000:g}s sample ({args.loops} source loops); no screenshots or concurrent browsers',
    'physicalDisplayVerified':False,'readyMsLocal':round(ready_ms,2),'presentation':presentation,
    'sourceDurationMs':manifest['durationMs'],'estimatedSampleCount':manifest['frameCount'],'estimatedSampleRate':round(manifest['frameCount']*1000/manifest['durationMs'],3),
    'paints':len(portrait),'seconds':round(seconds,3),'paintsPerSecond':round(len(portrait)/seconds,2),
    'weatherPaints':len(weather),'weatherPaintsPerSecond':round(len(weather)/seconds,2),
    'uniqueRafTimestamps':len(frames),'rafTimestampsPerSecond':round(len(frames)/seconds,2),'callbacks':len(result['callbacks']),
    'uniqueSourceSamplesPainted':len(set(result['sourceFrames'])),
    'combinedFrameWorkMs':cost_report([frame['cost'] for frame in frames]),
    'portraitCallbackMs':cost_report([entry['cost'] for entry in result['callbacks'] if entry['portrait']]),
    'weatherCallbackMs':cost_report([entry['cost'] for entry in result['callbacks'] if entry['weather']]),
    'rafIntervalMs':cost_report(intervals),'longTasksMs':result['long'],'workers':workers,'browserErrors':errors,'httpErrors':http_errors,
    'interpretation':'Portrait and weather each have an rAF loop. CPU is summed per unique browser timestamp; two callbacks are not two display frames. Native headless cadence is not verified physical monitor FPS. New artwork and estimated source-motion samples do not recover information absent from the reference.'
}
assert not errors and not http_errors, report
args.output.parent.mkdir(parents=True,exist_ok=True)
args.output.write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report))
