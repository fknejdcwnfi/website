#!/usr/bin/env python3
"""Observe exact original-frame playback, circular presentation and failure recovery.

Rendered Canvas pixels are compared with the published atlas at every source
frame and around the loop boundary. This does not certify subjective pixel art
or manufacture a higher source frame rate.
"""
from __future__ import annotations
import argparse
import base64
import io
import json
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
SELECTOR = '.reference-scene__canvas'
FORBIDDEN = ('/calm-circle/', '/pixel-source-atlas.png', '/pixel-smooth-atlas.png',
             '/smooth-atlas.png', '/source-atlas.png', '/motion-fields/', '.npz',
             '/boot.mp4', '/scenery.webp')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', default='http://127.0.0.1:5180/website/')
    parser.add_argument('--contract', type=Path, default=ROOT/'public/assets/faithful-pixel/manifest.json')
    parser.add_argument('--output', type=Path, default=ROOT/'artifacts/faithful-pixel/site')
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    (args.output/'circle-frames').mkdir(exist_ok=True)
    manifest = json.loads(args.contract.read_text())
    descriptor = manifest.get('runtime', manifest)
    atlas_name = descriptor.get('atlas', 'atlas.png')
    atlas = Image.open(args.contract.parent/atlas_name).convert('RGBA')
    width = descriptor.get('tileWidth', 358)
    height = descriptor.get('tileHeight', 267)
    columns = descriptor.get('atlasColumns', 4)
    count = descriptor.get('frameCount', 16)
    durations = descriptor.get('frameDurationsMs', [80]*count)
    period = descriptor.get('durationMs', sum(durations))
    canonical_name = descriptor.get('canonical', 'canonical.png')
    canonical = Image.open(args.contract.parent/canonical_name).convert('RGBA')
    if canonical.size == (width, height):
        canonical = canonical.resize((716,534), Image.Resampling.NEAREST)
    report = {'status':'failed','url':args.url,'checks':[],'sourceSamples':[],
              'browserErrors':[],'presentations':{},'sourceFrameCount':count,
              'sourceFrameDurationsMs':durations,'durationMs':period,
              'scope':'Exact published source-frame pixel playback and lifecycle; not subjective art quality or physical monitor FPS'}

    def save():
        (args.output/'checks.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')

    def check(name, passed=True, detail=None):
        report['checks'].append({'name':name,'passed':bool(passed),'detail':detail})
        if not passed:
            save()
            raise AssertionError((name,detail))

    def at_time(value):
        parts = urlsplit(args.url)
        query = dict(parse_qsl(parts.query,keep_blank_values=True))
        query['t'] = str(value)
        return urlunsplit((parts.scheme,parts.netloc,parts.path,urlencode(query),parts.fragment))

    def pixels(page):
        value = page.locator(SELECTOR).evaluate("canvas=>canvas.toDataURL('image/png').split(',')[1]")
        return Image.open(io.BytesIO(base64.b64decode(value))).convert('RGBA')

    def expected(index):
        x,y = index%columns*width,index//columns*height
        tile = atlas.crop((x,y,x+width,y+height))
        return tile.resize((716,534),Image.Resampling.NEAREST)

    def inspect_presentation(page, label):
        data = page.locator('.reference-scene__viewport').evaluate('''element=>{
            const box=element.getBoundingClientRect(),style=getComputedStyle(element),
                canvas=element.querySelector('canvas'),art=getComputedStyle(canvas);
            return {width:box.width,height:box.height,x:box.x,radius:style.borderRadius,
                border:style.borderTopWidth,shadow:style.boxShadow,canvas:[canvas.width,canvas.height],
                smoothing:canvas.getContext('2d').imageSmoothingEnabled,imageRendering:art.imageRendering,
                filter:art.filter,transform:art.transform,overflow:document.documentElement.scrollWidth>innerWidth};
        }''')
        report['presentations'][label] = data
        check(label+'_borderless_circle',abs(data['width']-data['height'])<.01 and
              data['radius']=='50%' and data['border']=='0px' and data['shadow']=='none',data)
        check(label+'_crisp_hd_output',data['canvas']==[716,534] and data['smoothing'] is False and
              data['imageRendering'] in ('pixelated','crisp-edges') and data['filter']=='none' and data['transform']=='none',data)
        check(label+'_fits_screen',not data['overflow'] and data['width']<=534.01 and data['x']>=-.5 and
              data['x']+data['width']<=page.viewport_size['width']+.5,data)

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
        context = browser.new_context(viewport={'width':1440,'height':1100},device_scale_factor=1)
        context.add_init_script('''
            window.__qaForceCanvasFailure=false;window.__qaRafs=0;window.__qaWorkers=0;
            const raf=requestAnimationFrame;window.requestAnimationFrame=callback=>raf.call(window,time=>{window.__qaRafs++;callback(time)});
            const Constructor=Worker;window.Worker=class extends Constructor{constructor(...args){super(...args);window.__qaWorkers++}};
            const draw=CanvasRenderingContext2D.prototype.drawImage;
            CanvasRenderingContext2D.prototype.drawImage=function(...args){
                if(this.canvas.classList.contains('reference-scene__canvas')&&window.__qaForceCanvasFailure)throw Error('QA simulated paint failure');
                return draw.apply(this,args);
            };
        ''')
        page = context.new_page();requests=[]
        page.on('request',lambda request:requests.append(request.url))
        page.on('pageerror',lambda error:report['browserErrors'].append(str(error)))
        response = page.goto(args.url)
        check('production_document_loads',response is not None and response.status==200)
        page.wait_for_selector(SELECTOR+'[data-ready=true][data-playback=looping]')
        check('complete_personal_site_remains',all(page.locator(selector).count() for selector in
              ('#about','#work','#contact','footer','a[href="mailto:fknejdcwnfi@gmail.com"]')))
        check('no_outer_background_weather_or_video',page.locator('.reference-scene__scenery,.reference-scene__snow,video').count()==0)
        check('no_normal_motion_controls',page.locator('.reference-scene button').count()==0)
        check('direct_frame_playback_is_selected',page.locator(SELECTOR).get_attribute('data-motion-kind')=='direct-source-frames')
        check('no_worker_dependency',page.evaluate('window.__qaWorkers')==0)
        inspect_presentation(page,'desktop')
        # Observe actual RGB, rather than trusting a data-attribute or rAF count.
        page.wait_for_function('''()=>{
            const canvas=document.querySelector('.reference-scene__canvas');
            const values=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
            let hash=2166136261;for(const value of values)hash=Math.imul(hash^value,16777619);
            if(window.__qaFirstHash===undefined){window.__qaFirstHash=hash;window.__qaFirstAt=performance.now();return false;}
            if(hash===window.__qaFirstHash)return false;
            window.__qaChangedAt=performance.now()-window.__qaFirstAt;return true;
        }''',polling=20,timeout=1000)
        check('visible_pixels_change_without_waiting',page.evaluate('window.__qaChangedAt')<250,
              {'observedChangeAfterMs':page.evaluate('window.__qaChangedAt'),'sourceFrameDurationMs':80})
        page.screenshot(path=str(args.output/'desktop.png'),full_page=True)
        page.locator('.reference-scene__viewport').screenshot(path=str(args.output/'circle.png'))

        # Every original anchor plus negative and seam samples: exact pixel identity
        # is stronger evidence than a whole-image changed-pixel threshold.
        times = [index*80 for index in range(16)]+[79.999,80.001,1279.999,1280,1280.001,-1]
        for timestamp in times:
            index = int((timestamp%period)//80)
            page.goto(at_time(timestamp));page.wait_for_selector(SELECTOR+'[data-ready=true][data-playback=static]')
            rendered = pixels(page)
            frame = expected(index)
            actual_bytes,expected_bytes=rendered.tobytes(),frame.tobytes()
            different=(0 if actual_bytes==expected_bytes else sum(actual_bytes[offset:offset+4]!=expected_bytes[offset:offset+4]
                       for offset in range(0,len(actual_bytes),4))) if rendered.size==frame.size else -1
            metadata = page.locator(SELECTOR).evaluate('canvas=>({...canvas.dataset})')
            check(f'source_time_{timestamp}_exact_atlas_pixels',rendered.size==frame.size and different==0,
                  {'expectedFrame':index,'differentPixels':different,'metadata':metadata})
            check(f'source_time_{timestamp}_correct_frame_index',metadata.get('sourceFrame')==str(index) and metadata.get('sourceDuration')==str(period),metadata)
            report['sourceSamples'].append({'timeMs':timestamp,'frame':index,'differentPixels':different})
            if timestamp in (0,320,640,960,1200):rendered.save(args.output/f'frame_{index:02}.png')
            if timestamp in range(0,1280,80):
                page.locator('.reference-scene__viewport').screenshot(path=str(args.output/'circle-frames'/f'frame_{index:02}.png'))

        reduced = browser.new_context(viewport={'width':1200,'height':1000},reduced_motion='reduce')
        r = reduced.new_page();reduced_requests=[]
        r.on('request',lambda request:reduced_requests.append(request.url))
        r.goto(args.url);r.wait_for_selector(SELECTOR+'[data-playback=static]')
        check('reduced_motion_exact_canonical',pixels(r).tobytes()==canonical.tobytes())
        before=pixels(r).tobytes();r.wait_for_timeout(200)
        check('reduced_motion_pixels_remain_still',pixels(r).tobytes()==before)
        check('reduced_motion_skips_atlas',not any(atlas_name in url for url in reduced_requests),reduced_requests)
        r.get_by_role('button',name='開啟動態',exact=True).click();r.wait_for_selector(SELECTOR+'[data-playback=looping]')
        check('local_motion_opt_in_works',r.get_by_role('button',name='跟隨系統',exact=True).is_visible())
        r.reload();r.wait_for_selector(SELECTOR+'[data-playback=looping]')
        check('motion_choice_survives_reload',r.get_by_role('button',name='跟隨系統',exact=True).is_visible())
        r.get_by_role('button',name='跟隨系統',exact=True).click();r.wait_for_selector(SELECTOR+'[data-playback=static]')
        check('system_preference_restores_canonical',pixels(r).tobytes()==canonical.tobytes());reduced.close()

        page.goto(args.url);page.wait_for_selector(SELECTOR+'[data-playback=looping]')
        page.evaluate('scrollTo(0,document.documentElement.scrollHeight)')
        page.wait_for_selector(SELECTOR+'[data-playback=suspended]')
        before=pixels(page).tobytes();page.wait_for_timeout(200)
        check('offscreen_suspends_paints',pixels(page).tobytes()==before)
        page.evaluate('scrollTo(0,0)');page.wait_for_selector(SELECTOR+'[data-playback=looping]')
        check('onscreen_resumes_motion')
        page.evaluate("window.__qaHidden=true;Object.defineProperty(document,'hidden',{configurable:true,get:()=>window.__qaHidden});document.dispatchEvent(new Event('visibilitychange'))")
        page.wait_for_selector(SELECTOR+'[data-playback=suspended]')
        before=pixels(page).tobytes();page.wait_for_timeout(200)
        check('hidden_document_suspends_paints',pixels(page).tobytes()==before)
        page.evaluate("window.__qaHidden=false;document.dispatchEvent(new Event('visibilitychange'))")
        page.wait_for_selector(SELECTOR+'[data-playback=looping]');check('visible_document_resumes_motion')
        page.evaluate('window.__qaForceCanvasFailure=true')
        page.wait_for_selector('.reference-scene[data-playback=failed]')
        check('paint_failure_retains_poster_and_content',page.locator('.reference-scene__poster').is_visible() and page.locator('#contact').count()>0)
        page.evaluate('window.__qaForceCanvasFailure=false')
        page.get_by_role('button',name='重試載入',exact=True).click();page.wait_for_selector(SELECTOR+'[data-playback=looping]')
        check('retry_recovers_direct_frame_renderer',page.locator('.reference-scene__poster').count()==0)
        check('no_rejected_animation_assets_requested',not any(part in url for part in FORBIDDEN for url in requests),requests)

        # A real atlas HTTP failure must keep the canonical visible and recover
        # through the normal retry path when the resource becomes available.
        unavailable=browser.new_context(viewport={'width':1200,'height':1000})
        f=unavailable.new_page()
        f.route('**/assets/faithful-pixel/'+atlas_name+'*',lambda route:route.fulfill(status=503,body='QA unavailable',headers={'cache-control':'no-store'}))
        f.goto(args.url);f.wait_for_selector('.reference-scene[data-playback=failed]')
        check('atlas_http_failure_preserves_canonical_and_site',f.locator('.reference-scene__poster').is_visible() and
              f.locator('#contact').count()>0 and f.get_by_role('button',name='重試載入',exact=True).is_visible())
        f.unroute('**/assets/faithful-pixel/'+atlas_name+'*')
        f.get_by_role('button',name='重試載入',exact=True).click();f.wait_for_selector(SELECTOR+'[data-playback=looping]')
        check('atlas_retry_recovers_original_motion',f.locator(SELECTOR).get_attribute('data-motion-kind')=='direct-source-frames')
        unavailable.close()

        for mobile_width,dpr in ((320,1),(390,2),(768,1.5)):
            mobile = browser.new_context(viewport={'width':mobile_width,'height':900},device_scale_factor=dpr)
            m=mobile.new_page();m.goto(args.url);m.wait_for_selector(SELECTOR+'[data-playback=looping]')
            inspect_presentation(m,f'width{mobile_width}_dpr{dpr}')
            if mobile_width==390:m.screenshot(path=str(args.output/'mobile.png'),full_page=True)
            mobile.close()

        nojs=browser.new_context(viewport={'width':1200,'height':1000},java_script_enabled=False)
        n=nojs.new_page();n.goto(args.url);poster=n.locator('.reference-scene-static img');poster.wait_for(state='visible')
        check('nojs_has_exact_hd_poster',poster.count()==1 and poster.evaluate('image=>image.complete&&image.naturalWidth===716&&image.naturalHeight===534') and
              '/assets/faithful-pixel/' in poster.get_attribute('src'))
        style=n.locator('.reference-scene-static .reference-scene__viewport').evaluate('element=>{const b=element.getBoundingClientRect(),s=getComputedStyle(element);return{width:b.width,height:b.height,radius:s.borderRadius,border:s.borderTopWidth,shadow:s.boxShadow}}')
        check('nojs_retains_borderless_circle',abs(style['width']-style['height'])<.01 and style['radius']=='50%' and style['border']=='0px' and style['shadow']=='none',style)
        check('nojs_retains_content',all(n.locator(selector).count() for selector in ('#about','#work','#contact','footer')))
        n.screenshot(path=str(args.output/'no-javascript.png'),full_page=True);nojs.close()
        context.close();browser.close()
    check('no_uncaught_browser_errors',not report['browserErrors'],report['browserErrors'])
    report['requests']=requests;report['status']='passed';save()
    print(json.dumps({'status':'passed','checks':len(report['checks']),'sourceSamples':len(report['sourceSamples']),'output':str(args.output)}))


if __name__=='__main__':
    main()
