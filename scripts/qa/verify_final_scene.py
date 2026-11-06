#!/usr/bin/env python3
"""Observe final circular portrait pixels, visible petals and zero-media entry motion.

The source comparison disables atmosphere explicitly. Weather checks use the
displayed circular crop, rather than accepting off-screen particle metadata.
Entry motion is checked with both the application module and video blocked.
"""
from __future__ import annotations

import argparse
import base64
from functools import lru_cache
import io
import json
from pathlib import Path
import sys
from urllib.parse import urlencode

import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT/'scripts/assets'))
from verify_poetic_pixel_scene import scale2x_rgb

CANVAS = '.reference-scene__canvas'
ENTRY = '#vermouth-poetic-entry'
VIEWPORT = '.reference-scene__viewport'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', default='http://127.0.0.1:5180/website/')
    parser.add_argument('--output', type=Path, default=ROOT/'artifacts/final-scene/site')
    parser.add_argument('--only-entry', action='store_true', help='Run an explicitly partial startup diagnostic')
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    atlas = Image.open(ROOT/'public/assets/poetic-pixel/atlas.png').convert('RGB')
    canonical = Image.open(ROOT/'public/assets/poetic-pixel/canonical.png').convert('RGBA')
    report = {'status':'failed', 'scope':'entry-only' if args.only_entry else 'complete',
              'checks':[], 'browserErrors':[], 'sourceSamples':[], 'weatherSamples':[],
              'presentation':[], 'sourceFrames':16, 'estimatedInterframes':48,
              'playbackFps':50, 'snowParticles':384, 'petalParticles':48}

    def save():
        (args.output/'checks.json').write_text(json.dumps(report, indent=2)+'\n')

    def check(name, passed=True, detail=None):
        report['checks'].append({'name':name, 'passed':bool(passed), 'detail':detail})
        if not passed:
            save()
            raise AssertionError((name, detail))

    def url(**params):
        return args.url.split('?')[0]+('?' + urlencode(params) if params else '')

    def pixels(page):
        value = page.locator(CANVAS).evaluate("c=>c.toDataURL('image/png').split(',')[1]")
        return Image.open(io.BytesIO(base64.b64decode(value))).convert('RGBA')

    def screenshot_circle(page):
        return Image.open(io.BytesIO(page.locator(VIEWPORT).screenshot(animations='allow'))).convert('RGB')

    @lru_cache(maxsize=24)
    def refined(index):
        x,y = index%8*358,index//8*267
        tile = atlas.crop((x,y,x+358,y+267))
        first = scale2x_rgb(tile.tobytes(),358,267)
        second = scale2x_rgb(first,716,534)
        return Image.frombytes('RGB',(1432,1068),second)

    def expected(index, size):
        return refined(index).resize(size,Image.Resampling.NEAREST).convert('RGBA')

    def visible_metrics(actual, baseline):
        # Normalize to native source coordinates only for weather counting.
        # Whole-resolution source RGBA assertions remain separate and exact.
        def native(image):
            if image.width==image.height:
                # A CSS screenshot is the square cover crop; restore its native
                # horizontal inset instead of stretching the circle into an oval.
                target=Image.new('RGB',(358,267),'white')
                target.paste(image.convert('RGB').resize((267,267),Image.Resampling.NEAREST),(45,0))
                return target
            return image.convert('RGB').resize((358,267),Image.Resampling.NEAREST)
        a=np.asarray(native(actual),dtype=np.int16)
        b=np.asarray(native(baseline),dtype=np.int16)
        yy,xx=np.mgrid[:267,:358]
        circle=(xx-178.5)**2+(yy-133)**2<132**2
        changed=np.max(np.abs(a-b),axis=2)>2
        # Pink raises red minus green. White/blue flakes desaturate warm source
        # pixels, so they cannot satisfy this colour-injection test on their own.
        pink=(a[:,:,0]-a[:,:,1]-(b[:,:,0]-b[:,:,1])>=5)&(a[:,:,0]>a[:,:,1]+10)&(a[:,:,2]>a[:,:,1]+8)&changed&circle
        visited=set();components=[]
        for y,x in zip(*np.where(pink)):
            point=(int(x),int(y))
            if point in visited:continue
            stack=[point];visited.add(point);count=0
            while stack:
                px,py=stack.pop();count+=1
                for qx,qy in ((px-1,py),(px+1,py),(px,py-1),(px,py+1)):
                    if 0<=qx<358 and 0<=qy<267 and pink[qy,qx] and (qx,qy) not in visited:
                        visited.add((qx,qy));stack.append((qx,qy))
            components.append(count)
        face=((xx-179)/52)**2+((yy-107)/38)**2<1
        return {'visibleChangedPixels':int((changed&circle).sum()),'visiblePinkPixels':int(pink.sum()),
                'visiblePinkClusters':sum(size>=2 for size in components),
                'largestPinkCluster':max(components,default=0),
                'faceChangedFraction':float((changed&face).sum()/face.sum())}

    def presentation(page, label, expected_size=None):
        info=page.locator(VIEWPORT).evaluate('''e=>{
          const r=e.getBoundingClientRect(),s=getComputedStyle(e),c=e.querySelector('canvas');
          return {width:r.width,height:r.height,radius:s.borderRadius,border:s.borderTopWidth,
            shadow:s.boxShadow,overflow:document.documentElement.scrollWidth>innerWidth,
            canvas:[c.width,c.height],smoothing:c.getContext('2d').imageSmoothingEnabled,
            filter:getComputedStyle(c).filter,transform:getComputedStyle(c).transform,
            imageRendering:getComputedStyle(c).imageRendering,dpr:devicePixelRatio};
        }''')
        report['presentation'].append({'label':label,**info})
        check(label+'_circle',info['radius']=='50%' and info['border']=='0px' and info['shadow']=='none' and
              abs(info['width']-info['height'])<.01 and info['width']<=534.1,info)
        check(label+'_crisp',info['smoothing'] is False and info['filter']=='none' and
              info['transform']=='none' and info['imageRendering']=='pixelated',info)
        check(label+'_capped',1432<=info['canvas'][0]<=2864 and 1068<=info['canvas'][1]<=2136,info)
        if expected_size:check(label+'_resolution',info['canvas']==list(expected_size),info)
        check(label+'_no_overflow',not info['overflow'])

    with sync_playwright() as playwright:
        browser=playwright.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
        context=browser.new_context(viewport={'width':1440,'height':1100},device_scale_factor=1)
        page=context.new_page();requests=[]
        page.on('request',lambda r:requests.append(r.url))
        page.on('pageerror',lambda e:report['browserErrors'].append(str(e)))

        if not args.only_entry:
            page.goto(url());page.wait_for_selector(CANVAS+'[data-ready=true][data-playback=looping]')
            presentation(page,'desktop_dpr1',(1432,1068))
            check('complete_site',all(page.locator(s).count() for s in ('#about','#work','#contact','footer')))
            check('no_normal_controls',page.locator('.reference-scene button').count()==0)
            check('snow_and_petals_selected',page.locator(CANVAS).get_attribute('data-snow-particles')=='384' and
                  page.locator(CANVAS).get_attribute('data-petal-particles')=='48')
            check('no_old_artwork',not any(any(prefix in request for prefix in
                  ('/reference-scene/','/calm-circle/','/faithful-pixel/')) for request in requests),requests)
            page.screenshot(path=str(args.output/'desktop.png'),full_page=True)
            page.locator(VIEWPORT).screenshot(path=str(args.output/'circle.png'))

            for time_ms in [i*80 for i in range(16)]+[20,40,60,1279.999,1280,-1]:
                index=int((time_ms%1280)//20)
                page.goto(url(t=time_ms,atmosphere=0))
                page.wait_for_selector(CANVAS+'[data-ready=true][data-playback=static]')
                actual=pixels(page)
                check('source_'+str(time_ms)+'_exact',actual.tobytes()==expected(index,actual.size).tobytes())
                data=page.locator(CANVAS).evaluate('c=>({...c.dataset})')
                check('source_'+str(time_ms)+'_clock',data['sourceFrame']==str(index) and data['sourceDuration']=='1280',data)
                report['sourceSamples'].append({'timeMs':time_ms,'frame':index,'exact':True,'size':list(actual.size)})

            weather=[]
            for time_ms in (1,19,1281,8000,32000):
                page.goto(url(t=time_ms));page.wait_for_selector(CANVAS+'[data-ready=true]')
                actual=pixels(page);index=int((time_ms%1280)//20)
                metrics=visible_metrics(actual,expected(index,actual.size));weather.append(actual)
                report['weatherSamples'].append({'timeMs':time_ms,**metrics})
                # Require a clear pink presence in the displayed crop, beyond
                # merely proving a few off-axis or faint petal pixels exist.
                check('visible_pink_'+str(time_ms),metrics['visiblePinkPixels']>=80 and metrics['visiblePinkClusters']>=3,metrics)
                check('expression_clear_'+str(time_ms),metrics['faceChangedFraction']<.06,metrics)
                if time_ms==8000:
                    page.locator(VIEWPORT).screenshot(path=str(args.output/'weather-time8000.png'))
            check('atmosphere_moves_between_source_frames',weather[0].tobytes()!=weather[1].tobytes())
            check('atmosphere_independent_source_cycle',weather[0].tobytes()!=weather[2].tobytes())

        # Neither a video frame nor any application bundle may be required for
        # the first clearly pink, moving entry weather.
        blocked=browser.new_context(viewport={'width':1440,'height':1100})
        p=blocked.new_page();held_media=[]
        p.route('**/*.js',lambda route:route.abort())
        p.route('**/assets/poetic-pixel/*.mp4*',lambda route:held_media.append(route))
        p.goto(url(),wait_until='domcontentloaded')
        p.wait_for_selector(ENTRY+'[data-weather=visible][data-motion=running]')
        p.locator('.reference-scene__poster').evaluate('image=>image.decode()')
        p.evaluate('document.fonts.ready')
        entry=p.locator('.poetic-entry-atmosphere')
        entry.evaluate("e=>e.style.visibility='hidden'");baseline=screenshot_circle(p)
        entry.evaluate("e=>e.style.removeProperty('visibility')")
        first=screenshot_circle(p);p.wait_for_timeout(220);second=screenshot_circle(p)
        check('entry_moves_before_movie_and_module',first.tobytes()!=second.tobytes())
        metrics=visible_metrics(second,baseline)
        check('entry_visible_pink_before_movie',metrics['visiblePinkPixels']>=8 and metrics['visiblePinkClusters']>=2,metrics)
        check('entry_has_no_decoded_video',p.locator('video').evaluate('v=>v.readyState<2'))
        check('entry_content_survives_module_block',p.locator('#about').count()==1)
        p.locator(VIEWPORT).screenshot(path=str(args.output/'entry-before-media.png'))
        p.evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>window.__hidden});window.__hidden=true;document.dispatchEvent(new Event('visibilitychange'))")
        p.wait_for_selector(ENTRY+'[data-motion=paused]')
        paused=screenshot_circle(p);p.wait_for_timeout(180)
        check('entry_hidden_pauses_actual_pixels',screenshot_circle(p).tobytes()==paused.tobytes())
        p.evaluate("window.__hidden=false;document.dispatchEvent(new Event('visibilitychange'))")
        p.wait_for_selector(ENTRY+'[data-motion=running]');check('entry_visibility_resumes')
        for route in held_media:
            route.abort()
        blocked.close()

        if not args.only_entry:
            delayed=browser.new_context(viewport={'width':1440,'height':1100})
            delayed.add_init_script('''
              window.__firstHandoff=null;window.__parserVideo=null;window.__parserEntry=null;
              document.addEventListener('DOMContentLoaded',()=>{
                window.__parserVideo=window.__vermouthPoeticVideo;
                window.__parserEntry=window.__vermouthPoeticEntry;
              });
              const draw=CanvasRenderingContext2D.prototype.drawImage;
              CanvasRenderingContext2D.prototype.drawImage=function(...args){
                if(!window.__firstHandoff&&this.canvas.classList.contains('reference-scene__canvas')&&
                    this.canvas.dataset.ready==='true'&&args[0] instanceof HTMLCanvasElement){
                  window.__firstHandoff={videoMs:(window.__vermouthPoeticVideo?.currentTime??0)*1000,
                    initialMs:Number(this.canvas.dataset.initialElapsedMs),at:performance.now()};
                }
                return draw.apply(this,args);
              };
            ''')
            held=[];d=delayed.new_page();d.route('**/assets/poetic-pixel/atlas.png*',lambda route:held.append(route))
            d.goto(url(),wait_until='domcontentloaded');d.wait_for_selector('video[data-ready=true]')
            d.wait_for_timeout(300)
            check('parser_video_retained',d.evaluate('window.__vermouthPoeticVideo===window.__parserVideo'))
            check('parser_entry_retained',d.evaluate("document.getElementById('vermouth-poetic-entry')===window.__parserEntry"))
            first=screenshot_circle(d);d.wait_for_timeout(300)
            check('pending_atlas_circle_keeps_moving',screenshot_circle(d).tobytes()!=first.tobytes())
            d.wait_for_timeout(2400)
            check('atlas_held_three_seconds',len(held)==1 and d.locator(CANVAS).get_attribute('data-ready')=='false')
            held.pop().continue_();d.wait_for_selector(CANVAS+'[data-ready=true][data-playback=looping]')
            handoff=d.evaluate('window.__firstHandoff')
            delta=abs(handoff['videoMs']-handoff['initialMs'])%1280;delta=min(delta,1280-delta)
            check('phase_handoff',delta<40,{'deltaMs':delta,**handoff})
            d.wait_for_function("!window.__vermouthPoeticVideo.hasAttribute('src')")
            d.wait_for_selector(ENTRY+'[data-weather=hidden]',state='attached')
            check('no_duplicate_weather_after_handoff',d.locator(ENTRY).get_attribute('data-motion')=='paused')
            delayed.close()

            # The legacy all-weather switch must apply before handoff too.
            legacy=browser.new_context();g=legacy.new_page();legacy_atlas=[]
            g.route('**/assets/poetic-pixel/atlas.png*',lambda route:legacy_atlas.append(route))
            g.goto(url(snow=0),wait_until='domcontentloaded')
            g.wait_for_selector(CANVAS+'[data-playback=preparing]')
            check('legacy_snow_zero_hides_entry_weather',g.locator(ENTRY).get_attribute('data-weather')=='hidden')
            check('legacy_switch_atlas_really_pending',len(legacy_atlas)==1)
            legacy_atlas.pop().continue_();g.wait_for_selector(CANVAS+'[data-playback=looping]')
            check('legacy_snow_zero_disables_canvas_weather',g.locator(CANVAS).get_attribute('data-snow-particles')=='0' and
                  g.locator(CANVAS).get_attribute('data-petal-particles')=='0')
            legacy.close()

            reduced=browser.new_context(reduced_motion='reduce')
            r=reduced.new_page();reduced_requests=[];r.on('request',lambda request:reduced_requests.append(request.url))
            r.goto(url());r.wait_for_selector(CANVAS+'[data-playback=static]')
            actual=pixels(r)
            check('reduced_exact_canonical',actual.tobytes()==canonical.resize(actual.size,Image.Resampling.NEAREST).tobytes())
            check('reduced_no_video_atlas',not any('/boot.mp4' in s or '/atlas.png' in s for s in reduced_requests))
            check('reduced_entry_not_running',r.locator(ENTRY).get_attribute('data-motion')!='running')
            r.get_by_role('button',name='開啟動態',exact=True).click();r.wait_for_selector(CANVAS+'[data-playback=looping]')
            check('explicit_motion_choice');r.reload();r.wait_for_selector(CANVAS+'[data-playback=looping]')
            check('motion_choice_persists');r.get_by_role('button',name='跟隨系統',exact=True).click()
            r.wait_for_selector(CANVAS+'[data-playback=static]');check('motion_choice_reversible');reduced.close()

            page.goto(url());page.wait_for_selector(CANVAS+'[data-playback=looping]')
            page.evaluate('scrollTo(0,document.documentElement.scrollHeight)')
            page.wait_for_selector(CANVAS+'[data-playback=suspended]')
            before=pixels(page).tobytes();page.wait_for_timeout(180)
            check('offscreen_pauses_weather',pixels(page).tobytes()==before)
            page.evaluate('scrollTo(0,0)');page.wait_for_selector(CANVAS+'[data-playback=looping]')

            failure=browser.new_context();f=failure.new_page()
            f.route('**/assets/poetic-pixel/atlas.png*',lambda route:route.fulfill(status=503,body='QA'))
            f.goto(url());f.wait_for_selector(CANVAS+'[data-playback=failed]')
            f.wait_for_selector(ENTRY+'[data-motion=running]');first=screenshot_circle(f);f.wait_for_timeout(180)
            check('failure_keeps_moving_weather',screenshot_circle(f).tobytes()!=first.tobytes())
            f.unroute('**/assets/poetic-pixel/atlas.png*');f.get_by_role('button',name='重試載入',exact=True).click()
            f.wait_for_selector(CANVAS+'[data-playback=looping]');check('atlas_retry_recovers');failure.close()

            construction=browser.new_context()
            construction.add_init_script('''
              window.__spriteFault=true;window.__bitmapAcquired=0;window.__bitmapClosed=0;
              const make=window.createImageBitmap;
              window.createImageBitmap=async function(...args){
                const bitmap=await make.apply(window,args);window.__bitmapAcquired++;return bitmap;
              };
              const close=ImageBitmap.prototype.close;
              ImageBitmap.prototype.close=function(...args){window.__bitmapClosed++;return close.apply(this,args)};
              const create=CanvasRenderingContext2D.prototype.createImageData;
              CanvasRenderingContext2D.prototype.createImageData=function(...args){
                if(window.__spriteFault&&this.canvas.width===176&&this.canvas.height===99){
                  throw Error('QA simulated petal atlas construction failure');
                }
                return create.apply(this,args);
              };
            ''')
            c=construction.new_page();c.goto(url());c.wait_for_selector(CANVAS+'[data-playback=failed]')
            resources=c.evaluate('({acquired:window.__bitmapAcquired,closed:window.__bitmapClosed})')
            check('constructor_failure_closes_acquired_bitmap',resources['acquired']>=1 and
                  resources['closed']==resources['acquired'],resources)
            check('constructor_failure_preserves_site',all(c.locator(s).count() for s in ('#about','#work','#contact','footer')))
            c.wait_for_selector(ENTRY+'[data-motion=running]');before=screenshot_circle(c);c.wait_for_timeout(180)
            check('constructor_failure_keeps_moving_preview',screenshot_circle(c).tobytes()!=before.tobytes())
            c.evaluate('window.__spriteFault=false')
            c.get_by_role('button',name='重試載入',exact=True).click()
            c.wait_for_selector(CANVAS+'[data-playback=looping]');check('constructor_failure_retry_recovers')
            construction.close()

            # Low-memory cap is tested separately from the intended high-DPR tiers.
            for label,viewport,dpr,size in [('desktop_dpr2',{'width':1440,'height':1100},2,(1432,1068)),
                    ('desktop_dpr3',{'width':1440,'height':1100},3,(2148,1602)),
                    ('desktop_dpr4',{'width':1440,'height':1100},4,(2864,2136)),
                    ('mobile_dpr3',{'width':390,'height':844},3,(1432,1068))]:
                ctx=browser.new_context(viewport=viewport,device_scale_factor=dpr)
                ctx.add_init_script("Object.defineProperty(navigator,'deviceMemory',{configurable:true,get:()=>8})")
                m=ctx.new_page();m.goto(url());m.wait_for_selector(CANVAS+'[data-ready=true][data-playback=looping]')
                presentation(m,label,size)
                if label=='mobile_dpr3':m.screenshot(path=str(args.output/'mobile.png'),full_page=True)
                if label=='desktop_dpr3':
                    before=float(m.locator(CANVAS).get_attribute('data-elapsed-ms'))
                    atlas_requests=[]
                    m.on('request',lambda request:atlas_requests.append(request.url) if '/atlas.png' in request.url else None)
                    m.set_viewport_size({'width':390,'height':844})
                    m.wait_for_function("document.querySelector('.reference-scene__canvas').width===1432")
                    presentation(m,'resized_mobile_dpr3',(1432,1068))
                    after=float(m.locator(CANVAS).get_attribute('data-elapsed-ms'))
                    check('resize_preserves_elapsed_phase',after>=before,{'beforeMs':before,'afterMs':after})
                    check('resize_does_not_reload_atlas',not atlas_requests,atlas_requests)
                if label=='desktop_dpr4':
                    m.goto(url(t=320,atmosphere=0));m.wait_for_selector(CANVAS+'[data-ready=true][data-playback=static]')
                    actual=pixels(m)
                    check('maximum_resolution_exact_source_pixels',actual.tobytes()==expected(16,actual.size).tobytes())
                ctx.close()

            low_memory=browser.new_context(viewport={'width':1440,'height':1100},device_scale_factor=4)
            low_memory.add_init_script("Object.defineProperty(navigator,'deviceMemory',{configurable:true,get:()=>2})")
            l=low_memory.new_page();l.goto(url());l.wait_for_selector(CANVAS+'[data-ready=true]')
            presentation(l,'low_memory_dpr4',(1432,1068));low_memory.close()

            nojs=browser.new_context(java_script_enabled=False,reduced_motion='reduce')
            n=nojs.new_page();n.goto(url());n.wait_for_selector('.reference-scene__poster')
            check('nojs_complete_content',all(n.locator(s).count() for s in ('#about','#work','#contact','footer')))
            check('nojs_entry_not_running',n.locator(ENTRY).get_attribute('data-motion')!='running')
            n.screenshot(path=str(args.output/'no-javascript.png'),full_page=True);nojs.close()
        context.close();browser.close()

    check('no_browser_errors',not report['browserErrors'],report['browserErrors'])
    report['status']='passed';save()
    print(json.dumps({'status':'passed','scope':report['scope'],'checks':len(report['checks']),
                      'samples':len(report['sourceSamples']),'weatherSamples':report['weatherSamples']}))


if __name__=='__main__':
    main()
