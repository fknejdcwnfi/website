#!/usr/bin/env python3
"""Check the minimal pixel UI, real local typography and stable scene identity.

Run against the production preview for either hosting base. This script does not
replace content or rebuild the website. Prior ornate-theme evidence stays intact.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from urllib.parse import urlsplit

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
CANVAS = '.reference-scene__canvas'
SECTIONS = ['home', 'about', 'work', 'interests', 'games', 'contact']
FONT_FAMILY = 'Fusion Pixel'
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url', default='http://127.0.0.1:5180/website/')
parser.add_argument('--output', type=Path, default=ROOT / 'artifacts/pixel-minimal-ui')
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)
report = {
    'status': 'failed', 'productionUrl': args.url, 'fontFamily': FONT_FAMILY,
    'checks': [], 'browserErrors': [], 'badResponses': [], 'requests': [],
    'layouts': [], 'fonts': [],
}


def save():
    (args.output / 'checks.json').write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + '\n')


def check(name, passed, detail=None):
    report['checks'].append({'name': name, 'passed': bool(passed), 'detail': detail})
    save()
    if not passed:
        raise AssertionError((name, detail))


def fonts_work(page, label):
    page.evaluate('document.fonts.ready')
    # FontFaceSet.check alone can succeed when the named face is absent. Require
    # a registered, loaded face too, then check representative Latin and Chinese.
    fonts = page.evaluate('''family => ({
      registered: [...document.fonts].filter(f => f.family.replaceAll('"', '').toLowerCase() === family.toLowerCase())
        .map(f => ({family:f.family,status:f.status,weight:f.weight,unicodeRange:f.unicodeRange})),
      latin: document.fonts.check('16px "' + family + '"', 'HELLOWORLD fknejdcwnfi'),
      chinese: document.fonts.check('16px "' + family + '"', '欢迎像素世界作品兴趣游戏社交'),
      elements: [...document.querySelectorAll('body,.personal-site,.personal-site h1,.personal-site h2,.personal-site h3,.personal-site p,.personal-site a,.personal-site input,.personal-site button,.personal-site kbd,.personal-site summary,.reference-scene__status,.site-startup-status')]
        .map(e => ({tag:e.tagName,class:e.className,font:getComputedStyle(e).fontFamily}))
    })''', FONT_FAMILY)
    report['fonts'].append({'label': label, **fonts})
    check(label + '_registered_pixel_face_loaded',
          any(face['status'] == 'loaded' for face in fonts['registered']), fonts['registered'])
    check(label + '_latin_and_chinese_face_ready', fonts['latin'] and fonts['chinese'])
    wrong = [e for e in fonts['elements'] if FONT_FAMILY.lower() not in e['font'].lower()]
    check(label + '_pixel_type_on_all_ui_and_status', not wrong, wrong)


def plain_chrome(page, label):
    info = page.evaluate(r'''() => {
      const visible=e=>!!(e.getClientRects().length)&&getComputedStyle(e).visibility!=='hidden';
      const chrome=[...document.querySelectorAll('.site-header,.site-sidebar,.site-toc,.mobile-contents,.personal-section__label,.hero__copy h1,.welcome-note__title,figcaption,.site-footer')]
        .filter(visible).map(e=>e.innerText);
      const emoji=/[\u{1F000}-\u{1FAFF}\u2600-\u27BF\uFE0F]/u;
      const world=document.querySelector('.personal-site'),figure=document.querySelector('.hero__visual');
      const pseudo=(e,p)=>{const s=getComputedStyle(e,p);return {content:s.content,display:s.display,image:s.backgroundImage,border:s.borderTopWidth,shadow:s.boxShadow}};
      const panels=[...document.querySelectorAll('.hero,.personal-section,.site-sidebar,.site-toc,.interest-card,.game-showcase,.social-card')]
        .map(e=>({class:e.className,image:getComputedStyle(e).backgroundImage,borderImage:getComputedStyle(e).borderImageSource}));
      return {emoji:chrome.filter(t=>emoji.test(t)),background:getComputedStyle(world).backgroundImage,
        before:pseudo(world,'::before'),after:pseudo(world,'::after'),ring:pseudo(figure,'::before'),panels,
        visibleOrnaments:[...document.querySelectorAll('.pixel-lantern,.grass-block,.interest-card__scene,.game-showcase__scene')].filter(visible).map(e=>e.className),
        headings:[...document.querySelectorAll('.personal-section__label h2')].map(e=>({text:e.innerText,svg:!!e.querySelector('svg')}))};
    }''')
    check(label + '_no_emoji_fallback_in_chrome', not info['emoji'], info['emoji'])
    check(label + '_svg_section_icons', bool(info['headings']) and
          all(h['svg'] for h in info['headings']), info['headings'])
    check(label + '_plain_page_background', info['background'] == 'none' and
          all(info[p]['image'] == 'none' for p in ['before', 'after']), info)
    ring = info['ring']
    check(label + '_no_decorative_portrait_ring',
          ring['content'] in ('none', 'normal') or ring['display'] == 'none' or
          (ring['border'] == '0px' and ring['shadow'] == 'none' and ring['image'] == 'none'), ring)
    check(label + '_no_ornate_panels_or_scene_layers', not info['visibleOrnaments'] and
          all(p['image'] == 'none' and p['borderImage'] == 'none' for p in info['panels']), info)


def nav_targets(page, label):
    for selector in ['.site-header__nav', '.site-sidebar nav']:
        targets = page.locator(selector + ' a').evaluate_all('(as)=>as.map(a=>a.getAttribute("href"))')
        check(label + '_six_targets_' + selector, targets == ['#' + s for s in SECTIONS], targets)
    check(label + '_unique_sections', all(page.locator('#' + s).count() == 1 for s in SECTIONS))


def active_navigation(page, prefix, label):
    for section in ['about', 'work', 'interests', 'games', 'contact', 'home']:
        page.locator(f'{prefix} a[href="#{section}"]').click()
        # Wait beyond the queued scroll/highlight update: an immediate React
        # state change alone must not hide a later bottom-of-document race.
        page.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
        page.wait_for_function(
            's=>document.querySelector(".personal-site").dataset.activeSection===s', arg=section)
        check(label + '_active_' + section,
              page.locator(f'{prefix} a[href="#{section}"]').get_attribute('aria-current') == 'location')
        check(label + '_same_scene_nodes_' + section, page.evaluate('''() =>
          window.__qaCanvas===document.querySelector('.reference-scene__canvas') &&
          window.__qaVideo===document.getElementById('vermouth-poetic-bootstrap')'''))

    # A short games section can clamp at the bottom. Explicit navigation should
    # stay on games; manual scrolling releases that choice even though the hash
    # remains, and clicking that same hash again must still work.
    page.locator(f'{prefix} a[href="#games"]').click()
    page.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
    page.wait_for_function('document.querySelector(".personal-site").dataset.activeSection==="games"')
    page.evaluate('scrollTo(0,0)')
    page.wait_for_function('document.querySelector(".personal-site").dataset.activeSection==="home"')
    check(label + '_manual_scroll_releases_anchor_choice',
          page.url.endswith('#games') and page.evaluate('scrollY===0'))
    page.locator(f'{prefix} a[href="#games"]').click()
    page.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
    page.wait_for_function('document.querySelector(".personal-site").dataset.activeSection==="games"&&scrollY>0')
    check(label + '_same_hash_can_navigate_again', page.url.endswith('#games'))
    page.locator(f'{prefix} a[href="#home"]').click()
    page.wait_for_function('document.querySelector(".personal-site").dataset.activeSection==="home"')
    check(label + '_same_nodes_after_same_hash_and_manual_scroll', page.evaluate('''() =>
      window.__qaCanvas===document.querySelector('.reference-scene__canvas') &&
      window.__qaVideo===document.getElementById('vermouth-poetic-bootstrap')'''))
    page.wait_for_selector(CANVAS + '[data-playback=looping]')


try:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])

        def context(**options):
            ctx = browser.new_context(**options)

            def track(page):
                page.on('pageerror', lambda e: report['browserErrors'].append(str(e)))
                page.on('request', lambda r: report['requests'].append(r.url))
                page.on('response', lambda r: report['badResponses'].append(
                    {'url': r.url, 'status': r.status}) if r.status >= 400 else None)
            ctx.on('page', track)
            return ctx

        ctx = context(viewport={'width': 1440, 'height': 1100})
        page = ctx.new_page()
        response = page.goto(args.url)
        page.wait_for_selector(CANVAS + '[data-ready=true][data-playback=looping]')
        check('production_http_200', response.status == 200)
        fonts_work(page, 'desktop')
        plain_chrome(page, 'desktop')
        nav_targets(page, 'desktop')
        check('desktop_sidebar_navigation_visible', page.locator('.site-sidebar').is_visible())
        check('desktop_repeated_header_nav_hidden', not page.locator('.site-header__nav').is_visible())
        check('right_toc_hidden', not page.locator('.site-toc').is_visible())
        check('real_pixel_portrait_and_weather', page.locator(CANVAS).evaluate('''c =>
          c.dataset.snowParticles==='448' && c.dataset.petalParticles==='60' &&
          getComputedStyle(c).imageRendering==='pixelated' && !c.getContext('2d').imageSmoothingEnabled'''))
        check('borderless_original_circle', page.locator('.reference-scene__viewport').evaluate('''e=>{
          const s=getComputedStyle(e);return s.borderRadius==='50%'&&s.borderTopWidth==='0px'&&s.boxShadow==='none'}'''))
        page.evaluate('''window.__qaCanvas=document.querySelector('.reference-scene__canvas');
          window.__qaVideo=document.getElementById('vermouth-poetic-bootstrap')''')
        page.screenshot(path=str(args.output / 'home-desktop.png'))
        active_navigation(page, '.site-sidebar nav', 'desktop')
        page.locator('.site-sidebar a[href="#interests"]').click()
        page.screenshot(path=str(args.output / 'interests-desktop.png'))
        page.locator('.site-sidebar a[href="#home"]').click()

        # Exercise local search and keyboard behavior rather than only its CSS.
        page.keyboard.press('/')
        check('keyboard_search_shortcut', page.locator('#site-search').evaluate('e=>e===document.activeElement'))
        page.locator('#site-search').fill('柯南')
        result = page.locator('#site-search-results a[href="#interest-detective-conan"]')
        result.wait_for()
        result.click()
        page.wait_for_function('document.activeElement.id==="interest-detective-conan"')
        check('search_preserves_target_focus', True)
        page.locator('#site-search').fill('no-matching-pixel-ui-314159')
        check('search_empty_feedback', page.locator('.site-search__empty').is_visible())
        page.keyboard.press('Escape')
        check('escape_closes_search', page.locator('#site-search-results').count() == 0)
        page.locator('#site-search').fill('')
        page.keyboard.press('Escape')

        for width in [320, 390, 768, 1100, 1200, 1440, 1672]:
            page.set_viewport_size({'width': width, 'height': 1100})
            page.evaluate('document.fonts.ready')
            page.wait_for_timeout(100)
            layout = page.evaluate('''()=>{
              const nav=document.querySelector('.site-header__nav');
              return {width:innerWidth,scroll:document.documentElement.scrollWidth,
                table:[document.querySelector('.project-table').scrollWidth,document.querySelector('.project-table-wrap').clientWidth],
                headerVisible:!!nav.getClientRects().length,header:[nav.scrollWidth,nav.clientWidth],
                cards:[...document.querySelectorAll('.interest-card,.game-showcase,.social-card')].map(e=>{const r=e.getBoundingClientRect();return [r.x,r.right]})};
            }''')
            report['layouts'].append(layout)
            check(f'width_{width}_no_page_overflow', layout['scroll'] <= width, layout)
            check(f'width_{width}_table_not_clipped', layout['table'][0] <= layout['table'][1] + 2, layout)
            check(f'width_{width}_visible_navigation_fits', not layout['headerVisible'] or
                  layout['header'][0] <= layout['header'][1], layout)
            check(f'width_{width}_cards_fit', all(x >= -.5 and right <= width + .5 for x, right in layout['cards']), layout)
            if width == 390:
                check('mobile_header_navigation_visible', page.locator('.site-header__nav').is_visible())
                check('mobile_sidebar_hidden', not page.locator('.site-sidebar').is_visible())
                active_navigation(page, '.site-header__nav', 'mobile')
                fonts_work(page, 'mobile')
                plain_chrome(page, 'mobile')
                page.screenshot(path=str(args.output / 'home-mobile.png'))

        # Fixed rails must remain usable in landscape/zoomed desktop windows.
        # Playwright's real click scrolls the rail as a keyboard/user action can;
        # verify the final item is physically visible, not just present in DOM.
        page.set_viewport_size({'width': 1440, 'height': 400})
        last_link = page.locator('.site-sidebar nav a[href="#contact"]')
        last_link.click()
        page.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
        page.wait_for_function('document.querySelector(".personal-site").dataset.activeSection==="contact"')
        rail = last_link.evaluate('''e=>{
          const r=e.getBoundingClientRect(),rail=e.closest('.site-sidebar').getBoundingClientRect();
          return {top:r.top,bottom:r.bottom,railTop:rail.top,railBottom:rail.bottom,height:innerHeight,
            current:e.getAttribute('aria-current')};
        }''')
        check('short_desktop_last_nav_item_visible',
              rail['top'] >= max(0, rail['railTop']) - .5 and
              rail['bottom'] <= min(rail['height'], rail['railBottom']) + .5, rail)
        check('short_desktop_contact_active', rail['current'] == 'location', rail)
        page.screenshot(path=str(args.output / 'short-desktop-navigation.png'))
        ctx.close()

        # Reduced-motion controls expose live status/button typography and retain
        # the existing reversible user choice without changing renderer behavior.
        ctx = context(reduced_motion='reduce', viewport={'width': 390, 'height': 844})
        page = ctx.new_page()
        page.goto(args.url)
        page.wait_for_selector(CANVAS + '[data-playback=static]')
        fonts_work(page, 'reduced_motion')
        check('reduced_motion_control_visible', page.get_by_role('button', name='开启动态', exact=True).is_visible())
        page.get_by_role('button', name='开启动态', exact=True).click()
        page.wait_for_selector(CANVAS + '[data-playback=looping]')
        page.get_by_role('button', name='跟随系统', exact=True).click()
        page.wait_for_selector(CANVAS + '[data-playback=static]')
        check('reduced_motion_choice_reversible', True)
        ctx.close()

        ctx = context(java_script_enabled=False, viewport={'width': 390, 'height': 844})
        page = ctx.new_page()
        page.goto(args.url)
        fonts_work(page, 'nojs')
        plain_chrome(page, 'nojs')
        nav_targets(page, 'nojs')
        check('nojs_complete_content', all(page.locator('#' + s).count() == 1 for s in SECTIONS))
        check('nojs_original_poster_loaded', page.locator('.reference-scene__poster').first.evaluate(
            'e=>e.complete&&e.naturalWidth===2864&&e.naturalHeight===2136'))
        check('nojs_no_dead_search_or_copy_controls', page.locator('#site-search,.social-copy').count() == 0)
        page.locator('.site-header__nav a[href="#games"]').click()
        check('nojs_anchor_navigation', page.url.endswith('#games'))
        page.screenshot(path=str(args.output / 'no-javascript.png'), full_page=True)
        ctx.close()
        browser.close()

    old_assets = [url for url in report['requests'] if '/assets/pixel-ui/' in urlsplit(url).path]
    check('no_ornate_asset_requests', not old_assets, old_assets)
    check('no_browser_errors', not report['browserErrors'], report['browserErrors'])
    check('no_failed_assets', not report['badResponses'], report['badResponses'])
    report['status'] = 'passed'
finally:
    save()

print(json.dumps({'status': report['status'], 'checks': len(report['checks']), 'output': str(args.output)}))
