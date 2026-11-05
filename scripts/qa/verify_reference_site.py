"""Verify the full source-driven scene on the complete personal website.

Use a production preview URL after build. The checks cover real rendering,
preferences, source assets and browser lifecycle, not physical monitor FPS.
"""
from __future__ import annotations
import argparse,json
from pathlib import Path
from urllib.parse import urljoin
from playwright.sync_api import sync_playwright
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url',default='http://127.0.0.1:4173/website/')
parser.add_argument('--output',type=Path,default=Path('artifacts/reference-scene/site'))
args=parser.parse_args();url=args.url.rstrip('/')+'/';out=args.output;out.mkdir(parents=True,exist_ok=True)
report={'status':'failed','url':url,'checks':[],'presentations':{},'errors':[]}
def check(name,condition=True,detail=None):
 if not condition:
  report['failure']={'name':name,'detail':detail};(out/'checks.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n');raise AssertionError((name,detail))
 report['checks'].append(name)
def presentation(page,name):
 box=page.locator('.reference-scene__viewport').evaluate('''e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e),canvas=e.querySelector('canvas'),c=getComputedStyle(canvas);return{x:r.x,y:r.y,width:r.width,height:r.height,ratio:r.width/r.height,radius:s.borderRadius,border:s.borderTopWidth,imageRendering:c.imageRendering,transform:c.transform,canvas:[canvas.width,canvas.height],overflow:document.documentElement.scrollWidth>innerWidth}}''')
 report['presentations'][name]=box
 check(name+'_full_4to3_frame',abs(box['ratio']-4/3)<.005 and box['radius']=='0px' and box['border']=='0px',box)
 check(name+'_pixel_canvas_nearest_and_untransformed',box['canvas']==[320,240] and box['imageRendering'] in ['pixelated','crisp-edges'] and box['transform']=='none',box)
 check(name+'_fits_viewport',not box['overflow'] and box['x']>=-.5 and box['x']+box['width']<=page.viewport_size['width']+.5,box)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 context=browser.new_context(viewport={'width':1440,'height':1000})
 context.add_init_script("window.__workers=0;const W=window.Worker;window.Worker=class extends W{constructor(...args){window.__workers++;super(...args)}}")
 page=context.new_page();requests=[]
 page.on('request',lambda r:requests.append(r.url));page.on('pageerror',lambda e:report['errors'].append(str(e)))
 response=page.goto(url);check('production_http200',response.status==200)
 page.wait_for_selector('.reference-scene canvas[data-ready=true][data-painted=true][data-playback=looping]')
 check('personal_content_and_real_links',all(page.locator(x).count() for x in ['main','#about','#work','#contact','footer','a[href="mailto:fknejdcwnfi@gmail.com"]','a[href="https://github.com/fknejdcwnfi/website"]']))
 check('source_scene_renderer_selected',page.locator('.reference-scene canvas').get_attribute('data-renderer')=='reference-scene' and page.locator('.reference-scene canvas').get_attribute('data-source-duration')=='1280')
 check('source_scene_has_no_normal_play_controls',page.locator('.reference-scene button').count()==0)
 frames=[]
 for i in range(24):
  frames.append(page.locator('.reference-scene canvas').get_attribute('data-source-frame'));page.wait_for_timeout(30)
 check('source_frames_change_continuously',len(set(frames))>12,frames)
 check('no_worker_dependency',page.evaluate('window.__workers')==0)
 check('no_archived_portrait_assets_requested',not any(any(part in r for part in ['/portrait-natural/','/portrait-rig/','/portrait-rest.png','/assets/frames/']) for r in requests),requests)
 check('canonical_and_atlas_are_local_source_scene_assets',any('/assets/reference-scene/canonical.png' in r for r in requests) and any('/assets/reference-scene/smooth-atlas.png' in r for r in requests))
 presentation(page,'desktop');page.screenshot(path=str(out/'desktop.png'),full_page=True);page.locator('.hero__visual--reference').screenshot(path=str(out/'scene.png'))
 search=page.get_by_role('searchbox',name='搜尋此網站');search.fill('Java');check('local_search_finds_real_project',page.locator('#site-search-results').get_by_role('link').count()>0);search.press('Escape')
 page.evaluate('scrollTo(0,document.documentElement.scrollHeight)');page.wait_for_function("document.querySelector('.reference-scene canvas').dataset.playback==='suspended'")
 before=page.locator('.reference-scene canvas').get_attribute('data-source-frame');page.wait_for_timeout(180);check('offscreen_source_playback_suspends',before==page.locator('.reference-scene canvas').get_attribute('data-source-frame'))
 page.evaluate('scrollTo(0,0)');page.wait_for_function("document.querySelector('.reference-scene canvas').dataset.playback==='looping'");check('onscreen_source_playback_resumes')
 page.evaluate("window.__hidden=true;Object.defineProperty(document,'hidden',{configurable:true,get:()=>window.__hidden});document.dispatchEvent(new Event('visibilitychange'))")
 page.wait_for_function("document.querySelector('.reference-scene canvas').dataset.playback==='suspended'");before=page.locator('.reference-scene canvas').get_attribute('data-source-frame');page.wait_for_timeout(180);check('hidden_source_playback_suspends',before==page.locator('.reference-scene canvas').get_attribute('data-source-frame'))
 page.evaluate("window.__hidden=false;document.dispatchEvent(new Event('visibilitychange'))");page.wait_for_function("document.querySelector('.reference-scene canvas').dataset.playback==='looping'");check('visible_source_playback_resumes')
 for width,dpr in [(320,1),(390,2),(768,1)]:
  mobile=browser.new_context(viewport={'width':width,'height':900},device_scale_factor=dpr);m=mobile.new_page();m.goto(url);m.wait_for_selector('.reference-scene canvas[data-playback=looping]');presentation(m,f'width{width}_dpr{dpr}')
  if width==390:m.screenshot(path=str(out/'mobile.png'),full_page=True)
  mobile.close()
 reduce=browser.new_context(viewport={'width':1200,'height':1000},reduced_motion='reduce');r=reduce.new_page();reduced_requests=[];r.on('request',lambda request:reduced_requests.append(request.url));r.goto(url);r.wait_for_selector('.reference-scene canvas[data-playback=static]');before=r.locator('.reference-scene canvas').evaluate('c=>c.toDataURL()');r.wait_for_timeout(200)
 check('reduced_preference_has_static_canonical',before==r.locator('.reference-scene canvas').evaluate('c=>c.toDataURL()'))
 check('reduced_preference_skips_animation_atlas',not any('atlas.png' in request for request in reduced_requests),reduced_requests)
 check('reduced_preference_explains_static_mode',r.get_by_role('button',name='開啟動態',exact=True).is_visible())
 r.get_by_role('button',name='開啟動態',exact=True).click();r.wait_for_selector('.reference-scene canvas[data-playback=looping]');r.wait_for_timeout(100);check('explicit_choice_starts_real_source_frames',r.locator('.reference-scene canvas').get_attribute('data-source-duration')=='1280')
 r.reload();r.wait_for_selector('.reference-scene canvas[data-playback=looping]');check('explicit_choice_survives_reload',r.get_by_role('button',name='跟隨系統',exact=True).is_visible())
 r.get_by_role('button',name='跟隨系統',exact=True).click();r.wait_for_selector('.reference-scene canvas[data-playback=static]');check('following_system_restores_static_canonical',before==r.locator('.reference-scene canvas').evaluate('c=>c.toDataURL()'));reduce.close()
 failure=browser.new_context(viewport={'width':1200,'height':1000});f=failure.new_page();f.route('**/smooth-atlas.png*',lambda route:route.fulfill(status=503,body='Temporary source atlas failure'));f.goto(url);f.wait_for_selector('.reference-scene[data-playback=failed]');check('atlas_failure_has_source_poster_and_recovery',f.locator('.reference-scene__poster').is_visible() and f.get_by_role('button',name='重試載入').is_visible() and f.locator('#contact').count()>0)
 f.unroute('**/smooth-atlas.png*');f.get_by_role('button',name='重試載入').click();f.wait_for_selector('.reference-scene canvas[data-playback=looping]');check('manual_retry_recovers_real_source_animation',f.locator('.reference-scene__poster').count()==0);failure.close()
 nojs=browser.new_context(viewport={'width':1200,'height':1000},java_script_enabled=False);n=nojs.new_page();n.goto(url);n.wait_for_selector('.reference-scene-static img');check('nojs_keeps_full_reference_poster',n.locator('.reference-scene-static img').get_attribute('src').endswith('assets/reference-scene/canonical.png') and n.locator('.reference-scene-static img').evaluate('i=>i.complete&&i.naturalWidth===320&&i.naturalHeight===240'))
 check('nojs_keeps_personal_content_and_navigation',all(n.locator(selector).count()>0 for selector in ['#about','#work','#contact','footer','a[href="mailto:fknejdcwnfi@gmail.com"]']));n.screenshot(path=str(out/'no-javascript.png'),full_page=True);nojs.close()
 check('normal_page_has_no_browser_errors',not report['errors'],report['errors']);report['requests']=requests;context.close();browser.close()
report['status']='passed';(out/'checks.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n');print(json.dumps({'status':report['status'],'checks':len(report['checks']),'output':str(out/'checks.json')}))
