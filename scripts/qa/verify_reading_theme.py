#!/usr/bin/env python3
"""Check the warm reading hierarchy, layout, no-JS parity and preserved scene."""
import argparse
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url', required=True)
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)
report = {'status': 'failed', 'url': args.url, 'checks': [], 'layouts': [], 'errors': []}


def check(name, condition, detail=None):
    report['checks'].append({'name': name, 'passed': bool(condition), 'detail': detail})
    (args.output/'checks.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
    if not condition:
        raise AssertionError((name, detail))


def surfaces(page):
    return page.evaluate('''() => [...document.querySelectorAll('#about,#work,.journal-entry,.interest-card,.social-card')].map(e=>{
      const s=getComputedStyle(e);return {id:e.id,background:s.backgroundColor,image:s.backgroundImage,
        color:s.color,font:s.fontFamily,border:s.borderTopWidth,radius:s.borderTopLeftRadius,
        padding:parseFloat(s.paddingLeft)};
    })''')


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    ctx = browser.new_context(viewport={'width': 1440, 'height': 1100}, reduced_motion='reduce')
    page = ctx.new_page()
    page.on('pageerror', lambda error: report['errors'].append(str(error)))
    response = page.goto(args.url)
    check('production_http_200', response.status == 200)
    page.wait_for_selector('.personal-site:not(.static-site)')
    page.evaluate('() => document.fonts.ready')
    info = surfaces(page)
    check('reading_surfaces_are_quiet_solid_panels', all(e['image'] == 'none' for e in info), info)
    check('shared_fine_border_and_pixel_typography', all(e['border'] == '1px' and 'Fusion Pixel' in e['font'] for e in info), info)
    check('desktop_reading_has_room_to_breathe', page.locator('#work').evaluate('e=>parseFloat(getComputedStyle(e).paddingLeft)') >= 28)
    check('body_reading_is_at_least_14px', page.locator('.personal-about__lead').evaluate('e=>parseFloat(getComputedStyle(e).fontSize)') >= 14)
    check('seven_navigation_targets_remain', page.locator('.site-header__nav a').count() == 7)
    check('minecraft_world_and_icons_remain', page.locator('.grass-block,.pixel-lantern').count() >= 4 and 'twilight-world.webp' in page.locator('.personal-site').evaluate('e=>getComputedStyle(e,"::before").backgroundImage'))
    page.wait_for_selector('.reference-scene__canvas[data-playback=looping]')
    page.evaluate('window.__readingCanvas=document.querySelector(".reference-scene__canvas")')
    page.screenshot(path=str(args.output/'home.png'))
    page.locator('.site-header__nav a[href="#work"]').click()
    page.locator('#work').screenshot(path=str(args.output/'work.png'))
    page.locator('#note-keeping-pace').screenshot(path=str(args.output/'journal.png'))
    page.locator('#note-keeping-pace summary').click()
    check('same_character_after_reading_navigation', page.evaluate('window.__readingCanvas===document.querySelector(".reference-scene__canvas")'))
    page.get_by_role('searchbox', name='搜索此网站').fill('与时俱进')
    page.keyboard.press('Enter')
    check('search_keeps_real_note_target', page.evaluate('document.activeElement.id') == 'note-keeping-pace')
    page.get_by_role('button', name='暂停动态', exact=True).click()
    page.wait_for_selector('.reference-scene__canvas[data-playback=static]')
    check('reader_can_pause_scene', True)
    for width in [320, 375, 541, 768, 801, 1101, 1440, 1680]:
        page.set_viewport_size({'width': width, 'height': 1000})
        page.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
        layout = page.evaluate('''() => ({width:innerWidth,scroll:document.documentElement.scrollWidth,
          bounds:[...document.querySelectorAll('#work,.project-table td,.journal-entry,.interest-card,.social-card,.site-header__nav a')].map(e=>{const r=e.getBoundingClientRect();return {x:r.x,right:r.right}})})''')
        report['layouts'].append(layout)
        check(f'{width}_content_and_navigation_fit', layout['scroll'] <= width and all(e['x'] >= -.5 and e['right'] <= width+.5 for e in layout['bounds']), layout)
    page.set_viewport_size({'width': 375, 'height': 1000})
    page.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
    table = page.get_by_role('table', name='公开项目', exact=True)
    check('mobile_project_table_keeps_accessible_headers_and_cells', table.count() == 1 and
          table.get_by_role('columnheader').count() == 3 and table.get_by_role('row').count() == 3 and
          table.get_by_role('cell').count() == 6)
    mobile_rows = page.locator('.project-table tbody tr').evaluate_all('''rows=>rows.map(row=>{
      const r=row.getBoundingClientRect(),d=row.cells[2].getBoundingClientRect();
      return {rowWidth:r.width,descriptionWidth:d.width,font:parseFloat(getComputedStyle(row.cells[2].querySelector('p')).fontSize)};
    })''')
    check('mobile_project_description_has_full_reading_width', all(
        item['descriptionWidth'] >= item['rowWidth']-30 and item['font'] >= 14 for item in mobile_rows), mobile_rows)
    page.locator('#work').scroll_into_view_if_needed()
    page.screenshot(path=str(args.output/'mobile.png'))
    static_info = surfaces(page)
    ctx.close()
    ctx = browser.new_context(java_script_enabled=False, viewport={'width': 375, 'height': 1000})
    page = ctx.new_page(); page.goto(args.url)
    check('no_js_same_reading_surfaces', surfaces(page) == static_info)
    page.locator('#note-keeping-pace summary').click()
    check('no_js_native_full_reading', page.locator('#note-keeping-pace details').get_attribute('open') is not None)
    check('no_js_has_no_dead_search', page.get_by_role('searchbox').count() == 0)
    ctx.close(); browser.close()
check('no_browser_errors', not report['errors'], report['errors'])
report['status'] = 'passed'
(args.output/'checks.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
print(json.dumps({'status': 'passed', 'checks': len(report['checks'])}))
