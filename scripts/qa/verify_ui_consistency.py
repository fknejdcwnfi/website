#!/usr/bin/env python3
"""Verify consistent UI borders, real keyboard search and richer existing works.

Run against an existing production preview; this script never builds or edits the
site. Each run writes its own checks and screenshots, without replacing prior QA.
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
CANVAS = '.reference-scene__canvas'
RESULTS = '#site-search-results'
RESULT = RESULTS + ' .site-search__result'
PROJECTS = {
    'project-living-portrait': 'https://github.com/fknejdcwnfi/website',
    'project-xiangqi-review': 'https://github.com/fknejdcwnfi/xiangqi-review',
}
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url', default='http://127.0.0.1:5180/website/')
parser.add_argument('--output', type=Path, default=ROOT / 'artifacts/ui-consistency')
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)
report = {
    'status': 'failed', 'productionUrl': args.url, 'checks': [],
    'browserErrors': [], 'badResponses': [], 'layouts': [], 'projects': [],
}


def save():
    (args.output / 'checks.json').write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + '\n')


def check(name, passed, detail=None):
    report['checks'].append({'name': name, 'passed': bool(passed), 'detail': detail})
    save()
    if not passed:
        raise AssertionError((name, detail))


def same_scene(page, label):
    check(label + '_same_canvas_and_video', page.evaluate('''() =>
      window.__uiCanvas===document.querySelector('.reference-scene__canvas') &&
      window.__uiVideo===document.getElementById('vermouth-poetic-bootstrap')'''))


def style_groups(page, label, *, search_open=False):
    groups = [
        ('panel', '#about,#work,.site-sidebar,.site-toc' + (',' + RESULTS if search_open else ''), 16),
        ('card', '.interest-card,.game-showcase,.social-card,.project-table-wrap', 14),
        ('control', '.site-search form,.site-header__nav a,.site-sidebar nav a,.site-toc nav a,'
         '.social-card__actions>.personal-text-link,.personal-project__details', 10),
    ]
    for name, selector, radius in groups:
        styles = page.locator(selector).evaluate_all('''elements => elements
          .filter(e=>!!e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden')
          .map(e=>{const s=getComputedStyle(e);return {tag:e.tagName,id:e.id,class:e.className,
            radius:[s.borderTopLeftRadius,s.borderTopRightRadius,s.borderBottomRightRadius,s.borderBottomLeftRadius].map(parseFloat),
            border:[s.borderTopWidth,s.borderRightWidth,s.borderBottomWidth,s.borderLeftWidth].map(parseFloat)}})''')
        check(label + '_' + name + '_radius', bool(styles) and
              all(all(abs(value - radius) < .01 for value in e['radius']) for e in styles), styles)
        check(label + '_' + name + '_one_pixel_border', bool(styles) and
              all(all(abs(value - 1) < .01 for value in e['border']) for e in styles), styles)


def projects_snapshot(page, label):
    data = page.locator('.personal-project').evaluate_all('''rows => rows.map(e=>({
      id:e.id,links:[...e.querySelectorAll('a')].map(a=>({href:a.href,target:a.target,rel:a.rel})),
      title:e.querySelector('.personal-project__heading')?.textContent.trim(),
      description:e.querySelector('.personal-project__description')?.textContent.trim(),
      meta:e.querySelector('.personal-project__meta')?.textContent.replace(/\\s+/g,' ').trim(),
      details:[...e.querySelectorAll('details.personal-project__details')].map(d=>({
        summary:d.querySelector('summary')?.textContent.replace(/\\s+/g,' ').trim(),
        highlights:[...d.querySelectorAll('.personal-project__highlights li')].map(i=>i.textContent.trim()),
        note:d.querySelector('.personal-project__note')?.textContent.trim()||''}))
    }))''')
    report['projects'].append({'label': label, 'rows': data})
    check(label + '_two_original_project_ids', [p['id'] for p in data] == list(PROJECTS), data)
    check(label + '_single_safe_primary_link_per_project', all(
        len(p['links']) == 1 and p['links'][0]['href'] == PROJECTS[p['id']] and
        p['links'][0]['target'] == '_blank' and
        {'noopener', 'noreferrer'} <= set(p['links'][0]['rel'].split()) for p in data), data)
    check(label + '_real_project_summaries_and_native_details', all(
        p['title'] and p['description'] and p['meta'] and len(p['details']) == 1 and
        p['details'][0]['summary'] and len(p['details'][0]['highlights']) >= 2 and
        all(p['details'][0]['highlights']) for p in data), data)
    counts = page.locator('.project-overview dd').all_text_contents()
    numbers = [int(match.group()) for text in counts if (match := re.search(r'\d+', text))]
    check(label + '_overview_derived_two_one_one', numbers == [2, 1, 1], counts)
    return data


def open_project_details(page, label):
    for project_id in PROJECTS:
        details = page.locator('#' + project_id + ' details.personal-project__details')
        if not details.evaluate('e=>e.open'):
            details.locator('summary').click()
        check(label + '_' + project_id + '_native_details_open', details.evaluate('e=>e.open'))
        check(label + '_' + project_id + '_highlights_visible',
              all(item.is_visible() for item in details.locator('.personal-project__highlights li').all()))


def keyboard_project_details(page, label):
    details = page.locator('.personal-project__details').first
    before = details.evaluate('e=>e.open')
    summary = details.locator('summary')
    summary.focus()
    page.keyboard.press('Space')
    check(label + '_native_details_keyboard_toggle', details.evaluate('e=>e.open') != before)
    focus = summary.evaluate('''e=>{
      const s=getComputedStyle(e);return {focused:e===document.activeElement,
        keyboard:e.matches(':focus-visible'),outline:s.outlineStyle,width:parseFloat(s.outlineWidth),
        offset:parseFloat(s.outlineOffset),shadow:s.boxShadow};
    }''')
    check(label + '_details_keyboard_focus_not_clipped', focus['focused'] and focus['keyboard'] and
          ((focus['outline'] != 'none' and focus['width'] >= 2 and focus['offset'] <= 0) or
           focus['shadow'] != 'none'), focus)
    page.keyboard.press('Space')
    check(label + '_native_details_keyboard_toggle_reversible', details.evaluate('e=>e.open') == before)


def search_focus(page, label):
    # Trigger keyboard modality and focus through the actual public shortcut.
    page.locator('.site-header__nav a[href="#home"]').click()
    page.keyboard.press('/')
    page.wait_for_selector(RESULTS)
    info = page.locator('#site-search').evaluate('''e=>{
      const s=getComputedStyle(e),f=e.closest('form'),fs=getComputedStyle(f);
      return {focused:e===document.activeElement,keyboard:e.matches(':focus-visible'),
        outline:s.outlineStyle,outlineWidth:parseFloat(s.outlineWidth),shadow:s.boxShadow,
        borders:[s.borderTopWidth,s.borderRightWidth,s.borderBottomWidth,s.borderLeftWidth].map(parseFloat),
        containerFocused:f.matches(':focus-within'),containerShadow:fs.boxShadow,containerRadius:fs.borderRadius};
    }''')
    check(label + '_search_shortcut_is_keyboard_focus', info['focused'] and info['keyboard'], info)
    check(label + '_input_has_no_second_rectangular_border',
          (info['outline'] == 'none' or info['outlineWidth'] == 0) and info['shadow'] == 'none' and
          all(value == 0 for value in info['borders']), info)
    check(label + '_single_rounded_container_has_visible_focus_ring',
          info['containerFocused'] and info['containerRadius'] == '10px' and
          info['containerShadow'] != 'none' and '3px' in info['containerShadow'], info)
    check(label + '_search_accessible_name',
          page.get_by_role('searchbox', name='搜索此网站', exact=True).count() == 1)


def grouped_search(page, label):
    page.locator('#site-search').fill('')
    page.wait_for_selector(RESULT)
    data = page.locator(RESULTS).evaluate('''e=>{
      const list=e.querySelector('.site-search__list'),s=getComputedStyle(list),r=e.getBoundingClientRect();
      return {groups:[...e.querySelectorAll('.site-search__group')].map(g=>({
          heading:g.querySelector('h3.site-search__group-label')?.textContent.trim(),
          count:g.querySelectorAll('a.site-search__result').length})),
        links:[...e.querySelectorAll('a.site-search__result')].map(a=>({href:a.getAttribute('href'),
          icon:a.querySelectorAll('.site-search__result-icon svg').length,
          title:a.querySelector('.site-search__result-copy span')?.textContent.trim(),
          excerpt:a.querySelector('.site-search__result-copy small')?.textContent.trim(),
          height:a.getBoundingClientRect().height})),
        list:{overflow:s.overflowY,maxHeight:s.maxHeight,client:list.clientHeight,scroll:list.scrollHeight},
        box:{x:r.x,right:r.right,top:r.top,bottom:r.bottom,height:r.height},width:innerWidth,height:innerHeight};
    }''')
    check(label + '_search_results_grouped_with_headings', len(data['groups']) >= 2 and
          all(g['heading'] and g['count'] > 0 for g in data['groups']), data['groups'])
    check(label + '_compact_results_have_svg_icons_and_copy', len(data['links']) >= 6 and all(
        i['href'].startswith('#') and i['icon'] == 1 and i['title'] and i['excerpt'] and
        i['height'] <= 80 for i in data['links']), data['links'])
    box = data['box']
    check(label + '_search_panel_fits_real_viewport',
          box['x'] >= -.5 and box['right'] <= data['width'] + .5 and box['top'] >= 0 and
          box['bottom'] <= data['height'] + .5 and box['height'] <= min(560, data['height'] * .75), data)
    check(label + '_search_list_has_bounded_internal_scroll',
          data['list']['overflow'] in ('auto', 'scroll') and data['list']['maxHeight'] != 'none' and
          data['list']['client'] > 0 and data['list']['scroll'] > data['list']['client'], data['list'])
    style_groups(page, label + '_search_open', search_open=True)


def focused_href(page):
    return page.evaluate('document.activeElement.getAttribute("href")')


def arrow_to(page, key, href):
    page.keyboard.press(key)
    # Input-to-results focus is deliberately queued in requestAnimationFrame;
    # wait for the real focused anchor rather than inspecting before that frame.
    page.wait_for_function('href=>document.activeElement.getAttribute("href")===href', arg=href)


def keyboard_search(page, label):
    links = page.locator(RESULT).evaluate_all('links=>links.map(a=>a.getAttribute("href"))')
    arrow_to(page, 'ArrowDown', links[0])
    check(label + '_arrow_down_from_input_focuses_first', focused_href(page) == links[0])
    check(label + '_result_keyboard_focus_visible', page.locator(RESULT).first.evaluate('''e=>{
      const s=getComputedStyle(e);return e.matches(':focus-visible')&&
        ((s.outlineStyle!=='none'&&parseFloat(s.outlineWidth)>=2)||s.boxShadow!=='none')
    }'''))
    arrow_to(page, 'ArrowDown', links[1])
    check(label + '_arrow_down_moves_to_next', focused_href(page) == links[1])
    arrow_to(page, 'ArrowUp', links[0])
    check(label + '_arrow_up_moves_to_previous', focused_href(page) == links[0])
    arrow_to(page, 'ArrowUp', links[-1])
    check(label + '_arrow_navigation_wraps_to_last', focused_href(page) == links[-1])
    check(label + '_keyboard_scroll_reveals_last_result', page.locator(RESULT).last.evaluate('''e=>{
      const list=e.closest('.site-search__list'),r=e.getBoundingClientRect(),l=list.getBoundingClientRect();
      return list.scrollTop>0&&r.top>=l.top-.5&&r.bottom<=l.bottom+.5
    }'''))
    page.keyboard.press('Escape')
    page.locator(RESULTS).wait_for(state='detached')
    check(label + '_escape_closes_and_returns_input', page.locator(RESULTS).count() == 0 and
          page.locator('#site-search').evaluate('e=>e===document.activeElement'))

    # Newly documented verified capability must be indexed, and keyboard Enter
    # must select its actual project row rather than only the first chapter.
    page.locator('#site-search').fill('过河')
    target = RESULTS + ' a[href="#project-xiangqi-review"]'
    page.wait_for_selector(target)
    arrow_to(page, 'ArrowDown', '#project-xiangqi-review')
    check(label + '_new_project_capability_is_searchable', focused_href(page) == '#project-xiangqi-review')
    page.keyboard.press('Enter')
    page.wait_for_function('document.activeElement.id==="project-xiangqi-review"')
    page.wait_for_function('document.querySelector(".personal-site").dataset.activeSection==="work"')
    check(label + '_enter_navigates_focused_result', page.url.endswith('#project-xiangqi-review') and
          page.locator(RESULTS).count() == 0)
    same_scene(page, label + '_search_enter')

    page.keyboard.press('/')
    page.locator('#site-search').fill('no-match-ui-consistency-271828')
    check(label + '_search_empty_feedback', page.locator('.site-search__empty').is_visible() and
          page.locator(RESULT).count() == 0)
    before = page.url
    page.keyboard.press('Enter')
    check(label + '_empty_search_does_not_navigate', page.url == before and
          page.locator('#site-search').evaluate('e=>e===document.activeElement'))
    page.keyboard.press('Escape')
    page.locator(RESULTS).wait_for(state='detached')
    page.locator('#site-search').fill('')
    page.wait_for_selector(RESULT)
    page.keyboard.press('Tab')
    check(label + '_result_links_remain_tab_accessible', focused_href(page) is not None and
          page.evaluate('document.activeElement.matches(".site-search__result")'))
    page.keyboard.press('Escape')
    same_scene(page, label + '_all_search_actions')


def layout_check(page, label):
    data = page.evaluate('''()=>{
      const bounds=e=>{const r=e.getBoundingClientRect();return {class:e.className,x:r.x,right:r.right,
        width:e.clientWidth,scroll:e.scrollWidth}};
      return {width:innerWidth,scroll:document.documentElement.scrollWidth,
        table:[document.querySelector('.project-table').scrollWidth,document.querySelector('.project-table-wrap').clientWidth],
        details:[...document.querySelectorAll('.personal-project__details,.personal-project__highlights,.personal-project__note,.project-overview')]
          .filter(e=>!!e.getClientRects().length).map(bounds),
        panels:[...document.querySelectorAll('#about,#work,.interest-card,.game-showcase,.social-card,.site-sidebar,.site-toc')]
          .filter(e=>!!e.getClientRects().length).map(bounds)};
    }''')
    report['layouts'].append({'label': label, **data})
    check(label + '_no_page_or_table_overflow', data['scroll'] <= data['width'] and
          data['table'][0] <= data['table'][1] + 2, data)
    check(label + '_project_details_not_clipped', bool(data['details']) and all(
        e['x'] >= -.5 and e['right'] <= data['width'] + .5 and e['scroll'] <= e['width'] + 2
        for e in data['details']), data['details'])
    check(label + '_visible_panels_fit_viewport', all(
        e['x'] >= -.5 and e['right'] <= data['width'] + .5 and e['scroll'] <= e['width'] + 2
        for e in data['panels']), data['panels'])


try:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])

        def context(**options):
            ctx = browser.new_context(**options)
            ctx.set_default_timeout(8000)
            ctx.set_default_navigation_timeout(20000)

            def track(page):
                page.on('pageerror', lambda error: report['browserErrors'].append(str(error)))
                page.on('response', lambda response: report['badResponses'].append(
                    {'url': response.url, 'status': response.status}) if response.status >= 400 else None)
            ctx.on('page', track)
            return ctx

        ctx = context(viewport={'width': 1672, 'height': 1100})
        page = ctx.new_page()
        response = page.goto(args.url)
        check('production_http_200', response.status == 200)
        page.wait_for_selector(CANVAS + '[data-ready=true][data-playback=looping]')
        page.evaluate('''window.__uiCanvas=document.querySelector('.reference-scene__canvas');
          window.__uiVideo=document.getElementById('vermouth-poetic-bootstrap')''')
        check('real_scene_nodes_recorded', page.evaluate('''window.__uiCanvas instanceof HTMLCanvasElement&&
          window.__uiVideo instanceof HTMLVideoElement'''))
        check('original_scene_and_independent_weather', page.locator(CANVAS).evaluate('''c=>
          c.dataset.snowParticles==='448'&&c.dataset.petalParticles==='60'&&
          getComputedStyle(c).imageRendering==='pixelated'&&!c.getContext('2d').imageSmoothingEnabled'''))
        check('actual_viewport_stays_borderless_circle', page.locator('.reference-scene__viewport').evaluate('''e=>{
          const s=getComputedStyle(e);return s.borderRadius==='50%'&&s.borderTopWidth==='0px'&&s.boxShadow==='none'
        }'''))
        page.evaluate('document.fonts.ready')
        check('real_fusion_pixel_face_loaded', page.evaluate('''[...document.fonts].some(f=>
          f.family.replaceAll('"','').toLowerCase()==='fusion pixel'&&f.status==='loaded')'''))
        original_projects = projects_snapshot(page, 'react')
        keyboard_project_details(page, 'desktop')
        open_project_details(page, 'desktop')
        same_scene(page, 'opened_project_details')
        page.screenshot(path=str(args.output / 'works-desktop.png'), full_page=True)
        search_focus(page, 'desktop')
        grouped_search(page, 'desktop')
        page.screenshot(path=str(args.output / 'search-desktop.png'))
        keyboard_search(page, 'desktop')

        for width in [320, 390, 768, 1100, 1200, 1440, 1672]:
            page.set_viewport_size({'width': width, 'height': 1100})
            page.locator('.site-header__nav a[href="#work"]').click()
            open_project_details(page, 'width_' + str(width))
            style_groups(page, 'width_' + str(width))
            layout_check(page, 'width_' + str(width))
            same_scene(page, 'width_' + str(width))
            if width == 390:
                page.screenshot(path=str(args.output / 'works-mobile.png'), full_page=True)
                search_focus(page, 'mobile')
                grouped_search(page, 'mobile')
                page.screenshot(path=str(args.output / 'search-mobile.png'))
                keyboard_search(page, 'mobile')
        page.locator('.site-header__nav a[href="#home"]').click()
        page.wait_for_selector(CANVAS + '[data-playback=looping]')
        same_scene(page, 'returned_home_after_all_actions')
        ctx.close()

        # Native details and complete project content must work with real page
        # scripts disabled. Only synchronous inspection runs in this context.
        ctx = context(java_script_enabled=False, viewport={'width': 390, 'height': 844})
        page = ctx.new_page()
        response = page.goto(args.url)
        check('nojs_http_200', response.status == 200)
        check('nojs_search_controls_absent', page.locator('#site-search').count() == 0)
        static_projects = projects_snapshot(page, 'nojs')
        check('nojs_react_complete_project_parity', static_projects == original_projects,
              {'react': original_projects, 'static': static_projects})
        keyboard_project_details(page, 'nojs')
        open_project_details(page, 'nojs')
        style_groups(page, 'nojs')
        layout_check(page, 'nojs')
        page.locator('.site-header__nav a[href="#work"]').click()
        check('nojs_work_anchor_usable', page.url.endswith('#work'))
        check('nojs_original_poster_loaded', page.locator('.reference-scene__poster').first.evaluate(
            'e=>e.complete&&e.naturalWidth===2864&&e.naturalHeight===2136'))
        page.screenshot(path=str(args.output / 'works-no-javascript.png'), full_page=True)
        ctx.close()
        browser.close()

    check('no_browser_errors', not report['browserErrors'], report['browserErrors'])
    check('no_failed_responses', not report['badResponses'], report['badResponses'])
    report['status'] = 'passed'
finally:
    save()

print(json.dumps({'status': report['status'], 'checks': len(report['checks']), 'output': str(args.output)}))
