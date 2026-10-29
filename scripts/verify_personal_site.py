"""Functional, natural-art and failure-mode checks for the personal website."""
from __future__ import annotations
import argparse,json,re
from pathlib import Path
from playwright.sync_api import sync_playwright

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url',default='http://127.0.0.1:4173/website/')
args=parser.parse_args(); URL=args.url.rstrip('/')+'/'
OUT=Path(__file__).resolve().parent.parent/'artifacts'/'personal-site';OUT.mkdir(parents=True,exist_ok=True)
result={'url':URL,'checks':[],'normal_errors':[],'expected_failure_cases':[]}
def ok(name,condition=True):
 assert condition,name
 result['checks'].append(name)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1)
 page.on('pageerror',lambda e:result['normal_errors'].append(str(e)))
 page.on('response',lambda r:result['normal_errors'].append(f'{r.status}: {r.url}') if r.status>=400 else None)
 page.add_init_script('window.__paintCount=0;const put=CanvasRenderingContext2D.prototype.putImageData;CanvasRenderingContext2D.prototype.putImageData=function(...args){window.__paintCount++;return put.apply(this,args)}')
 response=page.goto(URL);page.wait_for_selector('canvas[data-ready=true][data-painted=true]');page.evaluate('document.fonts.ready')
 ok('production_http200',response.status==200)
 ok('owner_identity_and_greeting', 'fknejdcwnfi' in page.locator('h1').inner_text() and page.get_by_text('HELLOWORLD',exact=True).count()==1)
 ok('full_personal_site_sections',all(page.locator('#'+i).count()==1 for i in ['about','work','contact']))
 ok('real_projects_and_contact',page.locator('a[href="https://github.com/fknejdcwnfi/xiangqi-review"]').count()==1 and page.locator('a[href="mailto:fknejdcwnfi@gmail.com"]').count()==1)
 ok('self_hosted_pixel_font',page.evaluate('document.fonts.check(\'10px "Press Start 2P"\')'))
 ok('normal_site_has_no_developer_panel',page.locator('.portrait-controls,.hud').count()==0)
 ok('portrait_autoplays_without_public_pause_control',page.locator('canvas').get_attribute('data-autoplay')=='continuous' and page.locator('.portrait-playback').count()==0)
 alpha=page.locator('canvas').evaluate('''c=>{
  const data=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
  let clear=0,solid=0,partial=0;
  for(let i=3;i<data.length;i+=4){if(data[i]===0)clear++;else if(data[i]===255)solid++;else partial++;}
  return {clear,solid,partial,total:c.width*c.height,
   corners:[0,c.width-1,(c.height-1)*c.width,c.width*c.height-1].map(i=>data[i*4+3])};
 }''')
 result['portrait_alpha']=alpha
 # Preserve the owner's original close-up crop: hair and shoulders legitimately
 # meet the canvas edges. Exposed navy space, including the upper right, is clear.
 ok('portrait_is_true_transparent_pixel_cutout',alpha['clear']>alpha['total']*.02 and alpha['solid']>alpha['total']*.5 and alpha['partial']==0 and alpha['corners'][1]==0)
 frames=page.locator('.hero-portrait,.stage--portrait').evaluate_all('''xs=>xs.map(x=>{
  const s=getComputedStyle(x);return {borders:[s.borderTopWidth,s.borderRightWidth,s.borderBottomWidth,s.borderLeftWidth],background:s.backgroundColor,shadow:s.boxShadow};
 })''')
 ok('portrait_has_no_rectangular_frame',all(all(float(w.removesuffix('px'))==0 for w in item['borders']) and item['background']=='rgba(0, 0, 0, 0)' and item['shadow']=='none' for item in frames))
 colors=page.locator('.hero__footnote, .hero__visual figcaption span:last-child').evaluate_all('(xs)=>xs.map(x=>getComputedStyle(x).color)')
 def luminance(rgb):
  values=[v/255 for v in rgb]
  values=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in values]
  return sum(v*w for v,w in zip(values,[.2126,.7152,.0722]))
 background=page.locator('.personal-site').evaluate('(x)=>getComputedStyle(x).backgroundColor')
 paper=[int(x) for x in re.findall(r'\d+',background)[:3]]
 ratios=[(luminance(paper)+.05)/(luminance([int(x) for x in re.findall(r'\d+',color)[:3]])+.05) for color in colors]
 ok('small_secondary_text_contrast',min(ratios)>=4.5)
 page.keyboard.press('Tab');ok('keyboard_skip_link',page.evaluate('document.activeElement.classList.contains("skip-link")'))
 page.keyboard.press('Enter');ok('skip_link_focuses_main_content',page.evaluate('document.activeElement.id==="main-content"'))
 page.get_by_role('navigation',name='主要導覽').get_by_role('link',name='作品',exact=True).click()
 page.wait_for_function('document.querySelector("#work").getBoundingClientRect().y<100')
 ok('navigation_reaches_work',page.locator('#work').bounding_box()['y']<100)
 page.get_by_role('navigation',name='主要導覽').get_by_role('link',name='聯絡',exact=True).click()
 page.wait_for_function('document.querySelector("canvas").dataset.playback==="suspended"')
 n=page.evaluate('window.__paintCount');page.wait_for_timeout(250)
 ok('offscreen_portrait_pauses',page.evaluate('window.__paintCount')==n)
 page.evaluate('scrollTo(0,0)')
 page.wait_for_function('document.querySelector("canvas").dataset.playback==="looping"');page.wait_for_timeout(150)
 ok('visible_portrait_resumes',page.evaluate('window.__paintCount')>n)
 # Observe both sides of multiple reference loops without depending on refresh
 # rate or comparing arbitrary wall-clock poses. Exact phase is tested by rig QA.
 counts=[]
 for _ in range(3):
  counts.append(page.evaluate('window.__paintCount'));page.wait_for_timeout(2400)
 counts.append(page.evaluate('window.__paintCount'));result['continuous_loop_paints']=counts
 ok('default_animation_continues_beyond_two_reference_loops',all(b>a for a,b in zip(counts,counts[1:])) and page.locator('canvas').get_attribute('data-playback')=='looping' and page.locator('canvas').get_attribute('data-loop-duration')=='2300')
 page.emulate_media(reduced_motion='reduce')
 page.wait_for_function('document.querySelector("canvas").dataset.playback==="static"')
 n=page.evaluate('window.__paintCount');page.wait_for_timeout(180)
 ok('reduced_motion_stays_static',page.evaluate('window.__paintCount')==n)
 for width,height in [(320,800),(390,844),(768,1024),(1440,1000)]:
  page.set_viewport_size({'width':width,'height':height});page.evaluate('scrollTo(0,0)');page.wait_for_timeout(70)
  ok(f'responsive_no_overflow_{width}',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
  box=page.locator('.stage').bounding_box();ok(f'original_closeup_ratio_{width}',abs(box['height']-box['width'])<1)
  if width==390:page.screenshot(path=str(OUT/'mobile.png'),full_page=True)
 page.set_viewport_size({'width':1440,'height':1000});page.screenshot(path=str(OUT/'desktop.png'),full_page=True)
 page.screenshot(path=str(OUT/'hero.png'))
 ok('normal_browser_has_no_errors',not result['normal_errors'])
 page.emulate_media(reduced_motion='no-preference');page.goto(URL+'?t=0');page.wait_for_selector('canvas[data-ready=true][data-playback=static]')
 n=page.evaluate('window.__paintCount');page.wait_for_timeout(180)
 ok('explicit_time_seek_stays_static_without_public_play_control',page.evaluate('window.__paintCount')==n and page.locator('.portrait-playback').count()==0)
 # Build-injected HTML is independently functional when JavaScript is unavailable.
 context=browser.new_context(java_script_enabled=False,viewport={'width':390,'height':844})
 fallback=context.new_page();fallback.goto(URL)
 ok('no_js_has_complete_content',fallback.locator('.static-site').is_visible() and 'fknejdcwnfi' in fallback.locator('h1').inner_text() and fallback.locator('#work article').count()==2 and fallback.locator('a[href="mailto:fknejdcwnfi@gmail.com"]').count()==1)
 ok('no_js_natural_portrait_loaded',fallback.locator('.static-hero img').evaluate('(im)=>im.complete&&im.naturalWidth===768&&im.naturalHeight===768&&im.src.endsWith("portrait-rest.png")'))
 fallback.screenshot(path=str(OUT/'no-javascript.png'),full_page=True);context.close()
 context=browser.new_context();blocked=context.new_page();blocked.route('**/assets/index-*.js',lambda route:route.abort())
 blocked.goto(URL);ok('blocked_bundle_keeps_complete_site',blocked.locator('.static-site').is_visible() and blocked.locator('#work article').count()==2)
 context.close();result['expected_failure_cases'].append('main JavaScript bundle blocked')
 context=browser.new_context();broken=context.new_page();broken.route('**/assets/portrait-natural/*.png',lambda route:route.fulfill(status=503,body='Unavailable'))
 broken.goto(URL);broken.wait_for_selector('.stage__fallback',state='visible')
 ok('portrait_asset_503_keeps_site_and_static_portrait',broken.locator('#about').count()==1 and broken.locator('.stage__fallback').evaluate('(im)=>im.complete&&im.naturalWidth===768&&im.naturalHeight===768'))
 context.close();result['expected_failure_cases'].append('runtime portrait assets503')
 context=browser.new_context();hung=context.new_page();pending=[]
 hung.route('**/assets/portrait-natural/eyelids.png',lambda route:pending.append(route))
 hung.goto(URL,wait_until='domcontentloaded');hung.wait_for_selector('.stage__fallback',state='visible',timeout=16000)
 ok('hanging_asset_times_out_to_static_portrait',hung.locator('.stage__fallback').evaluate('(im)=>im.complete&&im.naturalWidth===768&&im.naturalHeight===768'))
 for route in pending:
  try:route.abort()
  except Exception:pass
 hung.wait_for_timeout(50)
 hung.unroute_all(behavior='ignoreErrors')
 context.close();result['expected_failure_cases'].append('eyelid image request hangs until12s timeout')
 context=browser.new_context();unsupported=context.new_page()
 unsupported.add_init_script('const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type==="2d"?null:get.call(this,type,...args)}')
 unsupported.goto(URL);unsupported.wait_for_selector('[data-portrait-fallback=true]',state='visible')
 ok('canvas_failure_isolated_from_personal_content',unsupported.locator('#about').count()==1 and unsupported.locator('[data-portrait-fallback=true] img').evaluate('(im)=>im.complete&&im.naturalWidth===768&&im.naturalHeight===768'))
 context.close();result['expected_failure_cases'].append('Canvas2D context unavailable')
 for path in ['fonts/PressStart2P-Regular.ttf','fonts/OFL.txt','portrait-rest.png','og-portrait.png']:
  ok('asset200_'+path,page.request.get(URL+path).status==200)
 browser.close()
(OUT/'checks.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(result,ensure_ascii=False))
