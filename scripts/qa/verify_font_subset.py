#!/usr/bin/env python3
"""Verify actual startup subset, original-font fallback and browser glyph parity.

Use a local production preview and a distinct --output for each hosting base.
Initial requests are captured before deliberately loading the original font for
comparison. This is functional font QA, not an internet-transfer/CWV benchmark.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import time
from urllib.parse import urljoin, urlsplit

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url', default='http://127.0.0.1:5180/')
parser.add_argument('--output', type=Path, default=ROOT / 'artifacts/audit-20261113/font-browser')
args = parser.parse_args()
target = urlsplit(args.url)
if (target.scheme not in ('http', 'https') or target.hostname not in ('127.0.0.1', 'localhost', '::1')
        or target.username or target.password):
    raise ValueError('Font QA accepts only credential-free local production previews.')
args.output.mkdir(parents=True, exist_ok=True)
manifest = json.loads((ROOT / 'public/fonts/fusion-pixel-startup-subset.json').read_text())
report = {'status': 'failed', 'url': args.url, 'checks': [], 'contexts': [],
          'scope': 'Local production font selection, decoded glyph pixels and metrics; no deployment, physical-device or CWV assertions.'}


def save():
    (args.output / 'checks.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')


def check(name, passed, detail=None):
    report['checks'].append({'name': name, 'passed': bool(passed), 'detail': detail})
    save()
    if not passed:
        raise AssertionError((name, detail))


FACE_INFO = r'''() => [...document.fonts]
  .filter(f=>f.family.replaceAll('"','').toLowerCase()==='fusion pixel')
  .map(f=>({family:f.family,status:f.status,unicodeRange:f.unicodeRange,
    full:f.unicodeRange.replaceAll(' ','').toUpperCase()==='U+0-10FFFF'}))'''
FONT_REQUESTS = '''() => performance.getEntriesByType('resource').filter(r=>r.name.includes('/fonts/'))
  .map(r=>({url:r.name,initiator:r.initiatorType,decodedBodySize:r.decodedBodySize}))'''
CAPTURE = '''() => {window.__fontViolations=[];document.addEventListener('securitypolicyviolation',e=>
  window.__fontViolations.push({directive:e.effectiveDirective,blocked:e.blockedURI}));}'''
SAMPLES = ['欢迎来到我的像素小世界', 'HELLOWORLD fknejdcwnfi', '作品与实验 0123456789', 'GitHub TypeScript Canvas', '… • ↑ ©']


def wait_faces(page, predicate, timeout=8):
    # Native CSS/font loading still works without page JavaScript. Python-side
    # polling avoids depending on page timers or font event callbacks in no-JS QA.
    end = time.monotonic() + timeout
    last = []
    while time.monotonic() < end:
        last = page.evaluate(FACE_INFO)
        if predicate(last):
            return last
        page.wait_for_timeout(50)
    return last


def check_responses(responses, file, digest, label):
    matching = [r for r in responses if urlsplit(r.url).path.endswith('/fonts/' + file)]
    check(label + '_font_response_received', bool(matching), [r.url for r in matching])
    for index, response in enumerate(matching):
        data = response.body()
        check(label + f'_font_response_{index}_bytes_match', response.status == 200 and
              hashlib.sha256(data).hexdigest() == digest,
              {'url': response.url, 'status': response.status, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})


try:
    local_full = ROOT / 'public/fonts' / manifest['source']
    check('original_font_bytes_preserved', hashlib.sha256(local_full.read_bytes()).hexdigest() == manifest['sourceSha256'])
    local_subset = ROOT / 'public/fonts' / manifest['file']
    check('subset_bytes_match_manifest', hashlib.sha256(local_subset.read_bytes()).hexdigest() == manifest['sha256'])
    check('all_comparison_characters_have_subset_glyphs', all(ord(c) in manifest['codepoints'] for text in SAMPLES for c in text))
    for name, digest in manifest['licenses'].items():
        check('license_preserved_' + name, hashlib.sha256((ROOT / 'public/fonts' / name).read_bytes()).hexdigest() == digest)

    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])

        def new_page(label, javascript=True):
            ctx = browser.new_context(viewport={'width': 1440, 'height': 1100}, java_script_enabled=javascript)
            ctx.set_default_timeout(15000)
            if javascript:
                ctx.add_init_script('(' + CAPTURE + ')()')
            page = ctx.new_page()
            entry = {'label': label, 'errors': [], 'badResponses': []}
            responses = []
            report['contexts'].append(entry)
            page.on('pageerror', lambda e: entry['errors'].append(str(e)))
            page.on('response', lambda r: responses.append(r) if '/fonts/' in r.url else None)
            page.on('response', lambda r: entry['badResponses'].append({'url': r.url, 'status': r.status}) if r.status >= 400 else None)
            page.goto(args.url, wait_until='load')
            return ctx, page, entry, responses

        ctx, page, entry, responses = new_page('normal_initial_then_deliberate_full_comparison')
        page.locator('#site-search').wait_for()
        page.wait_for_selector('.reference-scene__canvas[data-ready=true]')
        faces = wait_faces(page, lambda fs: any(not f['full'] and f['status'] == 'loaded' for f in fs))
        initial = page.evaluate(FONT_REQUESTS)
        entry['initialRequestsBeforeAnyComparison'] = initial
        entry['initialFaces'] = faces
        subset_url = urljoin(page.url, 'fonts/' + manifest['file']) + '?v=' + manifest['sha256']
        check('default_subset_face_loaded', any(not f['full'] and f['status'] == 'loaded' for f in faces), faces)
        check('default_full_face_remains_unloaded', bool(faces) and any(f['full'] for f in faces) and
              all(f['status'] == 'unloaded' for f in faces if f['full']), faces)
        check('default_font_requests_subset_only', bool(initial) and
              all(urlsplit(r['url']).path.endswith('/fonts/' + manifest['file']) for r in initial), initial)
        check('default_preload_is_reused_same_url', len(initial) == 1 and initial[0]['url'] == subset_url, initial)
        check('default_subset_body_size', sum(r['decodedBodySize'] for r in initial) == manifest['bytes'], initial)
        check_responses(responses, manifest['file'], manifest['sha256'], 'default_subset')
        check('default_ui_keeps_pixel_family', page.evaluate('''() =>
          [...document.querySelectorAll('body,h1,h2,h3,.personal-site input,.personal-site button,.personal-site summary')]
            .every(e=>getComputedStyle(e).fontFamily.toLowerCase().includes('fusion pixel'))'''))

        # Only after preserving the normal initial-request snapshot, load an
        # explicit original alias. This request is test activity, not startup.
        original_url = urljoin(page.url, 'fonts/' + manifest['source'])
        comparisons = page.evaluate('''async ({original,samples}) => {
          const face=new FontFace('Audit Original Pixel',`url("${original}")`);
          document.fonts.add(face);await face.load();
          await Promise.all(samples.map(text=>document.fonts.load('42px "Fusion Pixel"',text)));
          const results=[];
          for(const size of [12,16,24,42]) for(const text of samples){
            const draw=family=>{const canvas=document.createElement('canvas');canvas.width=1600;canvas.height=160;
              const context=canvas.getContext('2d');context.font=`${size}px "${family}"`;
              context.fontKerning='normal';context.textBaseline='alphabetic';context.fillStyle='#472e20';
              const m=context.measureText(text);context.fillText(text,8,90);
              return {pixels:context.getImageData(0,0,1600,160).data,
                metrics:Object.fromEntries(['width','actualBoundingBoxLeft','actualBoundingBoxRight',
                  'actualBoundingBoxAscent','actualBoundingBoxDescent','fontBoundingBoxAscent','fontBoundingBoxDescent']
                    .map(key=>[key,m[key]]))};};
            const a=draw('Fusion Pixel'),b=draw('Audit Original Pixel');let changedPixels=0,paintedPixels=0;
            for(let i=0;i<a.pixels.length;i+=4){if(a.pixels[i+3])paintedPixels++;
              if(a.pixels[i]!==b.pixels[i]||a.pixels[i+1]!==b.pixels[i+1]||a.pixels[i+2]!==b.pixels[i+2]||a.pixels[i+3]!==b.pixels[i+3])changedPixels++;}
            results.push({size,text,changedPixels,paintedPixels,subsetMetrics:a.metrics,originalMetrics:b.metrics});
          }return results;
        }''', {'original': original_url, 'samples': SAMPLES})
        entry['deliberateOriginalComparison'] = comparisons
        for comparison in comparisons:
            name = f'{comparison["size"]}px_' + str(SAMPLES.index(comparison['text']))
            check('browser_glyph_pixels_' + name, comparison['changedPixels'] == 0 and comparison['paintedPixels'] > 0, comparison)
            check('browser_glyph_metrics_' + name, comparison['subsetMetrics'] == comparison['originalMetrics'], comparison)
        check_responses(responses, manifest['source'], manifest['sourceSha256'], 'deliberate_original_alias')
        check('normal_context_no_csp_violations', not page.evaluate('() => window.__fontViolations'))
        check('normal_context_no_js_or_http_failures', not entry['errors'] and not entry['badResponses'], entry)
        ctx.close()

        ctx, page, entry, responses = new_page('uncommon_character_uses_original_full_face')
        page.locator('#site-search').wait_for()
        wait_faces(page, lambda fs: any(not f['full'] and f['status'] == 'loaded' for f in fs))
        before = page.evaluate(FONT_REQUESTS)
        check('fallback_fixture_starts_without_full_request', not any(urlsplit(r['url']).path.endswith('/fonts/' + manifest['source']) for r in before), before)
        check('fallback_probe_is_outside_subset', 0x4E01 not in manifest['codepoints'])
        page.evaluate('''async () => {const text=document.createElement('span');text.id='font-uncommon-probe';
          text.textContent='丁';text.style.fontFamily='"Fusion Pixel"';text.style.fontSize='16px';
          document.body.append(text);await document.fonts.load('16px "Fusion Pixel"','丁');}''')
        faces = wait_faces(page, lambda fs: any(f['full'] and f['status'] == 'loaded' for f in fs))
        entry['fontFacesAfterUncommonCharacter'] = faces
        entry['fontRequestsAfterUncommonCharacter'] = page.evaluate(FONT_REQUESTS)
        check('uncommon_text_keeps_pixel_family', 'Fusion Pixel' in page.locator('#font-uncommon-probe').evaluate('e=>getComputedStyle(e).fontFamily'))
        check('uncommon_character_loads_full_face', any(f['full'] and f['status'] == 'loaded' for f in faces), faces)
        check_responses(responses, manifest['source'], manifest['sourceSha256'], 'uncommon_original_fallback')
        check('fallback_context_no_csp_violations', not page.evaluate('() => window.__fontViolations'))
        check('fallback_context_no_js_or_http_failures', not entry['errors'] and not entry['badResponses'], entry)
        ctx.close()

        ctx, page, entry, responses = new_page('no_javascript_static_subset', javascript=False)
        faces = wait_faces(page, lambda fs: any(not f['full'] and f['status'] == 'loaded' for f in fs))
        entry['faces'] = faces
        entry['requests'] = page.evaluate(FONT_REQUESTS)
        check('nojs_static_sections_remain', all(page.locator('#' + part).count() == 1 for part in ['home','about','work','interests','games','contact']))
        check('nojs_subset_loaded', any(not f['full'] and f['status'] == 'loaded' for f in faces), faces)
        check('nojs_default_does_not_request_full_font', not any(urlsplit(r['url']).path.endswith('/fonts/' + manifest['source']) for r in entry['requests']), entry['requests'])
        details = page.locator('#project-living-portrait details')
        details.locator('summary').click()
        check('nojs_native_details_work', details.evaluate('e=>e.open'))
        check_responses(responses, manifest['file'], manifest['sha256'], 'nojs_subset')
        check('nojs_context_no_js_or_http_failures', not entry['errors'] and not entry['badResponses'], entry)
        ctx.close()
        browser.close()
    report['status'] = 'passed'
    save()
    print(json.dumps({'status': report['status'], 'checks': len(report['checks']), 'output': str(args.output)}))
except Exception:
    save()
    raise
