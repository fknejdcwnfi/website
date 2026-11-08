#!/usr/bin/env python3
"""Exercise production CSP and optional-browser-signal failures on a local preview.

The injected API failures and script attempts exist only in isolated browser
contexts. No source, publication content, credentials or external service changes.
"""
from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path
from urllib.parse import urlsplit

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
CANVAS = '.reference-scene__canvas'
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url', default='http://127.0.0.1:5180/')
parser.add_argument('--output', type=Path, default=ROOT / 'artifacts/security-audit/browser')
args = parser.parse_args()
if urlsplit(args.url).hostname not in ('127.0.0.1', 'localhost', '::1'):
    raise ValueError('Run the failure-injection audit against a local production preview.')
args.output.mkdir(parents=True, exist_ok=True)
report = {'status': 'failed', 'url': args.url, 'checks': [], 'contexts': [],
          'scope': 'Local final production build; isolated test injections, no deployment assertions.'}


def save():
    (args.output / 'checks.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')


def check(name, passed, detail=None):
    report['checks'].append({'name': name, 'passed': bool(passed), 'detail': detail})
    save()
    if not passed:
        raise AssertionError((name, detail))


CAPTURE = r'''(() => {
  window.__audit={violations:[],observers:[],legacyAdds:0,legacyRemoves:0,originalVideo:null};
  document.addEventListener('securitypolicyviolation',event=>window.__audit.violations.push({
    directive:event.effectiveDirective,blocked:event.blockedURI,disposition:event.disposition}));
  const play=HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play=function(...args){
    if(this.id==='vermouth-poetic-bootstrap')window.__audit.originalVideo??=this;
    return play.apply(this,args);
  };
})();'''


def wait_scene(page, playback='looping'):
    page.wait_for_selector(CANVAS + f'[data-ready=true][data-playback={playback}]')


def local_content(page, label):
    check(label + '_complete_site', all(page.locator('#' + section).count() == 1
          for section in ('home', 'about', 'work', 'interests', 'games', 'contact')))
    page.locator('#site-search').fill('过河')
    result = page.locator('#site-search-results a[href="#project-xiangqi-review"]')
    result.wait_for()
    result.click()
    page.wait_for_function('() => document.activeElement.id==="project-xiangqi-review"')
    check(label + '_legitimate_search_functions', page.url.endswith('#project-xiangqi-review'))
    page.locator('.site-header__nav a[href="#home"]').click()


def no_unexpected_events(page, entry, label):
    violations = page.evaluate('window.__audit.violations')
    entry['violations'] = violations
    check(label + '_no_unexpected_csp_violations', not violations, violations)
    check(label + '_no_js_errors', not entry['errors'], entry['errors'])
    check(label + '_no_failed_responses', not entry['badResponses'], entry['badResponses'])


try:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])

        def context(label, injection='', **options):
            options.setdefault('viewport', {'width': 1440, 'height': 1100})
            ctx = browser.new_context(**options)
            ctx.set_default_timeout(10000)
            ctx.set_default_navigation_timeout(20000)
            ctx.add_init_script(CAPTURE + '\n' + injection)
            entry = {'label': label, 'errors': [], 'badResponses': [], 'requests': []}
            report['contexts'].append(entry)
            page = ctx.new_page()
            page.on('pageerror', lambda error: entry['errors'].append(str(error)))
            page.on('response', lambda response: entry['badResponses'].append(
                {'url': response.url, 'status': response.status}) if response.status >= 400 else None)
            page.on('request', lambda request: entry['requests'].append(request.url))
            return ctx, page, entry

        ctx, page, entry = context('normal_csp')
        response = page.goto(args.url)
        check('production_http_200', response.status == 200)
        wait_scene(page)
        policy = page.locator('meta[http-equiv="Content-Security-Policy"]').get_attribute('content')
        directives = {part.strip().split()[0]: part.strip().split()[1:] for part in policy.split(';') if part.strip()}
        check('csp_hashes_trusted_startup_without_unsafe_script',
              directives.get('default-src') == ["'none'"] and "'self'" in directives.get('script-src', []) and
              len([token for token in directives.get('script-src', []) if token.startswith("'sha256-")]) == 2 and
              not any(token in directives.get('script-src', []) for token in ("'unsafe-inline'", "'unsafe-eval'")), policy)
        check('csp_restricts_objects_base_and_form', all(directives.get(key) == ["'none'"]
              for key in ('object-src', 'base-uri', 'form-action')), directives)
        check('no_inline_handler_attributes_in_actual_dom', page.evaluate('''![...document.querySelectorAll('*')]
          .some(e=>[...e.attributes].some(a=>/^on/i.test(a.name)))'''))
        page.wait_for_function('''() => [...document.fonts].some(f=>f.family.replaceAll('"','').toLowerCase()==='fusion pixel'&&f.status==='loaded')''')
        check('real_pixel_font_loads_with_policy', True)
        local_content(page, 'normal')
        page.reload()
        wait_scene(page)
        no_unexpected_events(page, entry, 'normal_reload')
        page.screenshot(path=str(args.output / 'normal-production.png'))

        # CDP evaluate is test instrumentation; the elements it inserts must
        # still obey the page policy. Expected violation events are separate.
        page.evaluate('''() => {
          const script=document.createElement('script');script.textContent='window.__auditInlineRan=true';document.head.append(script);
          const button=document.createElement('button');button.id='audit-handler';
          button.setAttribute('onclick','window.__auditHandlerRan=true');button.textContent='test';document.body.append(button);button.click();
        }''')
        page.wait_for_function('() => window.__audit.violations.length>=2')
        attempts = page.evaluate('''({inline:window.__auditInlineRan===true,handler:window.__auditHandlerRan===true,
          violations:window.__audit.violations})''')
        check('actual_injected_inline_script_and_handler_blocked', not attempts['inline'] and not attempts['handler'] and
              any(v['directive'] == 'script-src-elem' for v in attempts['violations']) and
              any(v['directive'] == 'script-src-attr' for v in attempts['violations']), attempts)
        ctx.close()

        legacy = r'''(() => {
          const native=window.matchMedia.bind(window);
          window.matchMedia=query=>{const media=native(query);return {media:media.media,get matches(){return media.matches},
            addListener(fn){window.__audit.legacyAdds++;media.addEventListener('change',fn)},
            removeListener(fn){window.__audit.legacyRemoves++;media.removeEventListener('change',fn)}}};
        })();'''
        ctx, page, entry = context('legacy_media_listeners', legacy)
        page.goto(args.url)
        wait_scene(page)
        page.emulate_media(reduced_motion='reduce')
        wait_scene(page, 'static')
        page.emulate_media(reduced_motion='no-preference')
        wait_scene(page)
        check('legacy_media_listener_real_preference_changes', page.evaluate('window.__audit.legacyAdds>0'))
        no_unexpected_events(page, entry, 'legacy_media')
        ctx.close()

        for label, injection in [('missing_media_query', 'window.matchMedia=undefined;'),
                                 ('throwing_media_query', 'window.matchMedia=()=>{throw new Error("injected matchMedia failure")};')]:
            ctx, page, entry = context(label, injection)
            page.goto(args.url)
            wait_scene(page, 'static')
            early = [url for url in entry['requests'] if '/poetic-pixel/' in url and
                     any(asset in url for asset in ('/atlas.png', '/boot.mp4'))]
            check(label + '_unknown_preference_conservatively_static', not early, early)
            page.get_by_role('button', name='开启动态', exact=True).click()
            wait_scene(page)
            page.get_by_role('button', name='跟随系统', exact=True).click()
            wait_scene(page, 'static')
            check(label + '_explicit_choice_reversible', True)
            local_content(page, label)
            no_unexpected_events(page, entry, label)
            ctx.close()

        for observer in ('IntersectionObserver', 'ResizeObserver'):
            for failure in ('constructor', 'observe'):
                label = observer + '_' + failure + '_failure'
                injection = (f'window.{observer}=class{{constructor(){{throw new Error("injected constructor failure")}}}};'
                             if failure == 'constructor' else f'''window.{observer}=class{{
                               constructor(callback){{this.callback=callback;this.disconnected=false;window.__audit.observers.push(this)}}
                               observe(){{throw new Error("injected observe failure")}}
                               disconnect(){{this.disconnected=true}}
                             }};''')
                ctx, page, entry = context(label, injection)
                page.goto(args.url)
                wait_scene(page)
                width = page.locator('.reference-scene__viewport').evaluate('e=>e.getBoundingClientRect().width')
                page.set_viewport_size({'width': 390, 'height': 844})
                page.wait_for_function('''() => {const r=document.querySelector('.reference-scene__viewport').getBoundingClientRect();
                  return r.width>0&&r.width<=innerWidth&&r.right<=innerWidth+.5}''')
                smaller = page.locator('.reference-scene__viewport').evaluate('e=>e.getBoundingClientRect().width')
                check(label + '_fallback_resize_measurement_works', 0 < smaller < width,
                      {'desktop': width, 'mobile': smaller})
                if failure == 'observe':
                    cleanup = page.evaluate('''() => {
                      for(const observer of window.__audit.observers)observer.callback([{isIntersecting:false}],observer);
                      return window.__audit.observers.length>0&&window.__audit.observers.every(o=>o.disconnected);
                    }''')
                    wait_scene(page)
                    check(label + '_partial_observers_disconnected_and_queued_callbacks_ignored', cleanup)
                local_content(page, label)
                no_unexpected_events(page, entry, label)
                ctx.close()

        # Parser gets a real query and starts the original media. A later query
        # throws during React render before it can reattach the retained node.
        boundary = r'''(() => {
          const native=window.matchMedia.bind(window);let preferences=0;
          window.matchMedia=query=>{
            if(query==='(prefers-reduced-motion: reduce)'&&++preferences>1)
              return {get matches(){throw new Error('injected React render failure')}};
            return native(query);
          };
        })();'''
        ctx, page, entry = context('boundary_retained_video_cleanup', boundary)
        page.goto(args.url)
        page.wait_for_function('''() => window.__audit.originalVideo&&document.querySelector('.static-site')&&
          !document.querySelector('.reference-scene__canvas')&&window.__vermouthPoeticVideo===undefined''')
        cleanup = page.evaluate('''() => {const v=window.__audit.originalVideo;return {
          paused:v.paused,src:v.getAttribute('src'),connected:v.isConnected,
          globalsCleared:window.__vermouthPoeticVideo===undefined&&window.__vermouthPoeticEntry===undefined,
          sameAsFallback:v===document.getElementById('vermouth-poetic-bootstrap')};}''')
        check('boundary_original_video_not_orphan_playing', cleanup['paused'] and cleanup['src'] is None and
              not cleanup['connected'] and cleanup['globalsCleared'] and not cleanup['sameAsFallback'], cleanup)
        fallback = page.evaluate('''() => {
          const v=document.querySelector('.static-site video'),entry=document.querySelector('.static-site .poetic-entry-group'),
            preview=document.querySelector('.static-site .reference-scene__preview');
          return {video:!!v,src:v?.getAttribute('src'),autoplay:v?.autoplay,preload:v?.preload,paused:v?.paused,
            nestedSources:[...document.querySelectorAll('.static-site video source[src]')].length,
            weather:entry?.dataset.weather,motion:entry?.dataset.motion,preview:preview?.dataset.active};
        }''')
        check('boundary_new_fallback_video_cannot_autoplay', fallback['video'] and fallback['src'] is None and
              not fallback['autoplay'] and fallback['preload'] == 'none' and fallback['paused'] and
              fallback['nestedSources'] == 0, fallback)
        check('boundary_new_fallback_entry_is_static', fallback['weather'] == 'hidden' and
              fallback['motion'] == 'paused' and fallback['preview'] == 'false', fallback)
        check('boundary_keeps_complete_static_content', all(page.locator('#' + section).count() == 1
              for section in ('home', 'about', 'work', 'interests', 'games', 'contact')))
        check('boundary_error_is_only_injected_failure', all('injected React render failure' in error for error in entry['errors']), entry['errors'])
        check('boundary_no_csp_violations', not page.evaluate('window.__audit.violations'))
        ctx.close()

        # Evaluate the real exported helper on an actual detached browser DOM.
        # Node strips TS for Function.toString; no test copy of the helper logic.
        helper = subprocess.run(['node', '--input-type=module', '-e',
            "import {snapshotStaticFallback} from './src/app/staticFallback.ts';process.stdout.write(snapshotStaticFallback.toString())"],
            cwd=ROOT, text=True, capture_output=True, timeout=10, check=True).stdout
        ctx, page, entry = context('inert_snapshot_actual_dom')
        page.goto(args.url)
        wait_scene(page)
        snapshot = page.evaluate('''() => {
          const snapshotStaticFallback=(''' + helper + ''');
          const holder=document.createElement('template');
          holder.innerHTML='<div><div class="reference-scene__preview" data-active="true"><div class="poetic-entry-group" data-weather="visible" data-motion="running"><video id="fixture-video" src="/fixture.mp4" autoplay preload="auto" data-ready="true"><source src="/nested.mp4"></video></div></div></div>';
          const root=holder.content.firstElementChild;
          const before=root.innerHTML,html=snapshotStaticFallback(root),template=document.createElement('template');template.innerHTML=html;
          const video=template.content.querySelector('video'),entry=template.content.querySelector('.poetic-entry-group');
          return {originalUnchanged:root.innerHTML===before,sourceRemoved:!video.hasAttribute('src'),
            autoplayRemoved:!video.hasAttribute('autoplay'),preload:video.preload,readyRemoved:!video.hasAttribute('data-ready'),
            nestedRemoved:!template.content.querySelector('source[src]'),weather:entry.dataset.weather,motion:entry.dataset.motion,
            preview:template.content.querySelector('.reference-scene__preview').dataset.active};
        }''')
        check('actual_snapshot_preserves_original_dom_and_disables_copy', all(snapshot[key] for key in
              ('originalUnchanged', 'sourceRemoved', 'autoplayRemoved', 'readyRemoved', 'nestedRemoved')) and
              snapshot['preload'] == 'none' and snapshot['weather'] == 'hidden' and
              snapshot['motion'] == 'paused' and snapshot['preview'] == 'false', snapshot)
        no_unexpected_events(page, entry, 'snapshot_actual_dom')
        ctx.close()

        for query in ('view=portrait', 'style=legacy', 'style=voxel'):
            label = 'archive_' + query.replace('=', '_')
            ctx, page, entry = context(label)
            page.goto(args.url.split('?', 1)[0].split('#', 1)[0] + '?' + query)
            page.wait_for_selector('.stage__canvas')
            page.wait_for_function('''() => {
              const c=document.querySelector('.stage__canvas'),ctx=c?.getContext('2d');if(!ctx||c.width<10||c.height<10)return false;
              return ctx.getImageData(Math.floor(c.width/2)-5,Math.floor(c.height/2)-5,10,10).data.some((v,i)=>i%4===3&&v>0);
            }''')
            check(label + '_actual_canvas_painted', True)
            no_unexpected_events(page, entry, label)
            ctx.close()

        for width in (390, 320, 667, 1280):
            label = f'short_search_{width}x320'
            ctx, page, entry = context(label, viewport={'width': width, 'height': 320})
            page.goto(args.url)
            page.wait_for_selector('#site-search')
            page.wait_for_function('''() => [...document.fonts].some(f=>f.family.includes('Fusion Pixel')&&f.status==='loaded')''')
            page.keyboard.press('/')
            page.wait_for_selector('#site-search-results')
            layout = page.evaluate('''() => {
              const bounds=e=>{const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:r.height}};
              const list=document.querySelector('.site-search__list');return {
                width:innerWidth,height:innerHeight,panel:bounds(document.querySelector('#site-search-results')),
                summary:bounds(document.querySelector('.site-search__summary')),list:bounds(list),
                help:bounds(document.querySelector('.site-search__help')),listClient:list.clientHeight,listScroll:list.scrollHeight};
            }''')
            entry['shortSearch'] = layout
            check(label + '_panel_summary_and_help_fit', all(
                item['top'] >= 0 and item['bottom'] <= 320.5 and item['left'] >= -.5 and item['right'] <= width + .5
                for item in (layout['panel'], layout['summary'], layout['help'])), layout)
            check(label + '_only_results_scroll_within_available_space',
                  60 <= layout['listClient'] < layout['listScroll'] and
                  layout['list']['top'] >= layout['summary']['bottom'] - .5 and
                  layout['list']['bottom'] <= layout['help']['top'] + .5, layout)
            page.screenshot(path=str(args.output / f'search-short-after-{width}.png'))
            hrefs = page.locator('#site-search-results .site-search__result').evaluate_all(
                'links=>links.map(a=>a.getAttribute("href"))')
            reached = []
            for href in hrefs:
                page.keyboard.press('ArrowDown')
                page.wait_for_function('href=>document.activeElement.getAttribute("href")===href', arg=href)
                reached.append(page.evaluate('''() => {
                  const e=document.activeElement,r=e.getBoundingClientRect(),l=e.closest('.site-search__list').getBoundingClientRect();
                  return {href:e.getAttribute('href'),top:r.top,bottom:r.bottom,
                    visible:r.top>=Math.max(0,l.top)-.5&&r.bottom<=Math.min(innerHeight,l.bottom)+.5};
                }'''))
            entry['shortSearchKeyboardResults'] = reached
            check(label + '_all_results_keyboard_reachable_and_visible', len(reached) == 8 and
                  all(item['visible'] for item in reached), reached)
            page.keyboard.press('Escape')
            page.locator('#site-search-results').wait_for(state='detached')
            check(label + '_escape_returns_input', page.locator('#site-search').evaluate('e=>e===document.activeElement'))
            page.locator('#site-search').click()
            page.wait_for_selector('#site-search-results')
            check(label + '_same_focused_input_can_reopen', True)
            no_unexpected_events(page, entry, label)
            ctx.close()
        browser.close()

    report['status'] = 'passed'
finally:
    save()

print(json.dumps({'status': report['status'], 'checks': len(report['checks']), 'output': str(args.output)}))
