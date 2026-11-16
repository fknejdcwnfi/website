#!/usr/bin/env python3
"""Measure actual local decoration selection after viewing all five cards."""
import argparse
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url', required=True)
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)
report = {'url': args.url, 'condition': 'Fresh local Chromium contexts; explicit pause; all five decorations scrolled into view; encoded resource bytes, not visitor latency', 'layouts': []}
selectors = ['.interest-card__image', '.game-showcase__image', '.social-card__scene']
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for width, dpr in [(375, 1), (375, 2), (1440, 1), (1440, 2)]:
        ctx = browser.new_context(viewport={'width': width, 'height': 1000}, device_scale_factor=dpr, reduced_motion='reduce')
        ctx.add_init_script("try { localStorage.setItem('vermouth-scene-motion','static') } catch (_) {}")
        page = ctx.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        response = page.goto(args.url)
        assert response.status == 200
        page.wait_for_selector('.personal-site:not(.static-site)')
        imgs = page.locator(','.join(selectors))
        assert imgs.count() == 5
        for image in imgs.all():
            image.scroll_into_view_if_needed()
            image.evaluate('img=>img.decode()')
        values = imgs.evaluate_all('''imgs=>imgs.map(img=>({src:img.currentSrc,width:img.naturalWidth,height:img.naturalHeight,
          displayWidth:img.getBoundingClientRect().width,srcset:img.getAttribute('srcset'),
          loading:img.loading,alt:img.alt,hidden:img.getAttribute('aria-hidden'),
          encodedBytes:performance.getEntriesByName(img.currentSrc).reduce((sum,e)=>sum+e.encodedBodySize,0)}))''')
        assert all(v['encodedBytes'] > 0 and v['loading'] == 'lazy' and v['alt'] == '' and v['hidden'] == 'true' for v in values)
        assert not errors, errors
        report['layouts'].append({'width': width, 'dpr': dpr, 'decorations': values, 'totalEncodedBytes': sum(v['encodedBytes'] for v in values), 'errors': errors})
        ctx.close()
    browser.close()
(args.output/'measurements.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
print(json.dumps({'status': 'passed', 'samples': len(report['layouts']), 'bytes': [v['totalEncodedBytes'] for v in report['layouts']]}))
