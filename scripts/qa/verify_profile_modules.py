#!/usr/bin/env python3
"""Check the real profile and a separately built synthetic customization fixture.

Production content is never replaced. The fixture build/server live under ignored
work/, while this report makes the distinction explicit. No external pages load.
"""
from __future__ import annotations
import argparse
import contextlib
import json
from pathlib import Path
import socket
import subprocess
import time
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
CANVAS = '.reference-scene__canvas'
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url', default='http://127.0.0.1:5180/website/')
parser.add_argument('--fixture-url', default='http://127.0.0.1:5181/website/')
parser.add_argument('--output', type=Path, default=ROOT/'artifacts/profile-modules')
parser.add_argument('--skip-fixture-build', action='store_true')
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)
report = {'status':'failed', 'productionUrl':args.url, 'fixtureUrl':args.fixture_url,
          'fixtureIsSynthetic':True, 'productionContentChangedByQA':False,
          'checks':[], 'browserErrors':[], 'unexpectedResponses':[], 'externalRequests':[], 'layouts':[]}

def save():
    (args.output/'checks.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')

def check(name, condition=True, detail=None):
    report['checks'].append({'name':name, 'passed':bool(condition), 'detail':detail})
    save()
    if not condition:
        raise AssertionError((name, detail))

def no_overflow(page, label):
    layout = page.evaluate('''()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,
      cards:[...document.querySelectorAll('.interest-card,.game-showcase,.social-card')].map(e=>{
        const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {x:r.x,right:r.right,width:r.width,radius:s.borderRadius};
      })})''')
    report['layouts'].append({'label':label, **layout})
    check(label+'_no_page_overflow', layout['scroll']<=layout['width'], layout)
    check(label+'_cards_fit', all(card['x']>=-.5 and card['right']<=layout['width']+.5 for card in layout['cards']))
    check(label+'_reference_rounded_cards', all(float(card['radius'].removesuffix('px'))>0 for card in layout['cards']))

def anchors_work(page, label):
    targets = page.locator('.site-header__nav a').evaluate_all('(links)=>links.map(a=>a.getAttribute("href"))')
    check(label+'_six_module_navigation', targets==['#home','#about','#work','#interests','#games','#contact'], targets)
    unique = page.evaluate('''targets=>targets.every(h=>document.querySelectorAll('[id="'+h.slice(1)+'"]').length===1)''', targets)
    check(label+'_unique_working_targets', unique)

def expect_content(page, label, *, fixture=False):
    check(label+'_simplified_language', page.locator('html').get_attribute('lang')=='zh-CN')
    check(label+'_simplified_locale', page.locator('meta[property="og:locale"]').get_attribute('content')=='zh_CN')
    for selector in ('#about','#work','#interests','#games','#contact','footer'):
        check(label+'_section_'+selector.removeprefix('#'), page.locator(selector).count()==1)
    for title in ('兴趣图鉴','火影忍者','名侦探柯南','游戏基地','王者荣耀','社交坐标'):
        check(label+'_title_'+title, title in page.locator('main').inner_text())
    body = page.locator('body').inner_text()
    check(label+'_no_traditional_live_copy', not any(word in body for word in ('關於我','歡迎','遊戲','社群','公開專案','載入','製作','搜尋')), body[:200])
    check(label+'_real_projects_retained', page.locator('a[href="https://github.com/fknejdcwnfi/website"]').count()>=1 and page.locator('a[href="https://github.com/fknejdcwnfi/xiangqi-review"]').count()==1)
    check(label+'_no_embedded_services', page.locator('iframe,embed,object').count()==0)
    check(label+'_no_executable_or_empty_links', page.locator('a[href^="javascript:"],a[href^="data:"],a[href="undefined"],a[href=""]').count()==0)
    if not fixture:
        check(label+'_accounts_wait_for_owner', page.locator('.social-card').count()==2 and page.locator('[data-platform="wechat"],[data-platform="qq"]').count()==0)
        check(label+'_no_invented_player_data', page.locator('#games .game-showcase__details,.showcase-block').count()==0)
        check(label+'_no_fixture_content', 'QA_ONLY' not in body and 'QA_PLAYER_ID' not in body)
    anchors_work(page,label)

fixture_server = None
try:
    if not args.skip_fixture_build:
        result = subprocess.run(['node','scripts/qa/build_profile_fixture.mjs'], cwd=ROOT, capture_output=True, text=True)
        (args.output/'fixture-build.log').write_text(result.stdout+result.stderr)
        check('isolated_fixture_build', result.returncode==0, result.returncode)
    fixture_metadata = json.loads((ROOT/'work/profile-fixture-dist/website/.qa-fixture.json').read_text())
    check('fixture_explicitly_synthetic', fixture_metadata['syntheticOnly'] and not fixture_metadata['productionContentChanged'])
    parsed = urlsplit(args.fixture_url)
    if parsed.hostname not in ('127.0.0.1','localhost'):
        raise ValueError('Only a local fixture server is supported.')
    port = parsed.port or 80
    with socket.socket() as probe:
        check('fixture_port_available', probe.connect_ex((parsed.hostname,port))!=0)
    fixture_server = subprocess.Popen(['python3','-m','http.server',str(port),'--bind','127.0.0.1','--directory',str(ROOT/'work/profile-fixture-dist')], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    deadline = time.monotonic()+10
    while time.monotonic()<deadline:
        with socket.socket() as probe:
            if probe.connect_ex((parsed.hostname,port))==0: break
        time.sleep(.05)
    else: raise RuntimeError('Local fixture server did not start.')

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        def context(**options):
            ctx = browser.new_context(**options)
            def track(page):
                page.on('pageerror',lambda error:report['browserErrors'].append(str(error)))
                page.on('response',lambda response:report['unexpectedResponses'].append({'status':response.status,'url':response.url}) if response.status>=400 else None)
                page.on('request',lambda request:report['externalRequests'].append(request.url) if urlsplit(request.url).scheme in ('http','https') and urlsplit(request.url).hostname not in ('127.0.0.1','localhost') else None)
            ctx.on('page',track)
            return ctx
        ctx = context(viewport={'width':1440,'height':1100})
        page = ctx.new_page();response=page.goto(args.url)
        page.wait_for_selector(CANVAS+'[data-ready=true][data-playback=looping]')
        check('production_http_200', response.status==200)
        expect_content(page,'desktop')
        no_overflow(page,'desktop')
        check('portrait_still_circle',page.locator('.reference-scene__viewport').evaluate('e=>{const s=getComputedStyle(e);return s.borderRadius==="50%"&&s.borderTopWidth==="0px"&&s.boxShadow==="none"}'))
        check('portrait_still_pixelated',page.locator(CANVAS).evaluate('c=>getComputedStyle(c).imageRendering==="pixelated"&&!c.getContext("2d").imageSmoothingEnabled'))
        initial=page.locator(CANVAS).evaluate('c=>({frame:c.dataset.sourceFrame,time:Number(c.dataset.snowTimeMs),pixels:c.toDataURL()})')
        page.wait_for_timeout(190)
        after=page.locator(CANVAS).evaluate('c=>({frame:c.dataset.sourceFrame,time:Number(c.dataset.snowTimeMs),pixels:c.toDataURL()})')
        check('portrait_and_weather_continue',after['time']>initial['time'] and after['frame']!=initial['frame'] and after['pixels']!=initial['pixels'])
        check('snow_and_petals_preserved',page.locator(CANVAS).get_attribute('data-snow-particles')=='448' and page.locator(CANVAS).get_attribute('data-petal-particles')=='60')
        page.locator('#contact').scroll_into_view_if_needed()
        page.wait_for_selector(CANVAS+'[data-playback=suspended]')
        paused=page.locator(CANVAS).get_attribute('data-snow-time-ms')
        page.wait_for_timeout(150)
        check('offscreen_portrait_pauses',page.locator(CANVAS).get_attribute('data-snow-time-ms')==paused)
        page.evaluate('scrollTo(0,0)');page.wait_for_selector(CANVAS+'[data-playback=looping]')
        search=page.get_by_role('searchbox',name='搜索此网站')
        for query,target in [('火影','#interest-naruto'),('柯南','#interest-detective-conan'),('王者荣耀','#game-honor-of-kings')]:
            search.fill(query)
            page.locator('#site-search-results a').filter(has_text=query).first.wait_for()
            link=page.locator('#site-search-results a').filter(has_text=query).first
            check('search_target_'+query,link.get_attribute('href')==target)
            link.click();page.wait_for_timeout(20)
            check('search_focus_'+query,page.evaluate('document.activeElement.id')==target[1:])
        page.evaluate('scrollTo(0,0)')
        page.screenshot(path=str(args.output/'desktop.png'),full_page=True)
        page.locator('#interests').screenshot(path=str(args.output/'interests.png'))
        page.locator('#games').screenshot(path=str(args.output/'games-empty-profile.png'))
        page.locator('#contact').screenshot(path=str(args.output/'social-known-only.png'))
        ctx.close()

        for width in (320,390,768):
            ctx=context(viewport={'width':width,'height':900},device_scale_factor=2)
            page=ctx.new_page();page.goto(args.url);page.wait_for_selector(CANVAS+'[data-ready=true]')
            expect_content(page,f'mobile{width}');no_overflow(page,f'mobile{width}')
            if width<1200:
                page.locator('.mobile-contents summary').click()
                page.locator('.mobile-contents a[href="#games"]').click()
                check(f'mobile{width}_contents_navigate',page.url.endswith('#games'))
            if width==390:page.screenshot(path=str(args.output/'mobile.png'),full_page=True)
            ctx.close()

        ctx=context(reduced_motion='reduce',viewport={'width':1440,'height':1100})
        requests=[];page=ctx.new_page();page.on('request',lambda request:requests.append(request.url))
        page.goto(args.url);page.wait_for_selector(CANVAS+'[data-playback=static]')
        check('reduced_motion_avoids_animation_downloads',not any('/boot.mp4' in url or '/atlas.png' in url for url in requests))
        page.get_by_role('button',name='开启动态',exact=True).click()
        page.wait_for_selector(CANVAS+'[data-playback=looping]');check('simplified_motion_opt_in')
        page.get_by_role('button',name='跟随系统',exact=True).click()
        page.wait_for_selector(CANVAS+'[data-playback=static]');check('simplified_motion_choice_reversible')
        ctx.close()

        ctx=context(viewport={'width':1440,'height':1100})
        ctx.route('**/assets/index-*.js',lambda route:route.abort())
        ctx.route('**/assets/poetic-pixel/boot.mp4*',lambda route:route.abort())
        page=ctx.new_page();page.goto(args.url,wait_until='domcontentloaded')
        page.wait_for_selector('#vermouth-poetic-entry[data-motion=running]')
        before=page.locator('.reference-scene__viewport').screenshot(animations='allow')
        page.wait_for_timeout(220)
        after=page.locator('.reference-scene__viewport').screenshot(animations='allow')
        check('first_entry_weather_moves_without_module_or_movie',before!=after)
        check('blocked_application_keeps_new_modules',page.locator('#interests,#games,#contact').count()==3)
        page.locator('.reference-scene__viewport').screenshot(path=str(args.output/'entry-without-media.png'),animations='allow')
        ctx.close()

        ctx=context(java_script_enabled=False,viewport={'width':1440,'height':1100})
        page=ctx.new_page();page.goto(args.url)
        expect_content(page,'nojs')
        check('nojs_no_dead_copy_controls',page.locator('.social-copy').count()==0)
        page.screenshot(path=str(args.output/'no-javascript.png'),full_page=True)
        ctx.close()

        clipboard_success='''window.__copied=[];Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>{window.__copied.push(value)}}});'''
        ctx=context(viewport={'width':1440,'height':1100});ctx.add_init_script(clipboard_success)
        page=ctx.new_page();page.goto(args.fixture_url);page.wait_for_selector(CANVAS+'[data-ready=true]')
        expect_content(page,'fixture',fixture=True);no_overflow(page,'fixture')
        check('fixture_accounts_and_qr_present',page.locator('#contact-wechat-qa,#contact-qq-qa').count()==2 and page.locator('#contact-wechat-qa .social-qr').count()==1)
        check('fixture_invalid_profiles_hidden',page.locator('#contact-empty-account,#contact-unsafe-link-only,#game-empty-game,#game-unsafe-game-link-only').count()==0)
        check('fixture_link_only_game_visible',page.locator('#game-link-only-qa a[href="https://example.com/qa/game-only"]').count()==1 and page.locator('#game-link-only-qa .game-showcase__details,#game-link-only-qa .showcase-block').count()==0)
        check('fixture_region_without_player_id',page.locator('#game-region-only-qa dt').all_text_contents()==['区服'] and page.locator('#game-region-only-qa dd').inner_text()=='QA 区服（无玩家ID）')
        check('fixture_bad_media_filtered',page.locator('#contact-unsafe-qr .social-qr').count()==0 and page.locator('img[src*="private"],img[src^="https:"]').count()==0)
        check('fixture_html_is_text',page.evaluate('window.__fixtureInjected===undefined') and page.locator('#interest-naruto script,#game-honor-of-kings img[onerror]').count()==0)
        check('fixture_note_escaped', '<script>window.__fixtureInjected=1</script>' in page.locator('#interest-naruto').inner_text())
        summaries=page.locator('#game-honor-of-kings .showcase-block > summary').all_text_contents()
        check('fixture_blocks_keep_order_and_omit_empty',summaries==['游戏手记','自定义数据','角色收藏','截图相册','精彩片段'],summaries)
        check('fixture_owner_controls_initial_expansion',page.locator('#game-honor-of-kings .showcase-block[open] > summary').all_text_contents()==['游戏手记'])
        for block in page.locator('#game-honor-of-kings .showcase-block').all():
            if block.get_attribute('open') is None:block.locator('summary').click()
        check('fixture_all_five_block_contents',all(text in page.locator('#games').inner_text() for text in ('QA_NARRATIVE','QA 段位（非真实）','QA 英雄','QA 战绩截图','QA 精彩视频')))
        page.wait_for_function('document.querySelector(".showcase-gallery img")?.naturalWidth===240')
        check('fixture_gallery_local_and_loaded',page.locator('.showcase-gallery img').count()==1 and page.locator('.showcase-gallery img').evaluate('e=>e.complete&&e.naturalWidth===240'))
        check('fixture_video_is_safe_link',page.locator('a[href="https://example.com/qa/video"]').count()==1 and page.locator('iframe,video:not(#vermouth-poetic-bootstrap)').count()==0)
        page.get_by_role('button',name='复制微信测试账号账号',exact=True).click()
        page.locator('#contact-wechat-qa [role="status"]').filter(has_text='已复制微信测试账号').wait_for()
        check('clipboard_success_after_real_promise',page.evaluate('window.__copied')==['WECHAT_QA_ONLY'])
        qr=page.locator('#contact-wechat-qa .social-qr summary');qr.focus();page.keyboard.press('Enter')
        check('qr_keyboard_disclosure',page.locator('#contact-wechat-qa .social-qr').get_attribute('open') is not None)
        page.locator('#contact-wechat-qa .social-qr img').wait_for(state='visible')
        page.wait_for_function('document.querySelector("#contact-wechat-qa .social-qr img").naturalWidth===240')
        check('qr_local_media_loaded',page.locator('#contact-wechat-qa .social-qr img').get_attribute('src')=='/website/qa-profile/media-test.png')
        qr_heights=page.evaluate('()=>({wechat:document.querySelector("#contact-wechat-qa").getBoundingClientRect().height,qq:document.querySelector("#contact-qq-qa").getBoundingClientRect().height})')
        check('qr_expands_without_stretching_neighbor',qr_heights['wechat']>qr_heights['qq']+100,qr_heights)
        search=page.get_by_role('searchbox',name='搜索此网站');search.fill('QA_NARRATIVE')
        check('custom_block_text_searchable',page.locator('#site-search-results a').first.get_attribute('href')=='#game-honor-of-kings')
        search.fill('WECHAT_QA_ONLY');check('custom_social_text_searchable',page.locator('#site-search-results a').first.get_attribute('href')=='#contact')
        page.keyboard.press('Escape')
        page.locator('#game-honor-of-kings').screenshot(path=str(args.output/'fixture-game-customization.png'))
        page.locator('#contact').screenshot(path=str(args.output/'fixture-social-customization.png'))
        page.locator('#game-link-only-qa').screenshot(path=str(args.output/'fixture-link-only-game.png'))
        fixture_texts={s:page.locator(s).inner_text() for s in ('#interest-naruto','#game-honor-of-kings','#game-link-only-qa','#game-region-only-qa','#contact-wechat-qa','#contact-qq-qa')}
        ctx.close()

        ctx=context(viewport={'width':320,'height':900});ctx.add_init_script("Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('QA denied')}}});")
        page=ctx.new_page();page.goto(args.fixture_url);page.wait_for_selector(CANVAS+'[data-ready=true]')
        for block in page.locator('.showcase-block').all():
            if block.get_attribute('open') is None:block.locator('summary').click()
        page.locator('#contact-wechat-qa .social-qr summary').click()
        no_overflow(page,'fixture320_all_open')
        page.get_by_role('button',name='复制QQ测试账号账号',exact=True).click()
        page.locator('#contact-qq-qa [role="status"]').filter(has_text='未能自动复制').wait_for()
        check('clipboard_denial_truthful_status','已复制' not in page.locator('#contact-qq-qa [role="status"]').inner_text())
        check('clipboard_denial_selects_visible_account',page.evaluate('getSelection().toString()')=='QQ_QA_ONLY')
        check('clipboard_denial_restores_control',page.get_by_role('button',name='复制QQ测试账号账号',exact=True).is_enabled())
        page.screenshot(path=str(args.output/'fixture-mobile-all-open.png'),full_page=True)
        ctx.close()

        ctx=context(java_script_enabled=False,viewport={'width':1440,'height':1100})
        page=ctx.new_page();page.goto(args.fixture_url)
        expect_content(page,'fixture_nojs',fixture=True)
        check('fixture_nojs_no_dead_copy_controls',page.locator('.social-copy').count()==0)
        for block in page.locator('.showcase-block').all():
            if block.get_attribute('open') is None:block.locator('summary').click()
        page.locator('#contact-wechat-qa .social-qr summary').click()
        check('fixture_nojs_accounts_still_readable',all(value in page.locator('#contact').inner_text() for value in ('WECHAT_QA_ONLY','QQ_QA_ONLY')))
        check('fixture_nojs_custom_blocks_still_work',page.locator('.showcase-block[open]').count()==5 and page.locator('.showcase-gallery img').count()==1)
        for selector,react_text in fixture_texts.items():
            static_text=page.locator(selector).inner_text()
            # Copy controls/status are progressive enhancement; semantic data are shared.
            for line in react_text.splitlines():
                line=line.strip()
                if line and line not in ('复制账号','已复制微信测试账号'):
                    check('fixture_static_parity_'+selector+'_'+line[:24],line in static_text)
        page.screenshot(path=str(args.output/'fixture-no-javascript.png'),full_page=True)
        ctx.close()
        browser.close()
    check('no_browser_errors',not report['browserErrors'],report['browserErrors'])
    check('no_unexpected_http_errors',not report['unexpectedResponses'],report['unexpectedResponses'])
    check('no_remote_fetches_or_embeds',not report['externalRequests'],report['externalRequests'])
    report['status']='passed';save()
    print(json.dumps({'status':'passed','checks':len(report['checks']),'browserErrors':report['browserErrors'],'output':str(args.output)},ensure_ascii=False))
finally:
    if fixture_server:
        fixture_server.terminate()
        with contextlib.suppress(subprocess.TimeoutExpired):fixture_server.wait(timeout=5)
        if fixture_server.poll() is None:fixture_server.kill()
    save()
