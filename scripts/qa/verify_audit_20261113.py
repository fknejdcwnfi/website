#!/usr/bin/env python3
"""Targeted production regressions for IME, bounded retries and CSP parsing.

Composition events are synthetic browser probes, not physical OS IME coverage.
Faults and fixture documents remain in isolated local browser contexts.
"""
from __future__ import annotations

import argparse
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url', default='http://127.0.0.1:5180/')
parser.add_argument('--output', type=Path, default=ROOT / 'artifacts/audit-20261113/browser')
args = parser.parse_args()
if urlsplit(args.url).hostname not in ('localhost', '127.0.0.1', '::1'):
    raise ValueError('Use a local production preview for failure injection.')
args.output.mkdir(parents=True, exist_ok=True)
report = {'status': 'failed', 'url': args.url, 'timestamp': datetime.now(timezone.utc).isoformat(),
          'baseline': '012181f4cb983e0ac58ab727e6b50152162dc019', 'checks': [], 'contexts': [],
          'limitations': ['Synthetic composition/keyCode229 and requestSubmit probes; physical OS IMEs unverified.',
                          'Local Chromium functional checks; no performance, visitor CWV or deployment assertion.']}


def save():
    (args.output / 'checks.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')


def check(name, condition, detail=None):
    report['checks'].append({'name': name, 'passed': bool(condition), 'detail': detail})
    save()
    if not condition:
        raise AssertionError((name, detail))


def healthy(page, entry):
    check(entry['label'] + '_no_js_errors', not entry['errors'], entry['errors'])
    check(entry['label'] + '_no_failed_responses', not entry['failedResponses'], entry['failedResponses'])
    violations = page.evaluate('() => window.__auditViolations')
    check(entry['label'] + '_no_unexpected_csp_violations', not violations, violations)


CASES = [
    {'name': 'composing_arrow_down', 'key': 'ArrowDown', 'code': 40, 'composing': True, 'start': True},
    {'name': 'composing_arrow_up', 'key': 'ArrowUp', 'code': 38, 'composing': True, 'start': True},
    {'name': 'composition_state_arrow_down', 'key': 'ArrowDown', 'code': 40, 'composing': False, 'start': True},
    {'name': 'composing_escape', 'key': 'Escape', 'code': 27, 'composing': True, 'start': True},
    {'name': 'keycode229_arrow_down', 'key': 'ArrowDown', 'code': 229, 'composing': False},
    {'name': 'composing_submit', 'key': 'Enter', 'code': 13, 'composing': True, 'start': True, 'submit': True},
    {'name': 'compositionend_keycode229_submit', 'key': 'Enter', 'code': 229, 'composing': False,
     'start': True, 'end': True, 'submit': True},
]

try:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])

        def context(label, injection='', **options):
            options.setdefault('viewport', {'width': 1440, 'height': 1100})
            ctx = browser.new_context(**options)
            ctx.set_default_timeout(12000)
            ctx.set_default_navigation_timeout(20000)
            ctx.add_init_script('''window.__auditViolations=[];
              document.addEventListener('securitypolicyviolation',event=>window.__auditViolations.push({
                directive:event.effectiveDirective,blocked:event.blockedURI}));''' + injection)
            page = ctx.new_page()
            entry = {'label': label, 'errors': [], 'failedResponses': []}
            report['contexts'].append(entry)
            page.on('pageerror', lambda error: entry['errors'].append(str(error)))
            page.on('response', lambda response: entry['failedResponses'].append(
                {'url': response.url, 'status': response.status}) if response.status >= 400 else None)
            return ctx, page, entry

        ctx, page, entry = context('ime')
        ime_results = []
        for case in CASES:
            page.goto(args.url)
            page.locator('#site-search').fill('柯南')
            page.wait_for_selector('#site-search-results a[href="#interest-detective-conan"]')
            immediate = page.evaluate('''cfg=>{
              const input=document.querySelector('#site-search');
              if(cfg.start)input.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:'柯'}));
              if(cfg.end)input.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'柯南'}));
              const event=new KeyboardEvent('keydown',{key:cfg.key,keyCode:cfg.code,which:cfg.code,
                isComposing:cfg.composing,bubbles:true,cancelable:true});
              input.dispatchEvent(event);if(cfg.submit)input.form.requestSubmit();
              return {defaultPrevented:event.defaultPrevented};
            }''', case)
            page.evaluate('() => new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))')
            state = page.evaluate('''() => ({hash:location.hash,inputFocused:document.activeElement?.id==='site-search',
              resultsOpen:!!document.querySelector('#site-search-results')})''')
            ime_results.append({'case': case, **immediate, **state})
            check(case['name'] + '_native_keys_and_focus_preserved', not immediate['defaultPrevented'] and
                  state['inputFocused'] and state['resultsOpen'] and not state['hash'], ime_results[-1])
        entry['syntheticComposition'] = ime_results
        # End composition and make a distinct ordinary Enter through the real
        # keyboard. It must still navigate, rather than leaving a sticky block.
        page.locator('#site-search').dispatch_event('compositionend', {'data': '柯南'})
        page.keyboard.press('Enter')
        page.wait_for_function('() => document.activeElement.id==="interest-detective-conan"')
        check('normal_enter_after_composition_still_navigates', page.url.endswith('#interest-detective-conan'))
        page.keyboard.press('/')
        page.locator('#site-search').fill('柯南')
        page.keyboard.press('ArrowDown')
        page.wait_for_function('() => document.activeElement.getAttribute("href")==="#interest-detective-conan"')
        page.keyboard.press('Escape')
        page.locator('#site-search-results').wait_for(state='detached')
        check('normal_arrows_and_escape_still_work', page.locator('#site-search').evaluate('e=>e===document.activeElement'))
        healthy(page, entry)
        page.screenshot(path=str(args.output / 'ime-after.png'))
        ctx.close()

        # Fail each actual renderer on its second dynamic base draw. Its first
        # successful frame publishes looping, which formerly reset retry budget.
        fault = '''window.__runtimeFaults=0;window.__runtimeFaultEnabled=true;
          const auditDraw=CanvasRenderingContext2D.prototype.drawImage;
          CanvasRenderingContext2D.prototype.drawImage=function(...args){
            const source=args[0];
            if(window.__runtimeFaultEnabled&&this.canvas.matches?.('.reference-scene__canvas')&&
              this.canvas.dataset.playback==='looping'&&source instanceof HTMLCanvasElement&&
              source.width===1432&&source.height===1068){window.__runtimeFaults++;
                throw new Error('injected post-success renderer fault')}
            return auditDraw.apply(this,args);
          };'''
        ctx, page, entry = context('bounded_runtime_retry', fault)
        page.goto(args.url)
        page.wait_for_function('() => window.__runtimeFaults>=3', timeout=20000)
        page.wait_for_selector('.reference-scene__canvas[data-playback=failed]')
        page.wait_for_timeout(2300)
        state = page.evaluate('''() => ({faults:window.__runtimeFaults,
          playback:document.querySelector('.reference-scene__canvas').dataset.playback})''')
        check('post_success_failures_stop_after_two_automatic_retries', state == {'faults': 3, 'playback': 'failed'}, state)
        page.evaluate('''() => {window.__runtimeFaultEnabled=false;window.__retryCanvas=document.querySelector('.reference-scene__canvas');}''')
        page.get_by_role('button', name='重试加载', exact=True).click()
        page.wait_for_selector('.reference-scene__canvas[data-ready=true][data-playback=looping]')
        check('manual_retry_recovers_same_scene_after_budget_exhausted', page.evaluate(
            '() => window.__retryCanvas===document.querySelector(".reference-scene__canvas")&&window.__runtimeFaults===3'))
        healthy(page, entry)
        ctx.close()

        ctx, page, entry = context('search_live_resize')
        page.goto(args.url)
        page.locator('#site-search').fill('')
        page.locator('#site-search').click()
        page.wait_for_selector('#site-search-results')
        page.keyboard.press('ArrowUp')
        page.wait_for_function('() => document.activeElement.matches(".site-search__result")')
        for width, height in ((390, 320), (320, 320), (667, 320), (1280, 320), (1440, 1100)):
            page.set_viewport_size({'width': width, 'height': height})
            page.evaluate('() => new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))')
            bounds = page.locator('#site-search-results').evaluate('''e=>{const r=e.getBoundingClientRect(),h=e.querySelector('.site-search__help').getBoundingClientRect();
              return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,helpBottom:h.bottom}}''')
            check(f'open_search_resize_{width}x{height}_panel_and_help_fit', bounds['top'] >= 0 and
                  bounds['bottom'] <= height + .5 and bounds['helpBottom'] <= height + .5 and
                  bounds['left'] >= -.5 and bounds['right'] <= width + .5, bounds)
            hrefs = page.locator('#site-search-results .site-search__result').evaluate_all('as=>as.map(a=>a.getAttribute("href"))')
            for href in hrefs:
                page.keyboard.press('ArrowDown')
                page.wait_for_function('href=>document.activeElement.getAttribute("href")===href', arg=href)
            check(f'open_search_resize_{width}x{height}_keyboard_reaches_last', page.locator('#site-search-results .site-search__result').last.evaluate('''e=>{
              const r=e.getBoundingClientRect(),s=e.closest('.site-search__list').getBoundingClientRect();
              return e===document.activeElement&&r.top>=Math.max(0,s.top)-.5&&r.bottom<=Math.min(innerHeight,s.bottom)+.5;
            }'''))
        healthy(page, entry)
        ctx.close()

        # Exercise the real build policy on CRLF input, then let the browser
        # parse and enforce that generated document at a same-origin local URL.
        policy_program = '''import {protectStaticHtml} from './scripts/build/securityPolicy.ts';
          const html='<html><head><meta charset="UTF-8"></head><body><script id="site-parser-bootstrap">\\r\\nwindow.__eolBootstrap=1;\\r\\n</script><script id="site-startup-watchdog">window.__eolWatch=1;</script></body></html>';
          process.stdout.write(protectStaticHtml(html));'''
        generated = subprocess.run(['node', '--input-type=module', '-e', policy_program], cwd=ROOT,
                                   capture_output=True, timeout=10, check=True).stdout.decode('utf-8')
        ctx, page, entry = context('csp_line_endings')
        fixture_url = args.url.split('#', 1)[0].split('?', 1)[0].rstrip('/') + '/__audit-csp-eol'
        ctx.route(fixture_url, lambda route: route.fulfill(status=200, content_type='text/html', body=generated))
        page.goto(fixture_url)
        page.wait_for_function('() => window.__eolBootstrap===1&&window.__eolWatch===1')
        check('crlf_trusted_startup_scripts_execute_under_actual_csp', True)
        healthy(page, entry)
        page.evaluate('''() => {const s=document.createElement('script');s.textContent='window.__eolUntrusted=1';document.body.append(s);}''')
        page.wait_for_function('() => window.__auditViolations.length>0')
        check('crlf_policy_still_blocks_unowned_inline_script', page.evaluate('() => window.__eolUntrusted!==1'))
        entry['expectedProbeViolations'] = page.evaluate('() => window.__auditViolations')
        ctx.close()

        ctx, page, entry = context('nojs_decor_and_details', java_script_enabled=False, viewport={'width': 390, 'height': 844})
        page.goto(args.url)
        check('nojs_search_absent_and_six_sections_present', page.locator('#site-search').count() == 0 and
              all(page.locator('#' + name).count() == 1 for name in ('home', 'about', 'work', 'interests', 'games', 'contact')))
        for name in ('interests', 'games', 'contact'):
            page.locator('.site-header__nav a[href="#' + name + '"]').click()
            images = page.locator('#' + name + ' img[loading="lazy"]')
            for image in images.all():
                image.scroll_into_view_if_needed()
                # Native load/complete is inspected synchronously, not an Image
                # callback promise that cannot run with page scripts disabled.
                for _ in range(40):
                    if image.evaluate('e=>e.complete&&e.naturalWidth>0'):
                        break
                    page.wait_for_timeout(50)
                check('nojs_native_image_loaded_' + image.get_attribute('src').rsplit('/', 1)[-1],
                      image.evaluate('e=>e.complete&&e.naturalWidth>0'), image.get_attribute('src'))
        page.locator('.site-header__nav a[href="#work"]').click()
        for details in page.locator('.personal-project__details').all():
            details.locator('summary').click()
            check('nojs_native_project_detail_' + str(details.evaluate('e=>e.closest("tr").id')),
                  details.evaluate('e=>e.open') and details.locator('.personal-project__highlights').is_visible())
        check('nojs_mobile_has_no_horizontal_overflow', page.evaluate('() => document.documentElement.scrollWidth<=innerWidth'))
        check('nojs_no_failed_responses', not entry['failedResponses'], entry['failedResponses'])
        ctx.close()
        browser.close()
    report['status'] = 'passed'
finally:
    save()

print(json.dumps({'status': report['status'], 'checks': len(report['checks']), 'output': str(args.output)}))
