#!/usr/bin/env python3
"""Verify actual default scene pixels, explicit pause, parser handoff and persistence."""
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
    raise ValueError('Use a local built production preview for injected API scenarios.')
args.output.mkdir(parents=True, exist_ok=True)
report = {'status': 'failed', 'url': args.url, 'checks': [], 'contexts': [],
          'scope': 'Local Chromium functionality and real pixel samples; not a performance benchmark.'}
CANVAS = '.reference-scene__canvas'
ENTRY = '#vermouth-poetic-entry'
SAMPLE = r'''() => {
  const c=document.querySelector('.reference-scene__canvas');
  if(!c)return null;
  const x=Math.floor(c.width*.35),y=Math.floor(c.height*.23),w=Math.floor(c.width*.3),h=Math.floor(c.height*.54);
  const bytes=c.getContext('2d').getImageData(x,y,w,h).data;
  let hash=2166136261;
  for(let n=0;n<bytes.length;n++)hash=Math.imul(hash^bytes[n],16777619);
  return {hash:hash>>>0,elapsed:Number(c.dataset.elapsedMs),frame:Number(c.dataset.sourceFrame),
    width:c.width,height:c.height,playback:c.dataset.playback};
}'''


def save():
    (args.output / 'checks.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')


def check(name, passed, detail=None):
    report['checks'].append({'name': name, 'passed': bool(passed), 'detail': detail})
    save()
    if not passed:
        raise AssertionError((name, detail))


def actual_motion(page, label):
    samples = []
    for _ in range(5):
        samples.append(page.evaluate(SAMPLE))
        page.wait_for_timeout(130)
    check(label + '_actual_pixels_and_source_clock_advance',
          len({sample['hash'] for sample in samples}) > 1 and
          len({sample['frame'] for sample in samples}) > 1 and
          samples[-1]['elapsed'] > samples[0]['elapsed'], samples)


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])

    def context(label, injection='', **options):
        options.setdefault('viewport', {'width': 1440, 'height': 1100})
        ctx = browser.new_context(**options)
        ctx.set_default_timeout(30000)
        if injection:
            ctx.add_init_script(injection)
        entry = {'label': label, 'errors': [], 'badResponses': [], 'requests': []}
        report['contexts'].append(entry)
        page = ctx.new_page()
        page.on('pageerror', lambda error: entry['errors'].append(str(error)))
        page.on('response', lambda response: entry['badResponses'].append({'url': response.url, 'status': response.status}) if response.status >= 400 else None)
        page.on('request', lambda request: entry['requests'].append(request.url))
        return ctx, page, entry

    scenarios = [
        ('ordinary_first_visit', '', 'no-preference'),
        ('system_reduce_first_visit', '', 'reduce'),
        ('missing_media_api', 'window.matchMedia=undefined;', 'reduce'),
        ('throwing_media_api', 'window.matchMedia=()=>{throw Error("injected optional API failure")};', 'reduce'),
        ('storage_unavailable', 'Object.defineProperty(window,"localStorage",{get(){throw Error("injected storage failure")}});', 'reduce'),
        ('legacy_follow_system_is_not_pause', 'try{localStorage.setItem("vermouth-motion-enabled","false")}catch(_){}', 'reduce'),
    ]
    for label, injection, motion in scenarios:
        ctx, page, entry = context(label, injection, reduced_motion=motion)
        response = page.goto(args.url)
        check(label + '_production_http_200', response.status == 200)
        page.wait_for_selector(CANVAS + '[data-ready=true][data-playback=looping]')
        check(label + '_reader_pause_control', page.get_by_role('button', name='暂停动态', exact=True).is_visible())
        actual_motion(page, label)
        if label == 'storage_unavailable':
            page.get_by_role('button', name='暂停动态', exact=True).click()
            page.wait_for_selector(CANVAS + '[data-playback=static]')
            page.get_by_role('button', name='开启动画', exact=True).click()
            page.wait_for_selector(CANVAS + '[data-playback=looping]')
            check('storage_failure_keeps_reversible_memory_choice', True)
        check(label + '_no_browser_errors_or_bad_responses', not entry['errors'] and not entry['badResponses'], {'errors': entry['errors'], 'badResponses': entry['badResponses']})
        ctx.close()

    # Without weather, changed central pixels establish that the character itself
    # moves; the ordinary URL checks above do not rely only on particle movement.
    ctx, page, entry = context('character_without_weather', reduced_motion='reduce')
    separator = '&' if '?' in args.url else '?'
    page.goto(args.url + separator + 'atmosphere=0')
    page.wait_for_selector(CANVAS + '[data-playback=looping]')
    check('weather_is_really_disabled', page.locator(CANVAS).get_attribute('data-snow-particles') == '0' and page.locator(CANVAS).get_attribute('data-petal-particles') == '0')
    actual_motion(page, 'character_without_weather')
    # Record the final displayed frame after each actual animation callback, so a
    # real pointer click can be checked without racing a concurrently moving frame.
    page.evaluate('''() => {
      window.__motionSample=''' + SAMPLE + ''';
      window.__motionCanvas=document.querySelector('.reference-scene__canvas');
      const native=requestAnimationFrame;
      window.requestAnimationFrame=callback=>native(time=>{
        callback(time);
        const c=window.__motionCanvas;
        if(c?.dataset.playback==='looping')window.__motionLastDynamic=window.__motionSample();
      });
    }''')
    page.wait_for_function('() => !!window.__motionLastDynamic')
    page.wait_for_function('''() => {
      const frame=Number(document.querySelector('.reference-scene__canvas').dataset.sourceFrame);
      return frame>=12&&frame<=24;
    }''')
    page.get_by_role('button', name='暂停动态', exact=True).click()
    page.wait_for_selector(CANVAS + '[data-playback=static]')
    paused = page.evaluate(SAMPLE)
    last = page.evaluate('window.__motionLastDynamic')
    check('pause_freezes_displayed_frame_without_canonical_snap', paused['hash'] == last['hash'] and paused['elapsed'] == last['elapsed'] and paused['frame'] != 0, {'lastDynamic': last, 'paused': paused})
    page.wait_for_timeout(160)
    check('paused_pixels_and_phase_stay_still', page.evaluate(SAMPLE) == paused)
    page.get_by_role('button', name='开启动画', exact=True).click()
    page.wait_for_selector(CANVAS + '[data-playback=looping]')
    resumed = page.evaluate(SAMPLE)
    check('resume_retains_canvas_and_phase', page.evaluate('window.__motionCanvas===document.querySelector(".reference-scene__canvas")') and resumed['elapsed'] >= paused['elapsed'], {'paused': paused, 'resumed': resumed})
    page.get_by_role('button', name='暂停动态', exact=True).click()
    page.wait_for_selector(CANVAS + '[data-playback=static]')
    start = len(entry['requests'])
    page.reload()
    page.wait_for_selector(CANVAS + '[data-playback=static]')
    reloaded = entry['requests'][start:]
    check('explicit_pause_persists_without_motion_media_download', page.evaluate('localStorage.getItem("vermouth-scene-motion")') == 'static' and not any('/boot.mp4' in url or '/atlas.png' in url for url in reloaded), reloaded)
    check('paused_parser_matches_player', page.locator(ENTRY).get_attribute('data-motion') != 'running')
    page.get_by_role('button', name='开启动画', exact=True).click()
    page.reload()
    page.wait_for_selector(CANVAS + '[data-playback=looping]')
    check('explicit_resume_persists', page.evaluate('localStorage.getItem("vermouth-scene-motion")') == 'dynamic')
    check('motion_control_context_has_no_errors', not entry['errors'] and not entry['badResponses'], {'errors': entry['errors'], 'badResponses': entry['badResponses']})
    ctx.close()

    # Leave the movie loaded while holding the atlas: parser preview is already
    # dynamic under OS reduce before Canvas preparation, then hands off its phase.
    ctx, page, entry = context('reduced_parser_preview_handoff', reduced_motion='reduce')
    pending = []
    page.route('**/assets/poetic-pixel/atlas.png*', lambda route: pending.append(route))
    page.goto(args.url, wait_until='domcontentloaded')
    page.wait_for_selector(ENTRY + '[data-motion=running]')
    page.wait_for_function('() => document.getElementById("vermouth-poetic-bootstrap").currentTime>.08')
    before = page.evaluate('document.getElementById("vermouth-poetic-bootstrap").currentTime')
    page.wait_for_timeout(120)
    after = page.evaluate('document.getElementById("vermouth-poetic-bootstrap").currentTime')
    check('parser_movie_really_advances_before_atlas', after > before and bool(pending), {'beforeSeconds': before, 'afterSeconds': after})
    page.evaluate('window.__originalMotionVideo=document.getElementById("vermouth-poetic-bootstrap")')
    for route in pending:
        route.continue_()
    page.wait_for_selector(CANVAS + '[data-playback=looping]')
    check('preview_handoff_retains_node_and_nonzero_phase', page.evaluate('window.__originalMotionVideo===window.__vermouthPoeticVideo') and float(page.locator(CANVAS).get_attribute('data-initial-elapsed-ms')) > 0)
    check('preview_context_has_no_errors', not entry['errors'] and not entry['badResponses'], {'errors': entry['errors'], 'badResponses': entry['badResponses']})
    ctx.close()

    ctx, page, entry = context('explicit_fixed_inspection', reduced_motion='reduce')
    page.goto(args.url + separator + 't=320&atmosphere=0')
    page.wait_for_selector(CANVAS + '[data-playback=static]')
    fixed = page.evaluate(SAMPLE)
    page.wait_for_timeout(140)
    check('fixed_inspection_stays_fixed_without_normal_control', page.evaluate(SAMPLE) == fixed and page.locator('.reference-scene button').count() == 0)
    check('fixed_context_has_no_errors', not entry['errors'] and not entry['badResponses'], {'errors': entry['errors'], 'badResponses': entry['badResponses']})
    ctx.close()

    # Exhaust the existing two automatic retries, then verify that the moving
    # fallback retains both reader control and the independent manual retry.
    ctx, page, entry = context('failed_atlas_reader_control', reduced_motion='reduce')
    failures = []

    def fail_atlas(route):
        failures.append(route.request.url)
        route.fulfill(status=503, body='Deliberate local atlas failure')

    page.route('**/assets/poetic-pixel/atlas.png*', fail_atlas)
    page.goto(args.url)
    for _ in range(220):
        if len(failures) >= 3:
            break
        page.wait_for_timeout(100)
    check('atlas_retries_remain_bounded_before_fallback_control', len(failures) == 3, len(failures))
    page.wait_for_selector('.reference-scene[data-playback=failed]')
    check('failed_preview_keeps_retry_and_motion_controls', page.get_by_role('button', name='重试加载', exact=True).is_visible() and page.get_by_role('button', name='暂停动态', exact=True).is_visible())
    page.get_by_role('button', name='暂停动态', exact=True).click()
    page.wait_for_selector(ENTRY + '[data-motion=paused]', state='attached')
    check('failed_preview_reader_can_pause', page.evaluate('window.__vermouthPoeticVideo.paused') and page.get_by_role('button', name='重试加载', exact=True).is_visible())
    page.get_by_role('button', name='开启动画', exact=True).click()
    page.wait_for_selector(ENTRY + '[data-motion=running]')
    page.wait_for_function('() => !window.__vermouthPoeticVideo.paused')
    check('failed_preview_reader_can_resume', page.get_by_role('button', name='重试加载', exact=True).is_visible())
    check('failed_preview_only_has_expected_injected_failures', not entry['errors'] and all(response['status'] == 503 and '/atlas.png' in response['url'] for response in entry['badResponses']), {'errors': entry['errors'], 'badResponses': entry['badResponses']})
    ctx.close()
    browser.close()

report['status'] = 'passed'
save()
print(json.dumps({'status': report['status'], 'checks': len(report['checks']), 'output': str(args.output)}))
