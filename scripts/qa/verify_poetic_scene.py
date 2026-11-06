#!/usr/bin/env python3
"""Production QA for detailed source frames, independent snow and parser playback."""
import argparse
import base64
import io
import json
from pathlib import Path
from urllib.parse import urlencode

from PIL import Image, ImageChops
from playwright.sync_api import sync_playwright
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]/'assets'))
from verify_poetic_pixel_scene import scale2x_rgb

ROOT = Path(__file__).resolve().parents[2]
CANVAS = '.reference-scene__canvas'
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url', default='http://127.0.0.1:5180/website/')
parser.add_argument('--output', type=Path, default=ROOT/'artifacts/poetic-pixel/site')
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)
manifest = json.loads((ROOT/'public/assets/poetic-pixel/manifest.json').read_text())
atlas = Image.open(ROOT/'public/assets/poetic-pixel/atlas.png').convert('RGB')
canonical = Image.open(ROOT/'public/assets/poetic-pixel/canonical.png').convert('RGBA')
report = {'status':'failed', 'checks':[], 'browserErrors':[], 'sourceSamples':[],
          'sourceFrames':16, 'estimatedInterframes':48, 'playbackFps':50, 'outputDimensions':[1432,1068]}

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

def expected(index):
    x,y = index%8*358,index//8*267
    tile = atlas.crop((x,y,x+358,y+267))
    hd = Image.frombytes('RGB',(716,534),scale2x_rgb(tile.tobytes(),358,267))
    return hd.resize((1432,1068),Image.Resampling.NEAREST).convert('RGBA')

def video_hash(page):
    return page.locator('video').evaluate('''v=>{
        const c=document.createElement('canvas');c.width=358;c.height=267;
        const x=c.getContext('2d');x.drawImage(v,0,0,358,267);
        let h=2166136261;for(const b of x.getImageData(0,0,358,267).data)h=Math.imul(h^b,16777619);
        return h;
    }''')

def presentation(page, name):
    info = page.locator('.reference-scene__viewport').evaluate('''e=>{
        const r=e.getBoundingClientRect(),s=getComputedStyle(e),c=e.querySelector('canvas');
        return {width:r.width,height:r.height,radius:s.borderRadius,border:s.borderTopWidth,
            shadow:s.boxShadow,overflow:document.documentElement.scrollWidth>innerWidth,
            canvas:[c.width,c.height],smoothing:c.getContext('2d').imageSmoothingEnabled,
            filter:getComputedStyle(c).filter,imageRendering:getComputedStyle(c).imageRendering};
    }''')
    check(name+'_circle', info['radius']=='50%' and info['border']=='0px' and info['shadow']=='none' and
          abs(info['width']-info['height'])<.01 and info['width']<=534.1, info)
    check(name+'_hd_crisp', info['canvas']==[1432,1068] and info['smoothing'] is False and
          info['filter']=='none' and info['imageRendering']=='pixelated', info)
    check(name+'_no_overflow', not info['overflow'])

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    context = browser.new_context(viewport={'width':1440,'height':1100})
    page = context.new_page()
    requests = []
    page.on('request',lambda r:requests.append(r.url))
    page.on('pageerror',lambda e:report['browserErrors'].append(str(e)))
    page.goto(url())
    page.wait_for_selector(CANVAS+'[data-ready=true][data-playback=looping]')
    presentation(page,'desktop')
    check('personal_site',all(page.locator(s).count() for s in ('#about','#work','#contact','footer')))
    check('no_outer_scenery',page.locator('.reference-scene__scenery,.reference-scene__snow').count()==0)
    check('no_normal_controls',page.locator('.reference-scene button').count()==0)
    check('new_snow_present',page.locator(CANVAS).get_attribute('data-snow-particles')=='288')
    check('no_rejected_artwork_requests',not any(any(prefix in request for prefix in
          ('/reference-scene/','/calm-circle/','/faithful-pixel/')) for request in requests),requests)
    page.screenshot(path=str(args.output/'desktop.png'),full_page=True)
    page.locator('.reference-scene__viewport').screenshot(path=str(args.output/'circle.png'))

    # All original anchors plus estimated transitions and negative/loop boundaries.
    for time_ms in [i*80 for i in range(16)]+[20,40,60,79.999,80.001,1260,1279.999,1280,1280.001,-1]:
        index = int((time_ms%1280)//20)
        page.goto(url(t=time_ms,snow=0))
        page.wait_for_selector(CANVAS+'[data-ready=true][data-playback=static]')
        actual = pixels(page)
        check('frame_'+str(time_ms)+'_exact',actual.tobytes()==expected(index).tobytes())
        data = page.locator(CANVAS).evaluate('c=>({...c.dataset})')
        check('frame_'+str(time_ms)+'_clock',data['sourceFrame']==str(index) and data['sourceDuration']=='1280',data)
        report['sourceSamples'].append({'timeMs':time_ms,'frame':index,'exact':True})

    # Weather must change between two times within the SAME20ms source frame.
    snow_images = []
    for time_ms in (1,19,1281):
        page.goto(url(t=time_ms));page.wait_for_selector(CANVAS+'[data-ready=true]')
        snow_images.append(pixels(page))
    check('snow_moves_between_source_frames',snow_images[0].tobytes()!=snow_images[1].tobytes())
    check('snow_does_not_reset_with_source',snow_images[0].tobytes()!=snow_images[2].tobytes())
    diff = ImageChops.difference(snow_images[0].convert('RGB'),expected(0).convert('RGB')).convert('L')
    face = diff.crop((123*4,82*4,240*4,134*4))
    changed = 1-face.histogram()[0]/(face.width*face.height)
    check('expression_remains_readable',changed<.06,{'faceChangedFraction':changed})

    # Parser video remains visibly alive even if the application cannot start.
    blocked = browser.new_context(viewport={'width':1440,'height':1100})
    p = blocked.new_page();p.route('**/*.js',lambda route:route.abort())
    p.goto(url(),wait_until='domcontentloaded');p.wait_for_selector('video[data-ready=true]')
    first = video_hash(p);p.wait_for_timeout(180)
    check('parser_pixels_move_with_module_blocked',video_hash(p)!=first)
    check('parser_preserves_document',p.locator('#about').count()==1)
    blocked.close()

    # Hold the large atlas while the same parser-started node plays for3seconds.
    delayed = browser.new_context(viewport={'width':1440,'height':1100})
    delayed.add_init_script('''
      window.__firstHandoff=null;window.__parserVideo=null;
      document.addEventListener('DOMContentLoaded',()=>{window.__parserVideo=window.__vermouthPoeticVideo});
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
    d.wait_for_timeout(300);first=video_hash(d);d.wait_for_timeout(300)
    check('preview_moves_while_atlas_pending',video_hash(d)!=first)
    check('preview_visible_while_preparing',d.locator('.reference-scene__preview').get_attribute('data-active')=='true')
    check('parser_node_retained',d.evaluate('window.__vermouthPoeticVideo===window.__parserVideo'))
    d.wait_for_timeout(2400)
    check('atlas_really_pending',len(held)==1 and d.locator(CANVAS).get_attribute('data-ready')=='false')
    held.pop().continue_();d.wait_for_selector(CANVAS+'[data-ready=true][data-playback=looping]')
    handoff=d.evaluate('window.__firstHandoff')
    delta=abs(handoff['videoMs']-handoff['initialMs'])%1280;delta=min(delta,1280-delta)
    check('handoff_uses_actual_video_phase',delta<40,{'deltaMs':delta,**handoff})
    d.wait_for_function("!window.__vermouthPoeticVideo.hasAttribute('src')")
    check('preview_released_after_handoff')
    delayed.close()

    reduced = browser.new_context(reduced_motion='reduce')
    r=reduced.new_page();reduced_requests=[];r.on('request',lambda request:reduced_requests.append(request.url))
    r.goto(url());r.wait_for_selector(CANVAS+'[data-playback=static]')
    check('reduced_exact_canonical',pixels(r).tobytes()==canonical.tobytes())
    check('reduced_skips_video_and_atlas',not any('/boot.mp4' in s or '/atlas.png' in s for s in reduced_requests))
    r.get_by_role('button',name='開啟動態',exact=True).click();r.wait_for_selector(CANVAS+'[data-playback=looping]')
    check('explicit_motion_opt_in');r.reload();r.wait_for_selector(CANVAS+'[data-playback=looping]')
    check('motion_choice_persists');r.get_by_role('button',name='跟隨系統',exact=True).click()
    r.wait_for_selector(CANVAS+'[data-playback=static]');check('motion_choice_reversible')
    reduced.close()

    page.goto(url());page.wait_for_selector(CANVAS+'[data-playback=looping]')
    page.evaluate('scrollTo(0,document.documentElement.scrollHeight)')
    page.wait_for_selector(CANVAS+'[data-playback=suspended]')
    before=pixels(page).tobytes();page.wait_for_timeout(180)
    check('offscreen_stops_drawing',pixels(page).tobytes()==before)
    page.evaluate('scrollTo(0,0)');page.wait_for_selector(CANVAS+'[data-playback=looping]')
    page.evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>window.__hidden});window.__hidden=true;document.dispatchEvent(new Event('visibilitychange'))")
    page.wait_for_selector(CANVAS+'[data-playback=suspended]');before=pixels(page).tobytes();page.wait_for_timeout(180)
    check('hidden_stops_drawing',pixels(page).tobytes()==before)
    page.evaluate("window.__hidden=false;document.dispatchEvent(new Event('visibilitychange'))")
    page.wait_for_selector(CANVAS+'[data-playback=looping]');check('visibility_resumes')

    failure=browser.new_context();f=failure.new_page()
    f.route('**/assets/poetic-pixel/atlas.png*',lambda route:route.fulfill(status=503,body='QA'))
    f.goto(url());f.wait_for_selector(CANVAS+'[data-playback=failed]');f.wait_for_selector('video[data-ready=true]')
    first=video_hash(f);f.wait_for_timeout(180)
    check('atlas_failure_keeps_moving_preview',video_hash(f)!=first)
    f.unroute('**/assets/poetic-pixel/atlas.png*');f.get_by_role('button',name='重試載入',exact=True).click()
    f.wait_for_selector(CANVAS+'[data-playback=looping]');check('atlas_retry_recovers');failure.close()

    mobile=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=2)
    m=mobile.new_page();m.goto(url());m.wait_for_selector(CANVAS+'[data-ready=true]')
    presentation(m,'mobile');m.screenshot(path=str(args.output/'mobile.png'),full_page=True);mobile.close()
    nojs=browser.new_context(java_script_enabled=False,reduced_motion='reduce')
    n=nojs.new_page();n.goto(url());n.wait_for_selector('.reference-scene__poster')
    check('nojs_preserves_content',all(n.locator(s).count() for s in ('#about','#work','#contact','footer')))
    check('nojs_new_hd_image',n.locator('.reference-scene__poster').get_attribute('width')=='1432')
    n.screenshot(path=str(args.output/'no-javascript.png'),full_page=True);nojs.close()
    context.close();browser.close()
check('no_browser_errors',not report['browserErrors'],report['browserErrors'])
report['status']='passed';save()
print(json.dumps({'status':'passed','checks':len(report['checks']),'samples':len(report['sourceSamples'])}))
