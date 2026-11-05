#!/usr/bin/env python3
"""Capture the real circular CSS viewport with a controlled production rAF clock.

Encoded review FPS is a sampling choice, not a measurement of a physical display.
The uncropped native Canvas anchors are saved separately without resampling.
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import math
from pathlib import Path
import subprocess
import tempfile
import time
from urllib.parse import urljoin

from playwright.sync_api import sync_playwright
from capture_portrait import CONTROLLED_RAF

ROOT = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url', default='http://127.0.0.1:4173/website/')
parser.add_argument('--output', type=Path, default=ROOT / 'artifacts/reference-scene/preview')
parser.add_argument('--fps', type=int, default=120)
parser.add_argument('--loops', type=int, default=5)
args = parser.parse_args()
if not 1 <= args.fps <= 240 or not 1 <= args.loops <= 20:
    parser.error('Use 1–240 encoded FPS and 1–20 complete source loops.')
out = args.output
out.mkdir(parents=True, exist_ok=True)
anchors = out / 'native-anchors'
anchors.mkdir(exist_ok=True)
errors = []
started = time.monotonic()

with tempfile.TemporaryDirectory(prefix='reference-scene-capture-') as temporary:
    scratch = Path(temporary)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        page = browser.new_page(viewport={'width': 1440, 'height': 1100}, device_scale_factor=1)
        page.add_init_script(CONTROLLED_RAF)
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(args.url)
        page.wait_for_selector('.reference-scene canvas[data-ready=true][data-playback=looping]')
        manifest = page.evaluate('''async url => {
            const response = await fetch(url); if (!response.ok) throw Error('Manifest load failed');
            return response.json();
        }''', urljoin(args.url, 'assets/reference-scene/smooth-manifest.json'))
        source_manifest = page.evaluate('''async url => (await fetch(url)).json()''',
                                        urljoin(args.url, 'assets/reference-scene/source-manifest.json'))
        duration_ms = manifest['durationMs'] * args.loops
        count = math.ceil(duration_ms * args.fps / 1000)
        page.evaluate('window.__captureStep(0)')
        # Capture the actual browser clip and pixel rendering. Reading a raw
        # Canvas alone would omit the owner's circular presentation.
        viewport = page.locator('.reference-scene__viewport')
        presentation = viewport.evaluate('''element => {
            const rect = element.getBoundingClientRect(), style = getComputedStyle(element);
            const canvas = element.querySelector('canvas'), pixels = getComputedStyle(canvas);
            return {x: rect.x, y: rect.y, width: rect.width, height: rect.height,
                radius: style.borderRadius, border: style.borderTopWidth,
                shadow: style.boxShadow, canvasWidth: canvas.width, canvasHeight: canvas.height,
                imageRendering: pixels.imageRendering, objectFit: pixels.objectFit};
        }''')
        assert abs(presentation['width'] - presentation['height']) < .01, presentation
        assert presentation['radius'] == '50%', presentation
        assert presentation['border'] == '0px' and presentation['shadow'] == 'none', presentation
        assert presentation['objectFit'] == 'cover', presentation
        assert [presentation['canvasWidth'], presentation['canvasHeight']] == [manifest['width'], manifest['height']], presentation
        assert presentation['imageRendering'] in ('pixelated', 'crisp-edges'), presentation
        clip = {key: presentation[key] for key in ('x', 'y', 'width', 'height')}
        sampled_frames = set()
        for index in range(count):
            page.evaluate('elapsed => window.__captureStep(elapsed)', index * 1000 / args.fps)
            sampled_frames.add(page.locator('.reference-scene canvas').get_attribute('data-source-frame'))
            page.screenshot(path=str(scratch / f'frame_{index:04d}.png'), clip=clip,
                            animations='disabled', caret='hide', scale='css')
            if index % args.fps == 0:
                print(f'Captured {index}/{count}', flush=True)
        # Continue the same clock into a fresh loop; do not rewind elapsed time.
        original_starts = [0]
        for interval in source_manifest['frameDurationsMs'][:-1]:
            original_starts.append(original_starts[-1] + interval)
        raw_hashes, anchor_frames = [], []
        samples_per_anchor, anchor_remainder = divmod(manifest['frameCount'], source_manifest['frameCount'])
        assert anchor_remainder == 0, 'Derived samples must form complete source-anchor groups'
        for index, elapsed in enumerate(original_starts):
            page.evaluate('elapsed => window.__captureStep(elapsed)', duration_ms + elapsed)
            actual_frame = int(page.locator('.reference-scene canvas').get_attribute('data-source-frame'))
            expected_frame = index * samples_per_anchor
            assert actual_frame == expected_frame, {'anchor': index, 'sourceTimeMs': elapsed, 'expectedFrame': expected_frame, 'actualFrame': actual_frame}
            anchor_frames.append(actual_frame)
            encoded = page.locator('.reference-scene canvas').evaluate("canvas => canvas.toDataURL('image/png').split(',')[1]")
            data = base64.b64decode(encoded)
            (anchors / f'frame_{index:02d}.png').write_bytes(data)
            raw_hashes.append(hashlib.sha256(data).hexdigest())
        browser.close()
    assert not errors, errors
    movie = out / 'animation.mp4'
    # yuv420p needs even dimensions; padding affects only a possible final outer
    # row/column. There is no scaling or filtering of the captured CSS pixels.
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-framerate', str(args.fps), '-i',
                    str(scratch / 'frame_%04d.png'), '-frames:v', str(count), '-vf',
                    'pad=ceil(iw/2)*2:ceil(ih/2)*2:0:0:color=white', '-c:v', 'libx264',
                    '-crf', '16', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(movie)], check=True)
    # Contact sheet is a reduced review artifact; raw anchors above retain all
    # production Canvas pixels and the movie retains actual CSS viewport size.
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', str(movie), '-vf',
                    f"fps={1000 / source_manifest['frameDurationsMs'][0]},scale={manifest['height']}:{manifest['height']}:flags=neighbor,tile=4x4",
                    '-frames:v', '1', str(out / 'contact.png')], check=True)

report = {
    'source': 'Actual production circular CSS viewport screenshots at controlled rAF timestamps; no pixel rescaling in movie',
    'fpsEncoding': args.fps, 'frames': count, 'durationMs': duration_ms,
    'encodedDurationMs': round(count * 1000 / args.fps, 6), 'sourceLoops': args.loops,
    'sourceFrameCount': source_manifest['frameCount'], 'estimatedSampleCount': manifest['frameCount'],
    'estimatedSampleRate': round(manifest['frameCount'] * 1000 / manifest['durationMs'], 3),
    'presentation': presentation, 'uniqueSourceSamplesCaptured': len(sampled_frames),
    'uncroppedNativeAnchors': {'directory': anchors.name, 'count': len(raw_hashes), 'actualSourceFrames': anchor_frames, 'pngSha256': raw_hashes},
    'bytes': movie.stat().st_size, 'sha256': hashlib.sha256(movie.read_bytes()).hexdigest(),
    'browserErrors': errors, 'captureWallSeconds': round(time.monotonic() - started, 3),
    'physicalDisplayVerified': False,
    'interpretation': 'Encoded FPS and controlled timestamp sampling do not measure physical display refresh. Original GIF anchors and estimated motion-compensated samples remain distinct.'
}
(out / 'capture.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report))
