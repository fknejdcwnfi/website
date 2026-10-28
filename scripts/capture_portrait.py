#!/usr/bin/env python3
"""Capture the actual website canvas, reference comparison, and a 2300ms GIF.

Requires Python Playwright, Chromium and Pillow. Start Vite or production preview
first, then run e.g. python3 scripts/capture_portrait.py --url http://127.0.0.1:5174/.
The GIF samples deterministic website time seeks, not wall-clock capture timing.
Pillow only encodes the captured canvas frames; it does not redraw/filter them.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import io
import json
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
KEY_TIMES = [0, 230, 460, 630, 740, 850, 1020, 1300, 1570, 1890]


def route(url: str, **parameters: object) -> str:
    parts = urlsplit(url)
    query = dict(parse_qsl(parts.query))
    query.update({name: str(value) for name, value in parameters.items()})
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


def capture(page, url: str, time_ms: int) -> bytes:
    response = page.goto(route(url, t=time_ms, pixel=256))
    if response is None or response.status != 200:
        raise RuntimeError(f"The portrait page did not return HTTP 200 at t={time_ms}")
    page.wait_for_selector("canvas[data-style='portrait'][data-ready='true']")
    data = page.locator("canvas").evaluate("canvas => canvas.toDataURL('image/png').split(',')[1]")
    return base64.b64decode(data)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://127.0.0.1:5173/")
    parser.add_argument("--output", type=Path, default=ROOT / "artifacts")
    parser.add_argument("--chromium", default="/usr/bin/chromium")
    parser.add_argument("--skip-gif", action="store_true")
    args = parser.parse_args()
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    errors: list[str] = []
    frames: dict[int, bytes] = {}
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=args.chromium, headless=True, args=["--no-sandbox"])
        page = browser.new_page(viewport={"width": 1200, "height": 1000}, device_scale_factor=1)
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.on("response", lambda response: errors.append(f"HTTP {response.status}: {response.url}") if response.status >= 400 else None)
        for index, time_ms in enumerate(KEY_TIMES, 1):
            frames[time_ms] = capture(page, args.url, time_ms)
            (output / f"pixel_frame_{index:02}.png").write_bytes(frames[time_ms])
        (output / "pixel_reference.png").write_bytes(frames[0])
        assert frames[0] == frames[1890], "The final key pose must equal the resting portrait"
        original = ROOT / "assets/source/original_reference.jpg"
        cards = [("原始參考 · 身份／構圖", original.read_bytes(), "jpeg", False),
                 ("實際網站 · 靜止 0 ms", frames[0], "png", True),
                 ("實際網站 · 風動 1020 ms", frames[1020], "png", True),
                 ("實際網站 · 閉眼 740 ms", frames[740], "png", True)]
        comparison = browser.new_page(viewport={"width": 1120, "height": 336}, device_scale_factor=1)
        markup = """<!doctype html><meta charset='utf-8'><style>
        *{box-sizing:border-box}body{margin:0;padding:18px;background:#071222;color:#ead8bc;font:13px system-ui}
        main{display:grid;grid-template-columns:repeat(4,256px);gap:20px}figure{margin:0}img{display:block;width:256px;height:256px}
        .pixel{image-rendering:pixelated}figcaption{padding:12px 0 0}footer{padding-top:10px;color:#8fa5b9;font-size:11px}
        </style><main>"""
        for caption, data, extension, pixel in cards:
            markup += f"<figure><img class='{'pixel' if pixel else ''}' src='data:image/{extension};base64,{base64.b64encode(data).decode()}'><figcaption>{caption}</figcaption></figure>"
        markup += "</main><footer>像素畫面皆取自同一網站 Canvas；AI 輔助像素重繪並非原圖幾何誤差認證。</footer>"
        comparison.set_content(markup)
        comparison.screenshot(path=str(output / "comparison.png"))
        comparison.close()
        gif_result = None
        if not args.skip_gif:
            times = sorted(set(range(0, 2300, 40)) | set(KEY_TIMES))
            images = []
            for time_ms in times:
                if time_ms not in frames:
                    frames[time_ms] = capture(page, args.url, time_ms)
                images.append(Image.open(io.BytesIO(frames[time_ms])).copy())
            durations = [b - a for a, b in zip(times, times[1:] + [2300])]
            gif_path = output / "animation_preview.gif"
            images[0].save(gif_path, save_all=True, append_images=images[1:], duration=durations,
                           loop=0, optimize=True, disposal=2)
            with Image.open(gif_path) as gif:
                encoded_duration = 0
                for index in range(gif.n_frames):
                    gif.seek(index)
                    encoded_duration += gif.info["duration"]
                assert encoded_duration == 2300
                gif_result = {"sampled_frames": len(times), "encoded_frames": gif.n_frames,
                              "duration_ms": encoded_duration, "bytes": gif_path.stat().st_size,
                              "sampling": "Deterministic actual website canvas time seeks; not realtime FPS evidence"}
        page.goto(route(args.url, t=0, pixel=256))
        page.wait_for_selector("canvas[data-ready='true']")
        page.screenshot(path=str(output / "desktop.png"))
        mobile = browser.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        mobile.goto(route(args.url, t=0, pixel=256))
        mobile.wait_for_selector("canvas[data-ready='true']")
        mobile.screenshot(path=str(output / "mobile.png"))
        mobile.close()
        browser.close()
    if errors:
        raise RuntimeError("Browser capture failed: " + "; ".join(errors))
    result = {"url": args.url, "logical_size": [256, 256], "key_times_ms": KEY_TIMES,
              "pixel_reference_sha256": hashlib.sha256(frames[0]).hexdigest(),
              "original_reference_sha256": hashlib.sha256(original.read_bytes()).hexdigest(),
              "source": "Actual website canvas exports, not standalone AI candidate images",
              "frame_01_equals_10": True, "browser_errors": errors, "gif": gif_result}
    (output / "capture.json").write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
