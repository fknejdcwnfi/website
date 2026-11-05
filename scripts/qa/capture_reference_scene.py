#!/usr/bin/env python3
"""Capture the complete scenic presentation at controlled rAF timestamps.

The movie includes the actual outer scenery, circular HD portrait and independent
snow layer. Encoded review FPS is not a measurement of a physical display. Raw
uncropped HD Canvas anchors are saved separately without filtering.
"""
from __future__ import annotations
import argparse, base64, hashlib, json, math, subprocess, tempfile, time
from pathlib import Path
from urllib.parse import urljoin
from playwright.sync_api import sync_playwright
from capture_portrait import CONTROLLED_RAF

ROOT = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url', default='http://127.0.0.1:4173/website/')
parser.add_argument('--output', type=Path, default=ROOT / 'artifacts/scenic-snow/preview')
parser.add_argument('--fps', type=int, default=120)
parser.add_argument('--loops', type=int, default=5)
parser.add_argument('--stage-selector', default='.reference-scene__stage')
parser.add_argument('--snow-selector', default='.reference-scene__snow')
args = parser.parse_args()
if not 1 <= args.fps <= 240 or not 1 <= args.loops <= 20:
    parser.error('Use 1–240 encoded FPS and 1–20 complete source loops.')
out = args.output
out.mkdir(parents=True, exist_ok=True)
anchors = out / 'hd-anchors'
anchors.mkdir(exist_ok=True)
errors = []
started = time.monotonic()
canvas_selector = '.reference-scene__canvas'

with tempfile.TemporaryDirectory(prefix='scenic-scene-capture-') as temporary:
    scratch = Path(temporary)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        page = browser.new_page(viewport={'width': 1440, 'height': 1100}, device_scale_factor=1)
        page.add_init_script(CONTROLLED_RAF)
        # Keep source phase deterministic despite the real-time bootstrap decoder.
        # Real autoplay/handoff is verified separately without this QA-only shim.
        page.add_init_script('''(() => {
            const property = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'currentTime');
            Object.defineProperty(HTMLMediaElement.prototype, 'currentTime', {...property,
                get() { return this.id === 'vermouth-bootstrap' ? 0 : property.get.call(this); }});
        })();''')
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(args.url)
        page.wait_for_selector(canvas_selector + '[data-ready=true][data-playback=looping]')
        page.wait_for_selector('.reference-scene[data-upgraded=true] .reference-scene__boot-host[hidden]', state='attached')
        manifest = page.evaluate('''async url => {
            const response = await fetch(url); if (!response.ok) throw Error('Manifest load failed');
            return response.json();
        }''', urljoin(args.url, 'assets/reference-scene/pixel-smooth-manifest.json'))
        source_manifest = page.evaluate('''async url => (await fetch(url)).json()''',
                                        urljoin(args.url, 'assets/reference-scene/pixel-source-manifest.json'))
        duration_ms = manifest['durationMs'] * args.loops
        count = math.ceil(duration_ms * args.fps / 1000)
        page.evaluate('window.__captureStep(0)')
        portrait = page.locator('.reference-scene__viewport')
        presentation = portrait.evaluate('''element => {
            const rect = element.getBoundingClientRect(), style = getComputedStyle(element);
            const canvas = element.querySelector('canvas'), pixels = getComputedStyle(canvas);
            return {x: rect.x, y: rect.y, width: rect.width, height: rect.height,
                radius: style.borderRadius, border: style.borderTopWidth, shadow: style.boxShadow,
                canvasWidth: canvas.width, canvasHeight: canvas.height,
                initialElapsedMs: Number(canvas.dataset.initialElapsedMs || 0),
                imageRendering: pixels.imageRendering, objectFit: pixels.objectFit};
        }''')
        assert abs(presentation['width'] - presentation['height']) < .01, presentation
        assert presentation['radius'] == '50%', presentation
        assert presentation['border'] == '0px' and presentation['shadow'] == 'none', presentation
        assert presentation['objectFit'] == 'cover', presentation
        assert [presentation['canvasWidth'], presentation['canvasHeight']] == [manifest['width'] * 2, manifest['height'] * 2], presentation
        assert presentation['imageRendering'] in ('pixelated', 'crisp-edges'), presentation
        assert presentation['initialElapsedMs'] == 0, presentation
        stage = page.locator(args.stage_selector)
        stage_data = stage.evaluate('''element => {
            const rect = element.getBoundingClientRect();
            const image = element.querySelector('.reference-scene__scenery');
            const style = image && getComputedStyle(image);
            return {x: rect.x, y: rect.y, width: rect.width, height: rect.height,
                scenery: image ? {width: image.naturalWidth, height: image.naturalHeight,
                    objectFit: style.objectFit, complete: image.complete} : null};
        }''')
        assert stage_data['scenery'] and stage_data['scenery']['complete'], stage_data
        assert stage_data['scenery']['objectFit'] == 'contain', stage_data
        assert stage_data['width'] > presentation['width'], stage_data
        weather = page.locator(args.snow_selector)
        assert weather.count() == 1, 'The real independent snowfall layer must be captured.'
        weather_size = weather.evaluate('canvas => [canvas.width, canvas.height]')
        clip = {key: stage_data[key] for key in ('x', 'y', 'width', 'height')}
        sampled_frames, snow_hashes = set(), []
        for index in range(count):
            page.evaluate('elapsed => window.__captureStep(elapsed)', index * 1000 / args.fps)
            sampled_frames.add(page.locator(canvas_selector).get_attribute('data-source-frame'))
            page.screenshot(path=str(scratch / f'frame_{index:04d}.png'), clip=clip,
                            animations='disabled', caret='hide', scale='css')
            if index in (0, count // 2, count - 1):
                snow_hashes.append(weather.evaluate('canvas => canvas.toDataURL()'))
            if index % args.fps == 0:
                print(f'Captured {index}/{count}', flush=True)
        assert len(set(snow_hashes)) == 3, 'Snow must change across the actual captured stage.'
        original_starts = [0]
        for interval in source_manifest['frameDurationsMs'][:-1]:
            original_starts.append(original_starts[-1] + interval)
        raw_hashes, anchor_frames = [], []
        samples_per_anchor, remainder = divmod(manifest['frameCount'], source_manifest['frameCount'])
        assert remainder == 0, 'Derived samples must form complete source-anchor groups'
        for index, elapsed in enumerate(original_starts):
            page.evaluate('elapsed => window.__captureStep(elapsed)', duration_ms + elapsed)
            actual_frame = int(page.locator(canvas_selector).get_attribute('data-source-frame'))
            expected_frame = index * samples_per_anchor
            assert actual_frame == expected_frame, {'anchor': index, 'expected': expected_frame, 'actual': actual_frame}
            anchor_frames.append(actual_frame)
            encoded = page.locator(canvas_selector).evaluate("canvas => canvas.toDataURL('image/png').split(',')[1]")
            data = base64.b64decode(encoded)
            (anchors / f'frame_{index:02d}.png').write_bytes(data)
            raw_hashes.append(hashlib.sha256(data).hexdigest())
        browser.close()
    assert not errors, errors
    movie = out / 'animation.mp4'
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-framerate', str(args.fps), '-i',
                    str(scratch / 'frame_%04d.png'), '-frames:v', str(count), '-vf',
                    'pad=ceil(iw/2)*2:ceil(ih/2)*2:0:0:color=white', '-c:v', 'libx264',
                    '-crf', '16', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(movie)], check=True)
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', str(movie), '-vf',
                    f"fps={1000 / source_manifest['frameDurationsMs'][0]},scale={source_manifest['width']}:-1:flags=neighbor,tile=4x4",
                    '-frames:v', '1', str(out / 'contact.png')], check=True)

report = {
    'source': 'Complete real scenic CSS stage including outer background, circular HD portrait and independent snowfall; controlled rAF timestamps; no movie rescaling',
    'fpsEncoding': args.fps, 'frames': count, 'durationMs': duration_ms,
    'encodedDurationMs': round(count * 1000 / args.fps, 6), 'sourceLoops': args.loops,
    'sourceFrameCount': source_manifest['frameCount'], 'estimatedSampleCount': manifest['frameCount'],
    'estimatedSampleRate': round(manifest['frameCount'] * 1000 / manifest['durationMs'], 3),
    'presentation': presentation, 'stage': stage_data, 'snowCanvasSize': weather_size,
    'snowDistinctCheckpoints': len(set(snow_hashes)), 'uniqueSourceSamplesCaptured': len(sampled_frames),
    'uncroppedHdAnchors': {'directory': anchors.name, 'count': len(raw_hashes), 'actualSourceFrames': anchor_frames, 'pngSha256': raw_hashes},
    'bytes': movie.stat().st_size, 'sha256': hashlib.sha256(movie.read_bytes()).hexdigest(),
    'browserErrors': errors, 'captureWallSeconds': round(time.monotonic() - started, 3),
    'physicalDisplayVerified': False,
    'interpretation': 'Encoded FPS and controlled sampling do not measure physical display refresh. A single restyled pixel master is driven by source motion and reconstructed at two-times resolution; added output pixels are not recovered source details. Motion interframes and extended backdrop remain explicitly derived.'
}
(out / 'capture.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report))
