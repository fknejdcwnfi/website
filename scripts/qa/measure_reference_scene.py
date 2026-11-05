#!/usr/bin/env python3
"""Measure the real production scene at native browser cadence without screenshots."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import statistics
from urllib.parse import urljoin

from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url', default='http://127.0.0.1:4173/website/')
parser.add_argument('--output', type=Path, default=Path('artifacts/reference-scene/performance.json'))
parser.add_argument('--loops', type=int, default=10)
args = parser.parse_args()
if not 1 <= args.loops <= 40:
    parser.error('Use 1–40 complete source loops.')

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1440, 'height': 1100}, device_scale_factor=1)
    errors, http_errors, workers = [], [], []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('response', lambda response: http_errors.append({'url': response.url, 'status': response.status}) if response.status >= 400 else None)
    page.on('worker', lambda worker: workers.append(worker.url))
    page.add_init_script('''
        window.__sceneMeasure = {active: false, cost: [], paints: 0, long: [], timestamps: [], sourceFrames: []};
        const nativeRAF = requestAnimationFrame;
        window.requestAnimationFrame = callback => nativeRAF(timestamp => {
            const start = performance.now(); callback(timestamp);
            if (__sceneMeasure.active) {
                __sceneMeasure.cost.push(performance.now() - start);
                __sceneMeasure.timestamps.push(timestamp);
            }
        });
        const draw = CanvasRenderingContext2D.prototype.drawImage;
        CanvasRenderingContext2D.prototype.drawImage = function(...args) {
            if (__sceneMeasure.active && this.canvas.dataset.scene) {
                __sceneMeasure.paints++;
                __sceneMeasure.sourceFrames.push(this.canvas.dataset.sourceFrame);
            }
            return draw.apply(this, args);
        };
        new PerformanceObserver(list => {
            if (__sceneMeasure.active) for (const entry of list.getEntries()) __sceneMeasure.long.push(entry.duration);
        }).observe({type: 'longtask', buffered: false});
    ''')
    page.goto(args.url)
    page.wait_for_selector('.reference-scene canvas[data-ready=true][data-playback=looping]')
    ready_ms = page.evaluate('performance.now()')
    manifest = page.evaluate('''async url => {
        const response = await fetch(url); if (!response.ok) throw Error('Manifest load failed');
        return response.json();
    }''', urljoin(args.url, 'assets/reference-scene/smooth-manifest.json'))
    presentation = page.locator('.reference-scene__viewport').evaluate('''element => {
        const rect = element.getBoundingClientRect(), style = getComputedStyle(element), canvas = element.querySelector('canvas');
        return {cssWidth: rect.width, cssHeight: rect.height, canvasWidth: canvas.width, canvasHeight: canvas.height,
            radius: style.borderRadius, border: style.borderTopWidth, shadow: style.boxShadow, dpr: devicePixelRatio};
    }''')
    page.wait_for_timeout(2500)
    sample_ms = manifest['durationMs'] * args.loops
    result = page.evaluate('''async milliseconds => {
        const measurement = window.__sceneMeasure; measurement.active = true;
        const start = performance.now(); await new Promise(resolve => setTimeout(resolve, milliseconds));
        measurement.active = false; return {...measurement, seconds: (performance.now() - start) / 1000};
    }''', sample_ms)
    browser.close()

costs = sorted(result['cost'])
assert costs, 'No native rAF callbacks were measured'
quantile = lambda values, proportion: values[min(len(values) - 1, int((len(values) - 1) * proportion))]
timestamps = result['timestamps']
intervals = sorted(after - before for before, after in zip(timestamps, timestamps[1:]) if after > before)
report = {
    'conditions': f"Fresh single production Chromium page; 1440x1100; DPR1; native rAF; no CPU/network throttling; 2.5s settle; {sample_ms / 1000:g}s sample ({args.loops} source loops); no screenshots or concurrent browsers",
    'physicalDisplayVerified': False, 'readyMsLocal': round(ready_ms, 2), 'presentation': presentation,
    'sourceDurationMs': manifest['durationMs'], 'estimatedSampleCount': manifest['frameCount'],
    'estimatedSampleRate': round(manifest['frameCount'] * 1000 / manifest['durationMs'], 3),
    'paints': result['paints'], 'seconds': round(result['seconds'], 3),
    'paintsPerSecond': round(result['paints'] / result['seconds'], 2),
    'uniqueSourceSamplesPainted': len(set(result['sourceFrames'])),
    'callbackMs': {'median': round(statistics.median(costs), 3), 'p95': round(quantile(costs, .95), 3), 'max': round(max(costs), 3)},
    'rafIntervalMs': {'median': round(statistics.median(intervals), 3), 'p95': round(quantile(intervals, .95), 3), 'max': round(max(intervals), 3)} if intervals else None,
    'longTasksMs': result['long'], 'workers': workers, 'browserErrors': errors, 'httpErrors': http_errors,
    'interpretation': 'Native headless-browser cadence and callback CPU cost, not verified physical monitor FPS. Estimated source samples do not increase the source GIF information rate.'
}
assert not errors and not http_errors, report
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report))
