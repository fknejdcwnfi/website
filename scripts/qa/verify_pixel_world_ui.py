#!/usr/bin/env python3
"""Verify the reference-driven UI, active navigation and retained portrait nodes."""
import argparse
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url', default='http://127.0.0.1:5180/website/')
parser.add_argument('--output', type=Path, default=ROOT/'artifacts/pixel-world-ui')
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)
report = {'status': 'failed', 'checks': [], 'browserErrors': [], 'badResponses': [], 'layouts': []}

def save():
    (args.output/'checks.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')

def check(name, passed, detail=None):
    report['checks'].append({'name': name, 'passed': bool(passed), 'detail': detail})
    save()
    assert passed, (name, detail)

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    ctx = browser.new_context(viewport={'width': 1672, 'height': 941})
    page = ctx.new_page()
    page.on('pageerror', lambda e: report['browserErrors'].append(str(e)))
    page.on('response', lambda r: report['badResponses'].append({'url': r.url, 'status': r.status}) if r.status >= 400 else None)
    response = page.goto(args.url)
    page.wait_for_selector('.reference-scene__canvas[data-ready=true][data-playback=looping]')
    page.evaluate('document.fonts.ready')
    check('production_http_200', response.status == 200)
    check('scenic_background_loaded', page.evaluate("getComputedStyle(document.querySelector('.personal-site'),'::before').backgroundImage.includes('twilight-world.png')"))
    check('real_portrait_and_weather', page.locator('.reference-scene__canvas').evaluate("c=>c.dataset.snowParticles==='448'&&c.dataset.petalParticles==='60'&&getComputedStyle(c).imageRendering==='pixelated'"))
    page.evaluate("window.__qaCanvas=document.querySelector('.reference-scene__canvas');window.__qaVideo=document.getElementById('vermouth-poetic-bootstrap')")
    page.screenshot(path=str(args.output/'home-desktop.png'))
    for section in ['about', 'work', 'interests', 'games', 'contact', 'home']:
        page.locator(f'.site-header__nav a[href="#{section}"]').click()
        page.wait_for_function('(s)=>document.querySelector(".personal-site").dataset.activeSection===s', arg=section)
        check('active_navigation_'+section, page.locator(f'.site-header__nav a[href="#{section}"]').get_attribute('aria-current') == 'location')
        check('sidebar_and_toc_'+section, page.locator(f'.site-sidebar a[href="#{section}"][aria-current],.site-toc nav a[href="#{section}"][aria-current]').count() == 2)
        check('retained_portrait_'+section, page.evaluate("window.__qaCanvas===document.querySelector('.reference-scene__canvas')&&window.__qaVideo===document.getElementById('vermouth-poetic-bootstrap')"))
        if section in ['about', 'interests', 'contact']:
            page.screenshot(path=str(args.output/(section+'-desktop.png')))
    for width in [320, 390, 768, 1100, 1200, 1440, 1672]:
        page.set_viewport_size({'width': width, 'height': 941})
        page.wait_for_timeout(100)
        layout = page.evaluate('''()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,
          table:[document.querySelector('.project-table').scrollWidth,document.querySelector('.project-table-wrap').clientWidth],
          header:[document.querySelector('.site-header__nav').scrollWidth,document.querySelector('.site-header__nav').clientWidth],
          cards:[...document.querySelectorAll('.interest-card,.game-showcase,.social-card')].map(e=>{const r=e.getBoundingClientRect();return [r.x,r.right]})})''')
        report['layouts'].append(layout)
        check(f'width_{width}_no_page_overflow', layout['scroll'] <= width, layout)
        check(f'width_{width}_table_not_clipped', layout['table'][0] <= layout['table'][1]+2, layout)
        check(f'width_{width}_navigation_fits', layout['header'][0] <= layout['header'][1], layout)
        check(f'width_{width}_cards_fit', all(x >= 0 and right <= width for x, right in layout['cards']), layout)
        if width == 390:
            page.screenshot(path=str(args.output/'home-mobile.png'))
            page.locator('.site-header__nav a[href="#interests"]').click()
            page.screenshot(path=str(args.output/'interests-mobile.png'))
            page.locator('.site-header__nav a[href="#home"]').click()
    check('no_browser_errors', not report['browserErrors'], report['browserErrors'])
    check('no_failed_assets', not report['badResponses'], report['badResponses'])
    ctx.close()
    ctx = browser.new_context(java_script_enabled=False, viewport={'width': 390, 'height': 844})
    page = ctx.new_page()
    page.goto(args.url)
    check('no_js_same_world', page.locator('.hero__highlight').inner_text() == '像素小世界' and page.locator('.interest-card__scene').count() == 2)
    check('no_js_all_content', all(page.locator('#'+s).count() == 1 for s in ['home', 'about', 'work', 'interests', 'games', 'contact']))
    page.screenshot(path=str(args.output/'no-javascript.png'), full_page=True)
    ctx.close()
    browser.close()

report['status'] = 'passed'
save()
print(json.dumps({'status': 'passed', 'checks': len(report['checks']), 'output': str(args.output)}))
