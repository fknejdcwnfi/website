"""Verify the complete site, centered circular pixel portrait and failure modes."""
from __future__ import annotations
import argparse,atexit,json,re
from pathlib import Path
from playwright.sync_api import sync_playwright

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url',default='http://127.0.0.1:4173/website/')
parser.add_argument('--output',type=Path,default=Path(__file__).resolve().parents[2]/'artifacts'/'personal-site')
args=parser.parse_args(); URL=args.url.rstrip('/')+'/'
OUT=args.output.resolve();OUT.mkdir(parents=True,exist_ok=True)
result={'url':URL,'status':'failed','contract':'centered borderless circle; crisp fixed-grid pixels; continuous gentle wind and independent blinks','checks':[],'normal_errors':[],'expected_failure_cases':[],'normal_script_resources':[],'normal_image_resources':[],'portrait_presentations':{}}
def save_results():
 (OUT/'checks.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
atexit.register(save_results)
def ok(name,condition=True):
 if not condition:result['failure']=name
 assert condition,name
 result['checks'].append(name)

def portrait_presentation(page, label, *, pixel_grid=False):
 """Check the effective clipping ancestor, not a decorative sibling circle."""
 detail=page.locator('.hero-portrait').evaluate('''portrait=>{
  const candidate=portrait.querySelector('canvas,img');
  const chain=[];
  for(let element=candidate;element&&element!==portrait.parentElement;element=element.parentElement){
   const s=getComputedStyle(element),r=element.getBoundingClientRect();
   const round=s.clipPath.startsWith('circle(')||(
    [s.borderTopLeftRadius,s.borderTopRightRadius,s.borderBottomLeftRadius,s.borderBottomRightRadius].every(v=>v==='50%')&&
    ['hidden','clip'].includes(s.overflowX)&&['hidden','clip'].includes(s.overflowY));
   chain.push({element,style:s,rect:r,round});
  }
  const clip=chain.find(item=>item.round),canvas=portrait.querySelector('canvas');
  const r=clip?.rect??portrait.getBoundingClientRect(),dpr=devicePixelRatio;
  const size=canvas?.width??256,painted=canvas??candidate,paintedRect=painted.getBoundingClientRect();
  const style=getComputedStyle(painted);
  return {circle:!!clip,width:r.width,height:r.height,center_error_css_px:Math.abs(r.x+r.width/2-innerWidth/2),
   dpr,logical_size:size,physical_pixel_scale:paintedRect.width*dpr/size,
   physical_width:paintedRect.width*dpr,physical_height:paintedRect.height*dpr,
   physical_origin:[paintedRect.x*dpr,paintedRect.y*dpr],
   image_rendering:style.imageRendering,filter:style.filter,transform:style.transform,
   no_frame:chain.every(({style:s})=>[s.borderTopWidth,s.borderRightWidth,s.borderBottomWidth,s.borderLeftWidth].every(w=>parseFloat(w)===0)&&s.boxShadow==='none'),
   transparent_background:chain.every(({style:s})=>s.backgroundColor==='rgba(0, 0, 0, 0)'),
   in_viewport:r.x>=-.5&&r.x+r.width<=innerWidth+.5};
 }''')
 result['portrait_presentations'][label]=detail
 ok(label+'_centered_borderless_circle',detail['circle'] and abs(detail['width']-detail['height'])<.5 and detail['center_error_css_px']<=1 and detail['no_frame'] and detail['transparent_background'] and detail['in_viewport'])
 if pixel_grid:
  scale=detail['physical_pixel_scale']
  aligned=all(abs(value-round(value))<.05 for value in detail['physical_origin'])
  ok(label+'_integer_physical_pixel_scale',scale>=1 and abs(scale-round(scale))<.01 and aligned and detail['image_rendering']=='pixelated' and detail['filter']=='none' and detail['transform']=='none')
 return detail
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1)
 page.on('pageerror',lambda e:result['normal_errors'].append(str(e)))
 page.on('response',lambda r:result['normal_script_resources'].append(r.url) if r.request.resource_type=='script' else result['normal_image_resources'].append(r.url) if r.request.resource_type=='image' else None)
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
 portrait_presentation(page,'normal_desktop',pixel_grid=True)
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
 # Observe uninterrupted painting across the complete slow wind period. Exact
 # phase and the longer independent blink clock are checked by the rig/player QA.
 counts=[]
 for _ in range(3):
  counts.append(page.evaluate('window.__paintCount'));page.wait_for_timeout(4300)
 counts.append(page.evaluate('window.__paintCount'));result['continuous_loop_paints']=counts
 ok('default_animation_continues_beyond_slow_wind_period',all(b>a for a,b in zip(counts,counts[1:])) and page.locator('canvas').get_attribute('data-playback')=='looping' and page.locator('canvas').get_attribute('data-loop-duration')=='12000')
 page.emulate_media(reduced_motion='reduce')
 page.wait_for_function('document.querySelector("canvas").dataset.playback==="static"')
 n=page.evaluate('window.__paintCount');page.wait_for_timeout(180)
 ok('reduced_motion_stays_static',page.evaluate('window.__paintCount')==n)
 for width,height in [(320,800),(390,844),(768,1024),(1440,1000)]:
  page.set_viewport_size({'width':width,'height':height});page.evaluate('scrollTo(0,0)');page.wait_for_timeout(70)
  ok(f'responsive_no_overflow_{width}',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
  box=page.locator('.stage').bounding_box();ok(f'original_closeup_ratio_{width}',abs(box['height']-box['width'])<1)
  portrait_presentation(page,f'width_{width}_dpr1',pixel_grid=True)
  if width==390:page.screenshot(path=str(OUT/'mobile.png'),full_page=True)
 page.set_viewport_size({'width':1440,'height':1000});page.wait_for_timeout(70)
 page.screenshot(path=str(OUT/'desktop.png'),full_page=True)
 page.screenshot(path=str(OUT/'hero.png'))
 for width,height in [(390,844),(1440,1000)]:
  context=browser.new_context(viewport={'width':width,'height':height},device_scale_factor=2,reduced_motion='reduce')
  crisp=context.new_page();crisp.goto(URL);crisp.wait_for_selector('canvas[data-ready=true][data-painted=true]')
  crisp.wait_for_timeout(70)
  portrait_presentation(crisp,f'width_{width}_dpr2',pixel_grid=True)
  context.close()
 ok('normal_browser_has_no_errors',not result['normal_errors'])
 ok('homepage_defers_archived_renderer_modules',all('/archive/' not in url and not re.search(r'/(?:voxelPlayer|voxelScene|player)-[^/]+\.js',url) for url in result['normal_script_resources']))
 ok('homepage_does_not_download_archived_portrait_frames',all('/assets/frames/' not in url and '/assets/voxel/' not in url for url in result['normal_image_resources']))
 page.emulate_media(reduced_motion='no-preference');page.goto(URL+'?t=0');page.wait_for_selector('canvas[data-ready=true][data-playback=static]')
 n=page.evaluate('window.__paintCount');page.wait_for_timeout(180)
 ok('explicit_time_seek_stays_static_without_public_play_control',page.evaluate('window.__paintCount')==n and page.locator('.portrait-playback').count()==0)
 # Build-injected HTML is independently functional when JavaScript is unavailable.
 context=browser.new_context(java_script_enabled=False,viewport={'width':390,'height':844})
 fallback=context.new_page();fallback.goto(URL)
 ok('no_js_has_complete_content',fallback.locator('.static-site').is_visible() and 'fknejdcwnfi' in fallback.locator('h1').inner_text() and fallback.locator('#work article').count()==2 and fallback.locator('a[href="mailto:fknejdcwnfi@gmail.com"]').count()==1)
 ok('no_js_natural_portrait_loaded',fallback.locator('.static-hero img').evaluate('(im)=>im.complete&&im.naturalWidth===768&&im.naturalHeight===768&&im.src.endsWith("portrait-rest.png")'))
 for width,height in [(320,800),(390,844),(768,1024),(1440,1000)]:
  fallback.set_viewport_size({'width':width,'height':height})
  ok(f'no_js_responsive_no_overflow_{width}',fallback.evaluate('document.documentElement.scrollWidth<=innerWidth'))
  portrait_presentation(fallback,f'no_js_static_poster_{width}')
 fallback.set_viewport_size({'width':390,'height':844})
 fallback.screenshot(path=str(OUT/'no-javascript.png'),full_page=True);context.close()
 context=browser.new_context();blocked=context.new_page();blocked.route('**/assets/index-*.js',lambda route:route.abort())
 blocked.goto(URL);ok('blocked_bundle_keeps_complete_site',blocked.locator('.static-site').is_visible() and blocked.locator('#work article').count()==2)
 portrait_presentation(blocked,'blocked_bundle_static_poster')
 context.close();result['expected_failure_cases'].append('main JavaScript bundle blocked')
 context=browser.new_context();broken=context.new_page();broken.route('**/assets/portrait-natural/*.png',lambda route:route.fulfill(status=503,body='Unavailable'))
 broken.goto(URL);broken.wait_for_selector('.stage__fallback',state='visible')
 ok('portrait_asset_503_keeps_site_and_static_portrait',broken.locator('#about').count()==1 and broken.locator('.stage__fallback').evaluate('(im)=>im.complete&&im.naturalWidth===768&&im.naturalHeight===768'))
 portrait_presentation(broken,'asset_503_static_fallback')
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
 portrait_presentation(unsupported,'canvas_failure_static_fallback')
 context.close();result['expected_failure_cases'].append('Canvas2D context unavailable')
 # Each archive is loaded on demand. If that optional chunk is unavailable,
 # the same fallback must preserve the rest of the real personal website.
 for style in ['voxel','legacy']:
  context=browser.new_context();archived=context.new_page();blocked_chunks=[]
  def block_archive(route):
   name=route.request.url.rsplit('/',1)[-1]
   if '/assets/' in route.request.url and not name.startswith('index-'):
    blocked_chunks.append(route.request.url);route.abort()
   else:route.continue_()
  archived.route('**/*.js',block_archive)
  archived.goto(URL+'?style='+style)
  archived.wait_for_selector('.stage__fallback',state='visible')
  ok('unavailable_'+style+'_chunk_keeps_personal_site',bool(blocked_chunks) and archived.locator('#about').count()==1 and archived.locator('.stage__fallback').evaluate('(im)=>im.complete&&im.naturalWidth===768'))
  context.close();result['expected_failure_cases'].append(style+' optional JavaScript chunk blocked')
 for path in ['fonts/PressStart2P-Regular.ttf','fonts/OFL.txt','portrait-rest.png','og-portrait.png']:
  ok('asset200_'+path,page.request.get(URL+path).status==200)
 browser.close()
result['status']='passed'
save_results()
print(json.dumps(result,ensure_ascii=False))
