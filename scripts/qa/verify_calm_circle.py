#!/usr/bin/env python3
"""Verify a stable circular portrait without the rejected full-image warp.

This test observes rendered pixels, real rAF activity and browser lifecycle. It
never treats a frame count or a passing test count as evidence of natural hair.
Historical source/progressive probes remain unchanged.
"""
from __future__ import annotations
import argparse
import base64
import io
import json
import math
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url', default='http://127.0.0.1:5180/website/')
parser.add_argument('--output', type=Path, default=ROOT / 'artifacts/calm-circle/site')
parser.add_argument('--contract', type=Path)
parser.add_argument('--canonical', type=Path)
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)
contract = json.loads(args.contract.read_text()) if args.contract else {}
report = {'status': 'failed', 'url': args.url, 'checks': [], 'samples': [], 'presentations': {},
          'browserErrors': [], 'scope': 'Stable face/body pixels, local motion and circle presentation; not physical monitor FPS or subjective motion certification'}
# Native358x267 coordinates; the central eyes and free hair are deliberately excluded.
DEFAULT_PROTECTED = {
    'nose_mouth_chin': [165, 113, 196, 163],
    'central_necklace': [172, 194, 187, 261],
    'left_exposed_shoulder': [46, 241, 63, 256],
    'right_exposed_shoulder': [298, 241, 315, 256],
}
protected = contract.get('protectedRegions', DEFAULT_PROTECTED)
qa_times = contract.get('qaTimesMs', [0, 1000, 2500, 4530, 7000, 11430, 20430, 24000])
native_width = contract.get('logicalWidth', 358)
native_height = contract.get('logicalHeight', 267)
maximum_changed = contract.get('maximumChangedFraction', .2)
canvas_selector = '.reference-scene__canvas'
forbidden = ('/scenery.webp', '/boot.mp4', '/pixel-source-atlas.png', '/pixel-smooth-atlas.png',
             '/smooth-atlas.png', '/source-atlas.png', '/motion-fields/', '.npz')


def save():
    (args.output / 'checks.json').write_text(json.dumps(report, indent=2, ensure_ascii=False) + '\n')


def check(name, passed=True, detail=None):
    report['checks'].append({'name': name, 'passed': bool(passed), 'detail': detail})
    if not passed:
        save()
        raise AssertionError((name, detail))


def with_time(url, time):
    parts = urlsplit(url)
    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    query['t'] = str(time)
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


def pixels(page):
    encoded = page.locator(canvas_selector).evaluate("canvas => canvas.toDataURL('image/png').split(',')[1]")
    return Image.open(io.BytesIO(base64.b64decode(encoded))).convert('RGBA')


def pixel_difference(a, b):
    assert a.size == b.size, (a.size, b.size)
    return sum(x != y for x, y in zip(a.getdata(), b.getdata()))


def protected_rectangles(size):
    scale_x, scale_y = size[0] / native_width, size[1] / native_height
    for name, rectangle in protected.items():
        yield name, tuple(round(value * (scale_x if index % 2 == 0 else scale_y))
                          for index, value in enumerate(rectangle))


def inspect_pixels(image, canonical, label):
    region_differences = {}
    for name, rectangle in protected_rectangles(image.size):
        region_differences[name] = pixel_difference(image.crop(rectangle), canonical.crop(rectangle))
    if contract.get('assets', {}).get('plate'):
        plate_path = args.contract.parent / contract['assets']['plate']['file']
        plate = Image.open(plate_path).convert('RGBA')
        fixed_mask = Image.new('L', plate.size, 0)
        from PIL import ImageDraw
        fixed_mask.putdata([255 if a == 255 else 0 for *_, a in plate.getdata()])
        draw = ImageDraw.Draw(fixed_mask)
        for x0,y0,x1,y1 in contract.get('eyeRects', []):
            draw.rectangle((x0,y0,x1-1,y1-1), fill=0)
        differences = sum(a != b for a,b,keep in zip(image.getdata(),plate.getdata(),fixed_mask.getdata()) if keep)
        check(label + '_entire_fixed_plate_is_unchanged', differences == 0,
              {'differentPixels':differences,'fixedPixels':sum(v>0 for v in fixed_mask.getdata())})
    changed = pixel_difference(image, canonical)
    check(label + '_face_shoulders_and_necklace_are_pixel_stable', not any(region_differences.values()), region_differences)
    check(label + '_changes_are_local_not_a_whole_image_wave', changed / (image.width * image.height) <= maximum_changed,
          {'differentPixels': changed, 'fraction': changed / (image.width * image.height), 'maximum': maximum_changed})
    return {'label': label, 'differentPixels': changed, 'protectedDifferences': region_differences}


def presentation(page, label):
    data = page.locator('.reference-scene__viewport').evaluate('''element => {
        const box=element.getBoundingClientRect(),style=getComputedStyle(element),
              canvas=element.querySelector('canvas'),art=getComputedStyle(canvas);
        return {x:box.x,y:box.y,width:box.width,height:box.height,radius:style.borderRadius,
            border:style.borderTopWidth,shadow:style.boxShadow,outline:style.outlineWidth,
            outlineStyle:style.outlineStyle,canvas:[canvas.width,canvas.height],
            imageRendering:art.imageRendering,filter:art.filter,transform:art.transform,
            smoothing:canvas.getContext('2d').imageSmoothingEnabled,
            overflow:document.documentElement.scrollWidth>innerWidth,dpr:devicePixelRatio};
    }''')
    report['presentations'][label] = data
    check(label + '_is_a_borderless_circle', abs(data['width']-data['height']) < .01 and data['radius']=='50%' and
          data['border']=='0px' and data['shadow']=='none' and (data['outline']=='0px' or data['outlineStyle']=='none'), data)
    check(label + '_is_hd_and_unfiltered', data['canvas']==[716,534] and data['imageRendering'] in ('pixelated','crisp-edges') and
          data['filter']=='none' and data['transform']=='none' and data['smoothing'] is False, data)
    check(label + '_fits_available_space', not data['overflow'] and data['width']<=534.01 and data['x']>=-.5 and
          data['x']+data['width']<=page.viewport_size['width']+.5, data)
    return data


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    context = browser.new_context(viewport={'width':1440,'height':1100},device_scale_factor=1)
    context.add_init_script('''
        window.__calmPaints=0;window.__calmRafs=0;window.__calmWorkers=0;window.__qaForceCanvasFailure=false;
        const nativeRAF=requestAnimationFrame;window.requestAnimationFrame=callback=>nativeRAF.call(window,time=>{window.__calmRafs++;callback(time)});
        const WorkerConstructor=window.Worker;
        window.Worker=class extends WorkerConstructor{constructor(...args){super(...args);window.__calmWorkers++}};
        for(const method of ['putImageData','drawImage']){
            const original=CanvasRenderingContext2D.prototype[method];
            CanvasRenderingContext2D.prototype[method]=function(...args){
                if(this.canvas.classList.contains('reference-scene__canvas')){
                    window.__calmPaints++;
                    if(window.__qaForceCanvasFailure)throw Error('QA simulated local renderer failure');
                }
                return original.apply(this,args);
            };
        }
    ''')
    page = context.new_page(); requests = []
    page.on('request',lambda request:requests.append(request.url))
    page.on('pageerror',lambda error:report['browserErrors'].append(str(error)))
    response = page.goto(args.url)
    check('production_document_loads',response is not None and response.status==200)
    page.wait_for_selector(canvas_selector+'[data-ready=true][data-playback=looping]')
    check('complete_personal_site_remains',all(page.locator(selector).count() for selector in
          ('#about','#work','#contact','footer','a[href="mailto:fknejdcwnfi@gmail.com"]')))
    check('no_background_weather_or_video_nodes_remain',page.locator('.reference-scene__scenery,.reference-scene__snow,.reference-scene__boot-host,video').count()==0)
    check('no_normal_play_controls',page.locator('.reference-scene button').count()==0)
    presentation(page,'desktop')
    before_paints=page.evaluate('window.__calmPaints');before_rafs=page.evaluate('window.__calmRafs');page.wait_for_timeout(250)
    check('normal_playback_uses_live_animation_frames',page.evaluate('window.__calmRafs')>before_rafs+5,
          {'rafCallbacks':page.evaluate('window.__calmRafs')-before_rafs,'canvasWrites':page.evaluate('window.__calmPaints')-before_paints})
    check('no_default_worker_dependency',page.evaluate('window.__calmWorkers')==0)
    page.wait_for_function('''() => {
        const canvas=document.querySelector('.reference-scene__canvas');
        const data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
        let hash=2166136261;for(const value of data)hash=Math.imul(hash^value,16777619);
        if(window.__calmFirstPixelHash===undefined){window.__calmFirstPixelHash=hash;window.__calmFirstPixelAt=performance.now();return false}
        if(hash===window.__calmFirstPixelHash)return false;
        window.__calmChangedAfterMs=performance.now()-window.__calmFirstPixelAt;return true;
    }''',polling=100,timeout=contract.get('liveChangeDeadlineMs',6000))
    check('normal_real_time_playback_changes_rendered_pixels',True,{'observedChangeAfterMs':page.evaluate('window.__calmChangedAfterMs')})
    page.screenshot(path=str(args.output/'desktop.png'),full_page=True)
    page.locator('.hero__visual--reference').screenshot(path=str(args.output/'circle.png'))

    # Reduced motion is a stable, exact full-frame reference without any temporal
    # interpolation. Read its already-authored canonical, rather than inferring
    # facial stability from a pixel-difference ratio over the whole image.
    reduced=browser.new_context(viewport={'width':1200,'height':1000},reduced_motion='reduce')
    r=reduced.new_page();reduced_requests=[]
    r.on('request',lambda request:reduced_requests.append(request.url))
    r.goto(args.url);r.wait_for_selector(canvas_selector+'[data-playback=static]')
    canonical=pixels(r)
    if args.canonical:
        authored=Image.open(args.canonical).convert('RGBA')
        check('reduced_frame_matches_authored_hd_canonical',canonical.size==authored.size and canonical.tobytes()==authored.tobytes())
    canonical.save(args.output/'canonical.png')
    reduced_before=canonical.tobytes();r.wait_for_timeout(220)
    check('reduced_motion_has_stable_pixels',pixels(r).tobytes()==reduced_before)
    motion_files=contract.get('motionFiles',[])
    check('reduced_motion_skips_dynamic_assets',not any(any(path in request for path in motion_files) or
          any(part in request for part in forbidden) for request in reduced_requests),reduced_requests)
    check('reduced_motion_explains_static_state',r.get_by_role('button',name='開啟動態',exact=True).is_visible())
    r.get_by_role('button',name='開啟動態',exact=True).click();r.wait_for_selector(canvas_selector+'[data-playback=looping]')
    check('explicit_local_choice_enables_motion',r.get_by_role('button',name='跟隨系統',exact=True).is_visible())
    r.reload();r.wait_for_selector(canvas_selector+'[data-playback=looping]')
    check('motion_choice_survives_reload',r.get_by_role('button',name='跟隨系統',exact=True).is_visible())
    r.get_by_role('button',name='跟隨系統',exact=True).click();r.wait_for_selector(canvas_selector+'[data-playback=static]')
    check('following_system_restores_exact_canonical',pixels(r).tobytes()==reduced_before)
    reduced.close()

    # Multiple independently chosen times cover blink and hair phases. Only
    # local material pixels may differ; the face/body reference is identical.
    changed=[]
    for timestamp in qa_times:
        page.goto(with_time(args.url,timestamp));page.wait_for_selector(canvas_selector+'[data-ready=true][data-playback=static]')
        image=pixels(page)
        label='time_'+str(timestamp)+'ms'
        result=inspect_pixels(image,canonical,label);result['timeMs']=timestamp
        report['samples'].append(result);changed.append(result['differentPixels'])
        if timestamp in (qa_times[0],qa_times[len(qa_times)//2]):image.save(args.output/(label+'.png'))
    check('local_motion_changes_actual_pixels',max(changed)>0,changed)
    page.goto(args.url);page.wait_for_selector(canvas_selector+'[data-playback=looping]')
    inspect_pixels(pixels(page),canonical,'normal_live_frame')
    page.evaluate('scrollTo(0,document.documentElement.scrollHeight)')
    page.wait_for_function("document.querySelector('.reference-scene__canvas').dataset.playback==='suspended'")
    offscreen=pixels(page).tobytes();page.wait_for_timeout(200)
    check('offscreen_pixels_stop_changing',pixels(page).tobytes()==offscreen)
    page.evaluate('scrollTo(0,0)');page.wait_for_selector(canvas_selector+'[data-playback=looping]')
    check('returning_onscreen_resumes_motion')
    page.evaluate("window.__qaHidden=true;Object.defineProperty(document,'hidden',{configurable:true,get:()=>window.__qaHidden});document.dispatchEvent(new Event('visibilitychange'))")
    page.wait_for_function("document.querySelector('.reference-scene__canvas').dataset.playback==='suspended'")
    hidden=pixels(page).tobytes();page.wait_for_timeout(200)
    check('hidden_document_stops_painting',pixels(page).tobytes()==hidden)
    page.evaluate("window.__qaHidden=false;document.dispatchEvent(new Event('visibilitychange'))")
    page.wait_for_selector(canvas_selector+'[data-playback=looping]');check('visible_document_resumes_motion')

    # Simulate a paint error after the real page has loaded. The authored poster
    # must remain available, then a normal retry must recover the live renderer.
    page.evaluate('window.__qaForceCanvasFailure=true')
    page.wait_for_selector('.reference-scene[data-playback=failed]')
    check('paint_failure_preserves_poster_and_personal_content',page.locator('.reference-scene__poster').is_visible() and
          page.get_by_role('button',name='重試載入').is_visible() and page.locator('#contact').count()>0)
    page.evaluate('window.__qaForceCanvasFailure=false')
    page.get_by_role('button',name='重試載入').click();page.wait_for_selector(canvas_selector+'[data-playback=looping]')
    check('retry_recovers_the_local_renderer',page.locator('.reference-scene__poster').count()==0)
    check('no_rejected_warp_media_requested',not any(any(part in request for part in forbidden) for request in requests),requests)

    for width,dpr in ((320,1),(390,2),(768,1.5)):
        mobile=browser.new_context(viewport={'width':width,'height':900},device_scale_factor=dpr)
        m=mobile.new_page();m.goto(args.url);m.wait_for_selector(canvas_selector+'[data-playback=looping]')
        presentation(m,f'width{width}_dpr{dpr}')
        check(f'width{width}_has_no_scenery_or_weather',m.locator('.reference-scene__scenery,.reference-scene__snow,video').count()==0)
        if width==390:m.screenshot(path=str(args.output/'mobile.png'),full_page=True)
        mobile.close()

    nojs=browser.new_context(viewport={'width':1200,'height':1000},java_script_enabled=False)
    n=nojs.new_page();n.goto(args.url)
    poster=n.locator('.reference-scene-static img');poster.wait_for(state='visible')
    check('nojs_has_a_complete_hd_poster',poster.count()==1 and poster.evaluate('image=>image.complete&&image.naturalWidth===716&&image.naturalHeight===534'))
    style=n.locator('.reference-scene-static').evaluate('element=>{const target=element.querySelector(".reference-scene__viewport")||element,box=target.getBoundingClientRect(),style=getComputedStyle(target);return{width:box.width,height:box.height,radius:style.borderRadius,border:style.borderTopWidth,shadow:style.boxShadow}}')
    check('nojs_uses_the_same_borderless_circle',abs(style['width']-style['height'])<.01 and style['radius']=='50%' and style['border']=='0px' and style['shadow']=='none',style)
    check('nojs_has_no_old_background_or_video',n.locator('.reference-scene__scenery,.reference-scene__snow,video').count()==0)
    check('nojs_retains_content_and_navigation',all(n.locator(selector).count()>0 for selector in ('#about','#work','#contact','footer')))
    n.screenshot(path=str(args.output/'no-javascript.png'),full_page=True);nojs.close()
    context.close();browser.close()

check('no_uncaught_browser_errors',not report['browserErrors'],report['browserErrors'])
report['requests']=requests;report['status']='passed';save()
print(json.dumps({'status':report['status'],'checks':len(report['checks']),'samples':len(report['samples']),'output':str(args.output)}))
