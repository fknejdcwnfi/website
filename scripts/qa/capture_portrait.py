#!/usr/bin/env python3
"""Capture a calm 24-second portrait cycle and its real circular presentation.

A controlled rAF clock drives the production PortraitPlayer at exact timestamps.
Raw Canvas PNGs preserve the 256-square pixel grid; the GIF is a real browser
screenshot of the circular viewport every40ms, never interpolated still images.
Neither timestamp sampling nor GIF playback is a physical-display FPS benchmark.
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import html
import io
import json
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
LOOP_MS = 12000
BLINK_CYCLE_MS = 24000
KEY_TIMES = list(range(0, LOOP_MS, 1200))
BLINK_STARTS = [4400, 11300, 20300]
BLINK_DURATION_MS = 280
UNIFORM_TIMES = list(range(0, BLINK_CYCLE_MS, 100))
# Ten-ms eye samples supplement the broad motion cycle, with real timestamp mapping.
SAMPLE_TIMES = sorted(set(UNIFORM_TIMES).union(*(range(start - 20, start + 301, 10) for start in BLINK_STARTS)))
GIF_TIMES = list(range(0, BLINK_CYCLE_MS, 40))
CONTROLLED_RAF = r"""
window.__captureRAF = new Map();
window.__captureRAFId = 0;
window.requestAnimationFrame = callback => {
  const id = ++window.__captureRAFId;
  window.__captureRAF.set(id, callback);
  return id;
};
window.cancelAnimationFrame = id => window.__captureRAF.delete(id);
window.__captureStep = elapsed => {
  const callbacks = [...window.__captureRAF.values()];
  window.__captureRAF.clear();
  for (const callback of callbacks) callback(1000 + elapsed);
  return callbacks.length;
};
"""


def route(url: str, **parameters: object) -> str:
    parts = urlsplit(url)
    query = dict(parse_qsl(parts.query))
    for name in ('t', 'pose', 'pause', 'debug'):
        query.pop(name, None)
    query.setdefault('view', 'portrait')
    query.update({name: str(value) for name, value in parameters.items()})
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


def raw_canvas(page) -> bytes:
    encoded = page.locator('canvas').evaluate("canvas => canvas.toDataURL('image/png').split(',')[1]")
    return base64.b64decode(encoded)


def save_gif(path: Path, frames: list[bytes], duration_ms: int) -> dict:
    images = [Image.open(io.BytesIO(frame)).copy() for frame in frames]
    images[0].save(path, save_all=True, append_images=images[1:], duration=duration_ms,
                   loop=0, optimize=True, disposal=2)
    with Image.open(path) as gif:
        total = 0
        for index in range(gif.n_frames):
            gif.seek(index)
            total += gif.info['duration']
        assert total == BLINK_CYCLE_MS, (path, total)
        return {'file': path.name, 'sampled_frames': len(frames), 'encoded_frames': gif.n_frames,
                'duration_ms': total, 'bytes': path.stat().st_size, 'sample_interval_ms': duration_ms, 'covered_clock': 'Complete24s joint wind/blink cycle; two12s breeze cycles and all three independent blinks',
                'source': 'Actual circular CSS viewport screenshots from the production player at every40ms timestamp',
                'interpretation': '25Hz GIF time slots are a preview, not realtime display FPS evidence'}


def gallery_markup(samples: list[dict], poses: list[dict], title: str, compact: bool = False) -> str:
    style = """*{box-sizing:border-box}body{margin:0;background:#edf0df;color:#243b29;font:13px system-ui;padding:20px}h1{font-size:20px;margin:0 0 8px}p{max-width:1050px;line-height:1.6;margin:8px 0 18px}main{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:6px}figure{margin:0;padding:4px;background:#fffdf1;border:1px solid #bfcbb1}img{display:block;width:100%;aspect-ratio:1;object-fit:contain;image-rendering:pixelated;background:repeating-conic-gradient(#e7eddd 0% 25%,#f7f5eb 0% 50%) 50%/12px 12px}figcaption{font:10px ui-monospace,monospace;padding-top:4px;white-space:nowrap}a{color:#285b2e}section{margin:20px 0}section main{grid-template-columns:repeat(10,minmax(0,1fr))}@media(max-width:700px){main{grid-template-columns:repeat(4,minmax(0,1fr))}section main{grid-template-columns:repeat(5,minmax(0,1fr))}}"""
    result = f"<!doctype html><html lang='zh-Hant'><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>{html.escape(title)}</title><style>{style}</style><h1>{html.escape(title)}</h1>"
    result += f'<p>實際 production PortraitPlayer Canvas 輸出。微風週期12秒、獨立眨眼週期24秒，完整24秒每100ms取樣240點，眨眼窗口再每10ms細化，共{len(samples)}個時刻。這是確定性時間取樣，並非實測螢幕FPS。此處展示原始256²像素網格；網站圓形裁切見動畫預覽。</p>'
    if poses and not compact:
        result += '<section><h2>10個明確參考姿態</h2><p>姿態1／10明確顯示canonical靜止角色；正常微風起點並不停止。姿態4／5為半閉／全閉眼檢閱。</p><main>'
        for pose in poses:
            result += f"<figure><a href='{pose['file']}'><img src='{pose['file']}' alt='參考姿態 {pose['pose']}'></a><figcaption>POSE {pose['pose']:02} · {pose['time_ms']} ms</figcaption></figure>"
        result += '</main></section>'
    result += '<main>'
    for sample in samples:
        result += f"<figure><a href='{sample['file']}'><img src='{sample['file']}' alt='{sample['time_ms']}毫秒實際畫面'></a><figcaption>#{sample['index']:03} · {sample['time_ms']} ms</figcaption></figure>"
    return result + '</main></html>'


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', default='http://127.0.0.1:4178/website/')
    parser.add_argument('--output', type=Path, default=ROOT / 'artifacts/gentle-portrait')
    parser.add_argument('--chromium', default='/usr/bin/chromium')
    parser.add_argument('--skip-gif', action='store_true')
    args = parser.parse_args()
    output = args.output.resolve()
    frames_path = output / 'frames'
    frames_path.mkdir(parents=True, exist_ok=True)
    errors: list[str] = []
    all_frames: dict[str, bytes] = {}
    timeline_frames: dict[int, bytes] = {}
    samples: list[dict] = []
    poses: list[dict] = []
    anchors: list[dict] = []
    gif_frames: list[bytes] = []

    def record(data: bytes) -> dict:
        sha = hashlib.sha256(data).hexdigest()
        if sha not in all_frames:
            all_frames[sha] = data
            (frames_path / f'{sha}.png').write_bytes(data)
        return {'file': f'frames/{sha}.png', 'sha256': sha, 'bytes': len(data)}

    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=args.chromium, args=['--no-sandbox'])
        # 390px / DPR1 yields an exact 1:1 256px viewport, keeping the GIF small.
        page = browser.new_page(viewport={'width': 390, 'height': 844}, device_scale_factor=1)
        page.add_init_script(CONTROLLED_RAF)
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('response', lambda response: errors.append(f'HTTP{response.status}: {response.url}') if response.status >= 400 else None)
        response = page.goto(route(args.url, pixel=256))
        assert response and response.status == 200
        page.wait_for_selector('canvas[data-ready=true][data-painted=true][data-playback=looping]')
        page.evaluate('document.fonts.ready')
        page.wait_for_timeout(100)
        assert page.locator('canvas').get_attribute('data-loop-duration') == str(LOOP_MS)
        page.evaluate('window.__captureStep(0)')
        sampled = set(SAMPLE_TIMES)
        gif_times = set(GIF_TIMES if not args.skip_gif else [])
        for time_ms in sorted(sampled | gif_times | set(KEY_TIMES)):
            if time_ms:
                page.evaluate('time=>window.__captureStep(time)', time_ms)
            if time_ms in sampled or time_ms in KEY_TIMES:
                data = raw_canvas(page)
                timeline_frames[time_ms] = data
                item = {'time_ms': time_ms, **record(data)}
                if time_ms in sampled:
                    samples.append({'index': len(samples), **item})
                if time_ms in KEY_TIMES:
                    anchors.append({'kind': 'continuous wind anchor', **item})
            if time_ms in gif_times:
                gif_frames.append(page.locator('.portrait-viewport__art').screenshot())
        for pose, time_ms in enumerate(KEY_TIMES, 1):
            page.goto(route(args.url, pose=pose, pixel=256))
            page.wait_for_selector('canvas[data-ready=true][data-painted=true][data-playback=static]')
            page.evaluate('window.__captureStep(0)')
            poses.append({'pose': pose, 'time_ms': time_ms, 'kind': 'explicit frozen reference pose', **record(raw_canvas(page))})
        assert poses[0]['sha256'] == poses[-1]['sha256']
        original = ROOT / 'assets/source/original_reference.jpg'
        blink_time = BLINK_STARTS[0] + 100
        # Both exact comparison phases are already among the actual samples.
        cards = [('原始參考 · 身份／構圖', original.read_bytes(), 'jpeg', False),
                 ('實際Canvas · 持續微風0ms', timeline_frames[0], 'png', True),
                 ('實際Canvas · 緩風吹髮6000ms', timeline_frames[6000], 'png', True),
                 ('實際Canvas · 獨立眨眼4500ms', timeline_frames[blink_time], 'png', True)]
        comparison = browser.new_page(viewport={'width': 1120, 'height': 350}, device_scale_factor=1)
        markup = "<!doctype html><meta charset='utf-8'><style>*{box-sizing:border-box}body{margin:0;padding:18px;background:#edf0df;color:#243b29;font:13px system-ui}main{display:grid;grid-template-columns:repeat(4,256px);gap:20px}figure{margin:0}img{display:block;width:256px;height:256px;object-fit:contain}.pixel{image-rendering:pixelated}figcaption{padding:12px 0 0}footer{padding-top:10px;font-size:11px}</style><main>"
        for caption, data, extension, pixel in cards:
            markup += f"<figure><img class='{'pixel' if pixel else ''}' src='data:image/{extension};base64,{base64.b64encode(data).decode()}'><figcaption>{caption}</figcaption></figure>"
        comparison.set_content(markup + '</main><footer>原始邏輯Canvas用於像素／身份核對；網站採無邊框圓形CSS裁切，GIF展示實際圓形。</footer>')
        comparison.screenshot(path=str(output / 'comparison.png'))
        comparison.close()
        (output / 'gallery.html').write_text(gallery_markup(samples, poses, f'{len(samples)}個持續微風／眨眼實際樣本'))
        selected = [samples[round(index * (len(samples) - 1) / 143)] for index in range(144)]
        sheet = browser.new_page(viewport={'width': 1400, 'height': 1800}, device_scale_factor=1)
        sheet.route('**/frames/*.png', lambda request: request.fulfill(path=output / urlsplit(request.request.url).path.lstrip('/')))
        sheet.set_content(gallery_markup(selected, [], '144格縮圖 · 完整樣本見gallery.html', compact=True).replace('<meta charset', "<base href='http://capture.local/'><meta charset", 1))
        sheet.wait_for_function('[...document.images].every(image=>image.complete&&image.naturalWidth>0)')
        sheet.screenshot(path=str(output / 'contact_sheet_144.png'), full_page=True)
        sheet.close()
        gif_result = save_gif(output / 'animation_preview.gif', gif_frames, 40) if gif_frames else None
        page.goto(route(args.url, pose=1, pixel=256));page.wait_for_selector('canvas[data-ready=true][data-painted=true]')
        page.evaluate('window.__captureStep(0)')
        page.screenshot(path=str(output / 'mobile.png'))
        desktop = browser.new_page(viewport={'width': 1440, 'height': 1000}, device_scale_factor=1)
        desktop.goto(route(args.url, t=0));desktop.wait_for_selector('canvas[data-ready=true][data-painted=true]')
        desktop.screenshot(path=str(output / 'desktop.png'));desktop.close()
        browser.close()
    assert not errors, errors
    manifest = {'url': args.url, 'source': 'Real production PortraitPlayer driven by controlled rAF timestamps; actual Canvas exports',
                'wind_loop_ms': LOOP_MS, 'blink_cycle_ms': BLINK_CYCLE_MS, 'blink_starts_ms': BLINK_STARTS,
                'sample_count': len(samples), 'uniform_interval_ms': 100, 'uniform_samples': len(UNIFORM_TIMES),
                'blink_detail_interval_ms': 10, 'unique_png_files': len(all_frames),
                'unique_png_bytes': sum(map(len, all_frames.values())),
                'sample_time_definition': '24s every100ms plus10ms samples from20ms before to300ms after each independent blink start',
                'deduplication': 'SHA-256 of actual PNG bytes; every sampled timestamp retains its own mapping',
                'file_paths_relative_to': 'capture output directory, parent of frames/',
                'samples': samples, 'reference_poses': poses, 'continuous_anchors': anchors}
    (frames_path / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    names = {Path(item['file']).name for item in samples + poses + anchors}
    for path in frames_path.glob('*.png'):
        if path.name not in names:
            path.unlink()
    result = {'url': args.url, 'logical_size': [256, 256], 'wind_loop_ms': LOOP_MS,
              'blink_cycle_ms': BLINK_CYCLE_MS, 'blink_starts_ms': BLINK_STARTS,
              'sampled_timeline_frames': len(samples), 'reference_poses': len(poses),
              'continuous_anchor_frames': len(anchors), 'unique_png_files': len(all_frames),
              'unique_png_bytes': sum(map(len, all_frames.values())), 'reference_poses_1_equals_10': True,
              'canonical_rest_sha256': poses[0]['sha256'],
              'original_reference_sha256': hashlib.sha256(original.read_bytes()).hexdigest(),
              'source': 'Real production PortraitPlayer Canvas exports plus circular browser screenshots',
              'browser_errors': errors, 'gif': gif_result, 'manifest': 'frames/manifest.json',
              'gallery': 'gallery.html', 'contact_sheet': 'contact_sheet_144.png',
              'interpretation': 'Timestamp sampling demonstrates deterministic continuous motion; realtime performance is reported separately'}
    (output / 'capture.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    main()
