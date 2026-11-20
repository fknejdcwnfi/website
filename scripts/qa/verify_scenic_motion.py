#!/usr/bin/env python3
"""Check bounded decorative motion without changing the portrait or reading access.

Run against an already built local preview. Synthetic visibility and missing-API
scenarios exercise signal handling; they do not establish physical-display FPS.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from urllib.parse import urlsplit

from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url', default='http://127.0.0.1:5180/')
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
if urlsplit(args.url).hostname not in ('127.0.0.1', 'localhost', '::1'):
    raise ValueError('Use a local built production preview for injected API checks.')
args.output.mkdir(parents=True, exist_ok=True)
report = {'status': 'failed', 'url': args.url, 'checks': [], 'contexts': [],
          'scope': 'Local Chromium functional styles and motion signals; not a visitor-performance or physical-display benchmark.'}
CANVAS = '.reference-scene__canvas'
SITE = '.personal-site:not(.static-site)'


def save():
    (args.output / 'checks.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')


def check(name, passed, detail=None):
    report['checks'].append({'name': name, 'passed': bool(passed), 'detail': detail})
    save()
    if not passed:
        raise AssertionError((name, detail))


def decorative_styles(page):
    return page.evaluate('''() => {
      const style=(element,pseudo=null)=>{const s=getComputedStyle(element,pseudo);return {
        animation:s.animationName,playState:s.animationPlayState,transform:s.transform,
        opacity:s.opacity,iterations:s.animationIterationCount,duration:s.animationDuration,
        fontSize:s.fontSize,width:s.width,height:s.height}};
      return {lanterns:[...document.querySelectorAll('.pixel-lantern')].map(e=>style(e)),
        crystal:style(document.querySelector('.eyebrow'),'::before')};
    }''')


def ambient_active(styles):
    active = []
    for item in [*styles['lanterns'], styles['crystal']]:
        names = [name.strip() for name in item['animation'].split(',')]
        states = [state.strip() for state in item['playState'].split(',')]
        if any(name != 'none' and states[index % len(states)] != 'paused' for index, name in enumerate(names)):
            active.append(item)
    return active


def ready(page, playback='looping'):
    response = page.goto(args.url)
    check('production_response_' + playback, response.status == 200)
    page.wait_for_selector(SITE)
    page.wait_for_selector(CANVAS + f'[data-playback={playback}]')


def no_events(entry):
    check(entry['label'] + '_no_unexpected_browser_errors_or_bad_responses',
          not entry['errors'] and not entry['badResponses'],
          {'errors': entry['errors'], 'badResponses': entry['badResponses']})


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
    try:
        def context(label, injection='', **options):
            options.setdefault('viewport', {'width': 1440, 'height': 1100})
            ctx = browser.new_context(**options)
            ctx.set_default_timeout(30000)
            if injection:
                ctx.add_init_script(injection)
            entry = {'label': label, 'errors': [], 'badResponses': []}
            report['contexts'].append(entry)
            page = ctx.new_page()
            page.on('pageerror', lambda error: entry['errors'].append(str(error)))
            page.on('response', lambda response: entry['badResponses'].append({'url': response.url, 'status': response.status}) if response.status >= 400 else None)
            return ctx, page, entry

        entry_probe = '''window.__scenicEntries={};document.addEventListener('animationstart',event=>{
          if(event.target instanceof Element&&event.target.matches('.personal-section__label')){
            const id=event.target.closest('.personal-section')?.id;
            if(id)window.__scenicEntries[id]=(window.__scenicEntries[id]||0)+1;
          }
        })'''
        ctx, page, entry = context('ordinary', entry_probe, reduced_motion='no-preference')
        ready(page)
        page.wait_for_selector(SITE + '[data-page-motion=running]')
        page.evaluate('window.__scenicCanvas=document.querySelector(".reference-scene__canvas")')
        initial = decorative_styles(page)
        check('three_small_ambient_targets', len(initial['lanterns']) == 2 and len(ambient_active(initial)) == 3, initial)
        check('sticky_lanterns_keep_ambient_loops', all(
            item['iterations'] == 'infinite' for item in initial['lanterns']), initial['lanterns'])
        check('hero_crystal_has_only_two_brief_initial_iterations',
              initial['crystal']['iterations'] == '2' and initial['crystal']['duration'] == '0.84s',
              initial['crystal'])
        check('lantern_and_crystal_bounds_are_small',
              all(float(item['width'].removesuffix('px')) <= 64 and float(item['height'].removesuffix('px')) <= 96 for item in initial['lanterns']) and
              float(initial['crystal']['fontSize'].removesuffix('px')) <= 24, initial)
        samples = [initial]
        for _ in range(4):
            page.wait_for_timeout(650)
            samples.append(decorative_styles(page))
        signatures = {json.dumps([{'transform': item['transform'], 'opacity': item['opacity']} for item in [*sample['lanterns'], sample['crystal']]], sort_keys=True) for sample in samples}
        check('small_decorations_really_change_transform_or_opacity', len(signatures) > 1, samples)
        # Computed animation-name/play-state remain declared after a finite
        # animation finishes. Inspect real Animation objects to prove it stops.
        crystal_completion = page.locator('.eyebrow').evaluate('''element => ({
          animations: element.getAnimations().filter(animation => animation.animationName === 'pixel-crystal-glint')
            .map(animation => ({state:animation.playState,time:animation.currentTime,
              iterations:animation.effect?.getTiming().iterations}))
        })''')
        check('hero_crystal_finishes_without_a_perpetual_animation', not any(
            animation['state'] in ['running', 'pending']
            for animation in crystal_completion['animations']), crystal_completion)
        unchanged = page.evaluate('''() => {
          const root=document.querySelector('.personal-site');
          const styles=[getComputedStyle(root,'::before'),getComputedStyle(root,'::after'),
            getComputedStyle(document.querySelector('.hero__visual')),
            getComputedStyle(document.querySelector('.reference-scene__viewport')),
            getComputedStyle(document.querySelector('.reference-scene__canvas'))];
          const viewport=getComputedStyle(document.querySelector('.reference-scene__viewport'));
          return {animations:styles.map(s=>s.animationName),border:viewport.borderTopWidth,
            shadow:viewport.boxShadow,radius:viewport.borderTopLeftRadius};
        }''')
        check('background_and_character_viewport_have_no_new_animation', all(name == 'none' for name in unchanged['animations']), unchanged)
        check('character_viewport_keeps_borderless_circle', unchanged['border'] == '0px' and unchanged['shadow'] == 'none' and unchanged['radius'] == '50%', unchanged)
        page.get_by_role('button', name='暂停动态', exact=True).click()
        page.wait_for_selector(SITE + '[data-page-motion=paused]')
        page.wait_for_selector(CANVAS + '[data-playback=static]')
        paused = decorative_styles(page)
        phase = page.locator(CANVAS).get_attribute('data-elapsed-ms')
        page.wait_for_timeout(200)
        check('local_pause_stops_small_decorations', not ambient_active(paused) and decorative_styles(page) == paused, paused)
        check('local_pause_retains_character_node_and_phase', phase is not None and page.evaluate('window.__scenicCanvas===document.querySelector(".reference-scene__canvas")') and page.locator(CANVAS).get_attribute('data-elapsed-ms') == phase)
        page.get_by_role('button', name='开启动画', exact=True).click()
        page.wait_for_selector(SITE + '[data-page-motion=running]')
        page.wait_for_selector(CANVAS + '[data-playback=looping]')
        check('resume_reuses_character_canvas_and_phase', page.evaluate('window.__scenicCanvas===document.querySelector(".reference-scene__canvas")') and float(page.locator(CANVAS).get_attribute('data-elapsed-ms')) >= float(phase))
        page.evaluate('''() => {
          window.__scenicHidden=true;
          Object.defineProperty(document,'hidden',{configurable:true,get:()=>window.__scenicHidden});
          document.dispatchEvent(new Event('visibilitychange'));
        }''')
        page.wait_for_selector(SITE + '[data-page-motion=paused]')
        page.wait_for_selector(CANVAS + '[data-playback=suspended]')
        check('synthetic_hidden_signal_pauses_peripheral_motion', not ambient_active(decorative_styles(page)))
        page.evaluate('''() => {window.__scenicHidden=false;document.dispatchEvent(new Event('visibilitychange'))}''')
        page.wait_for_selector(SITE + '[data-page-motion=running]')
        page.wait_for_selector(CANVAS + '[data-playback=looping]')
        check('synthetic_visible_signal_resumes_same_character', page.evaluate('window.__scenicCanvas===document.querySelector(".reference-scene__canvas")'))
        page.screenshot(path=str(args.output / 'scenic-desktop.png'))
        page.locator('.site-header__nav a[href="#about"]').click()
        page.wait_for_function('() => window.__scenicEntries.about===1')
        page.wait_for_timeout(400)
        page.locator('.site-header__nav a[href="#home"]').click()
        page.locator('.site-header__nav a[href="#about"]').click()
        page.wait_for_timeout(400)
        check('chapter_title_enters_only_once_and_stays_visible', page.evaluate('''() =>
          window.__scenicEntries.about===1&&getComputedStyle(document.querySelector('#about .personal-section__label')).opacity==='1' '''))
        card = page.locator('.interest-card').first
        card.scroll_into_view_if_needed()
        page.wait_for_timeout(400)
        page.mouse.move(1, 1)
        resting = card.evaluate('e=>getComputedStyle(e).transform')
        card.hover()
        page.wait_for_timeout(200)
        check('card_hover_has_small_transform_feedback', card.evaluate('e=>getComputedStyle(e).transform') != resting)
        page.mouse.move(1, 1)
        page.keyboard.press('Tab')
        card.focus()
        page.wait_for_timeout(200)
        focus_style = card.evaluate('e=>{const s=getComputedStyle(e);return {style:s.outlineStyle,width:s.outlineWidth}}')
        check('keyboard_focus_remains_visible', focus_style['style'] != 'none' and float(focus_style['width'].removesuffix('px')) > 0, focus_style)
        check('focused_card_has_small_transform_feedback', card.evaluate('e=>getComputedStyle(e).transform') != resting)
        for width in [320, 375, 768, 1440]:
            page.set_viewport_size({'width': width, 'height': 1000})
            # ResizeObserver and the viewport hook deliberately measure on rAF.
            page.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))')
            overflow = page.evaluate('({width:innerWidth,scroll:document.documentElement.scrollWidth})')
            check(f'viewport_{width}_no_horizontal_overflow', overflow['scroll'] <= width, overflow)
        page.get_by_role('button', name='暂停动态', exact=True).click()
        page.wait_for_selector(SITE + '[data-page-motion=paused]')
        page.reload()
        page.wait_for_selector(SITE + '[data-page-motion=paused]')
        page.wait_for_selector(CANVAS + '[data-playback=static]')
        check('explicit_pause_keeps_decorations_still_after_reload', not ambient_active(decorative_styles(page)) and page.evaluate('localStorage.getItem("vermouth-scene-motion")') == 'static')
        no_events(entry)
        ctx.close()

        ctx, page, entry = context('system_reduce', reduced_motion='reduce')
        ready(page)
        page.wait_for_selector(SITE + '[data-page-motion=paused]')
        check('system_reduce_stops_only_decorations', not ambient_active(decorative_styles(page)) and page.locator(CANVAS).get_attribute('data-playback') == 'looping')
        no_events(entry)
        ctx.close()

        ctx, page, entry = context('storage_unavailable', 'Object.defineProperty(window,"localStorage",{get(){throw Error("injected storage failure")}})', reduced_motion='no-preference')
        ready(page)
        page.wait_for_selector(SITE + '[data-page-motion=running]')
        page.get_by_role('button', name='暂停动态', exact=True).click()
        page.wait_for_selector(SITE + '[data-page-motion=paused]')
        check('storage_failure_still_synchronizes_same_page_pause', not ambient_active(decorative_styles(page)))
        page.get_by_role('button', name='开启动画', exact=True).click()
        page.wait_for_selector(SITE + '[data-page-motion=running]')
        check('storage_failure_choice_is_reversible', bool(ambient_active(decorative_styles(page))))
        no_events(entry)
        ctx.close()

        ctx, page, entry = context('missing_observer', 'window.IntersectionObserver=undefined', reduced_motion='no-preference')
        ready(page)
        check('missing_observer_never_hides_reading_content', page.locator('.personal-section').evaluate_all('(nodes)=>nodes.every(e=>getComputedStyle(e).opacity!=="0"&&getComputedStyle(e).visibility!=="hidden"&&e.getClientRects().length>0)'))
        no_events(entry)
        ctx.close()

        ctx, page, entry = context('no_js', java_script_enabled=False, reduced_motion='no-preference')
        response = page.goto(args.url)
        check('no_js_response_and_complete_reading', response.status == 200 and page.locator('.static-site').count() == 1 and page.locator('.writing-entry').count() == 3)
        check('no_js_decorations_are_static', not ambient_active(decorative_styles(page)))
        check('no_js_sections_are_visible', page.locator('.personal-section').evaluate_all('(nodes)=>nodes.every(e=>getComputedStyle(e).opacity!=="0"&&getComputedStyle(e).visibility!=="hidden"&&e.getClientRects().length>0)'))
        no_events(entry)
        ctx.close()
    finally:
        browser.close()

report['status'] = 'passed'
save()
print(json.dumps({'status': report['status'], 'checks': len(report['checks']), 'output': str(args.output)}))
