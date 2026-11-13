#!/usr/bin/env python3
"""Measure one fresh local production page; no visitor CWV or display-FPS claim."""
import argparse
import json
from pathlib import Path
from urllib.parse import urlsplit

from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url', required=True)
parser.add_argument('--output', type=Path, required=True)
parser.add_argument('--width', type=int, default=1440)
parser.add_argument('--height', type=int, default=1100)
parser.add_argument('--dpr', type=float, default=1)
args = parser.parse_args()
if not (240 <= args.width <= 3840 and 240 <= args.height <= 2160 and 1 <= args.dpr <= 4):
    parser.error('Use a bounded test viewport and DPR between 1 and 4.')
args.output.parent.mkdir(parents=True, exist_ok=True)
report = {'conditions': f'Fresh single desktop Chromium with {args.width}x{args.height} CSS viewport/DPR{args.dpr:g}, local production preview, unthrottled; no screenshot or concurrent browser. This is a synthetic viewport, not a physical mobile device. Decoded resource body sizes are not compressed internet transfer or visitor CWV.', 'url': args.url, 'browserErrors': [], 'badResponses': []}
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': args.width, 'height': args.height}, device_scale_factor=args.dpr)
    page.on('pageerror', lambda e: report['browserErrors'].append(str(e)))
    page.on('response', lambda r: report['badResponses'].append({'url': r.url, 'status': r.status}) if r.status >= 400 else None)
    page.goto(args.url)
    page.wait_for_selector('.reference-scene__canvas[data-ready=true][data-playback=looping]')
    page.evaluate('document.fonts.ready')
    page.wait_for_timeout(2000)
    report['initialResources'] = page.evaluate('performance.getEntriesByType("resource").map(r=>({name:r.name,initiator:r.initiatorType,decodedBodySize:r.decodedBodySize,transferSize:r.transferSize,duration:r.duration}))')
    for section in ['about', 'work', 'interests', 'games', 'contact']:
        page.locator('#' + section).scroll_into_view_if_needed()
        page.wait_for_timeout(180)
    page.wait_for_timeout(1000)
    report['allResources'] = page.evaluate('performance.getEntriesByType("resource").map(r=>({name:r.name,initiator:r.initiatorType,decodedBodySize:r.decodedBodySize,transferSize:r.transferSize,duration:r.duration}))')
    report['documentBytes'] = page.evaluate('performance.getEntriesByType("navigation")[0].decodedBodySize')
    report['decorativeResources'] = [r for r in report['allResources'] if '/assets/pixel-ui/' in r['name'] and urlsplit(r['name']).path.endswith(('.png', '.webp'))]
    report['decorativeDecodedBytes'] = sum(r['decodedBodySize'] for r in report['decorativeResources'])
    report['sameOriginOnly'] = all(urlsplit(r['name']).netloc == urlsplit(args.url).netloc for r in report['allResources'])
    report['archiveRuntimeRequested'] = any(any(fragment in r['name'] for fragment in ['ArchivedPortrait-', 'voxelPlayer-', '/assets/portrait-rig/', '/assets/faithful-pixel/']) for r in report['allResources'])
    report['status'] = 'passed' if not report['browserErrors'] and not report['badResponses'] and report['sameOriginOnly'] and not report['archiveRuntimeRequested'] else 'failed'
    browser.close()
args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({key: report[key] for key in ['status', 'decorativeDecodedBytes', 'sameOriginOnly', 'archiveRuntimeRequested', 'browserErrors', 'badResponses']}))
assert report['status'] == 'passed'
