#!/usr/bin/env python3
"""Check the public journal in a built preview, including native no-JS reading."""
import argparse
import json
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url', default='http://127.0.0.1:5180/')
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)
report = {'status': 'failed', 'url': args.url, 'checks': [], 'errors': [], 'badResponses': [], 'layouts': []}


def check(name, condition, detail=None):
    report['checks'].append({'name': name, 'passed': bool(condition), 'detail': detail})
    (args.output / 'checks.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    if not condition:
        raise AssertionError(name)


def observe(page):
    page.on('pageerror', lambda error: report['errors'].append(str(error)))
    page.on('response', lambda response: report['badResponses'].append({'url': response.url, 'status': response.status}) if response.status >= 400 else None)


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
    context = browser.new_context(viewport={'width': 1440, 'height': 1100}, reduced_motion='reduce')
    context.add_init_script("try { localStorage.setItem('vermouth-scene-motion','static') } catch (_) {}")
    page = context.new_page()
    observe(page)
    response = page.goto(args.url)
    check('preview_http_200', response.status == 200)
    page.wait_for_selector('.personal-site:not(.static-site)')
    article = page.locator('#note-transition-day')
    reading = article.locator('details')
    summary = reading.locator('summary')
    check('single_public_note', article.count() == 1)
    newer = page.locator('#note-keeping-pace')
    check('two_public_notes', page.locator('.journal-entry').count() == 2 and newer.count() == 1)
    check('undated_original_has_no_invented_time', newer.locator('time').count() == 0 and '原稿未注明日期' in newer.inner_text())
    check('no_raw_document_download', page.locator('a[href$=".docx"]').count() == 0)
    check('seven_navigation_targets', page.locator('.site-header__nav a').evaluate_all('(links)=>links.map(a=>a.hash)') == ['#home', '#about', '#work', '#journal', '#interests', '#games', '#contact'])
    check('separate_dates', article.locator('time').evaluate_all('(nodes)=>nodes.map(e=>e.dateTime)') == ['2026-11-14', '2026-11-15'])
    check('collapsed_initial_reading', reading.get_attribute('open') is None)
    page.locator('.site-header__nav a[href="#journal"]').click()
    check('journal_active', page.locator('.personal-site').get_attribute('data-active-section') == 'journal')
    summary.focus()
    page.keyboard.press('Enter')
    check('keyboard_expands_native_reading', reading.get_attribute('open') is not None)
    check('six_readable_chapters', article.locator('.journal-entry__chapter').count() == 6 and article.locator('.journal-entry__chapter').first.is_visible())
    check('edited_version_label', '原稿整理' in article.inner_text())
    check('no_location_or_embedded_document_metadata', article.locator('address,a[href^="geo:"],iframe,embed,object').count() == 0)
    check('learning_is_not_claimed_complete', '需要准备考试' in article.text_content() and '我想联系学术导师' in article.text_content())
    check('existing_game_preserved', page.locator('#game-honor-of-kings').count() == 1)
    for width in [320, 375, 541, 768, 801, 1440, 1680]:
        page.set_viewport_size({'width': width, 'height': 1000})
        article.scroll_into_view_if_needed()
        layout = page.evaluate('''() => ({width:innerWidth,scroll:document.documentElement.scrollWidth,
          bounds:[...document.querySelectorAll('.journal-entry,.journal-entry__reading,.journal-entry__body,.journal-entry__chapter')].map(e=>{const r=e.getBoundingClientRect();return {x:r.x,right:r.right}}),
          header:[...document.querySelectorAll('.site-header__nav a')].map(e=>{const r=e.getBoundingClientRect();return {x:r.x,right:r.right}})})''')
        report['layouts'].append(layout)
        check(f'{width}_no_overflow', layout['scroll'] <= width and all(e['x'] >= 0 and e['right'] <= width + .5 for e in layout['bounds'] + layout['header']))
    page.set_viewport_size({'width': 1440, 'height': 1100})
    style = article.evaluate('e=>{const s=getComputedStyle(e);return {radius:s.borderRadius,border:s.borderTopWidth,font:s.fontFamily}}')
    check('shared_card_border_and_pixel_font', style['radius'] == '14px' and style['border'] == '1px' and 'Fusion Pixel' in style['font'], style)
    summary.focus()
    page.keyboard.press('Space')
    check('keyboard_collapses_reading', reading.get_attribute('open') is None)
    search = page.get_by_role('searchbox', name='搜索此网站')
    search.fill('Verilog')
    check('full_text_search_group', page.locator('#site-search-results .site-search__group-label').filter(has_text='手记').count() == 1)
    page.keyboard.press('Enter')
    check('search_focuses_visible_article', page.evaluate('document.activeElement.id') == 'note-transition-day' and page.locator('.personal-site').get_attribute('data-active-section') == 'journal')
    article.screenshot(path=str(args.output / 'journal-card.png'))
    context.close()
    # Normal motion verifies that reading and navigation keep the actual player.
    context = browser.new_context(viewport={'width': 1440, 'height': 1100}, reduced_motion='no-preference')
    page = context.new_page()
    observe(page)
    page.goto(args.url)
    page.wait_for_selector('.reference-scene__canvas', state='attached')
    page.evaluate('window.__journalCanvas=document.querySelector(".reference-scene__canvas")')
    page.locator('.site-header__nav a[href="#journal"]').click()
    page.locator('#note-transition-day .journal-entry__reading summary').click()
    page.locator('.site-header__nav a[href="#home"]').click()
    check('same_character_canvas', page.evaluate('window.__journalCanvas===document.querySelector(".reference-scene__canvas")'))
    context.close()
    context = browser.new_context(java_script_enabled=False, viewport={'width': 375, 'height': 1000})
    page = context.new_page()
    observe(page)
    page.goto(args.url + '#note-transition-day')
    reading = page.locator('#note-transition-day .journal-entry__reading')
    reading.locator('summary').click()
    check('no_js_full_native_reading', reading.get_attribute('open') is not None and reading.locator('.journal-entry__chapter').count() == 6)
    newer = page.locator('#note-keeping-pace')
    newer.locator('summary').click()
    check('no_js_new_article_reading', newer.locator('details').get_attribute('open') is not None and newer.locator('.journal-entry__chapter').count() == 5 and newer.locator('time').count() == 0)
    check('no_js_no_dead_search', page.get_by_role('searchbox').count() == 0)
    check('no_js_pixel_font', 'Fusion Pixel' in reading.locator('.journal-entry__body').evaluate('e=>getComputedStyle(e).fontFamily'))
    check('no_js_local_resources', all(urlsplit(src).hostname == urlsplit(args.url).hostname for src in page.locator('img').evaluate_all('(imgs)=>imgs.map(e=>e.src)')))
    context.close()
    browser.close()
check('no_browser_errors', not report['errors'], report['errors'])
check('no_bad_responses', not report['badResponses'], report['badResponses'])
report['status'] = 'passed'
(args.output / 'checks.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'status': report['status'], 'checks': len(report['checks']), 'url': args.url}))
