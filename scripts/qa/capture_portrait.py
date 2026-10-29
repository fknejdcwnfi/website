#!/usr/bin/env python3
"""Capture 276 actual 120 Hz timeline samples, ten reference poses and previews.

The runtime remains procedural. PNG files are stored once per SHA-256 and every
sample maps to its file in frames/manifest.json. GIF timing is separate from live
rAF performance. Pillow only encodes browser exports, never redraws the portrait.
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
KEY_TIMES = [0, 230, 460, 630, 740, 850, 1020, 1300, 1570, 1890]
LOOP_MS = 2300
SAMPLE_COUNT = 276
SAMPLE_TIMES = [index * 1000 / 120 for index in range(SAMPLE_COUNT)]


def route(url: str, **parameters: object) -> str:
    parts = urlsplit(url)
    query = dict(parse_qsl(parts.query))
    for name in ("t", "pose", "pause", "debug"):
        query.pop(name, None)
    query.setdefault("view", "portrait")
    query.update({name: str(value) for name, value in parameters.items()})
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


def capture(page, url: str, **parameters: object) -> bytes:
    response = page.goto(route(url, pixel=256, **parameters))
    if response is None or response.status != 200:
        raise RuntimeError(f"The portrait page did not return HTTP 200: {parameters}")
    page.wait_for_selector("canvas[data-style='portrait'][data-ready='true'][data-painted='true']")
    data = page.locator("canvas").evaluate("canvas => canvas.toDataURL('image/png').split(',')[1]")
    return base64.b64decode(data)


def save_gif(path: Path, frames: list[bytes], durations: list[int]) -> dict:
    images = [Image.open(io.BytesIO(frame)).copy() for frame in frames]
    images[0].save(path, save_all=True, append_images=images[1:], duration=durations,
                   loop=0, optimize=True, disposal=2)
    with Image.open(path) as gif:
        encoded_duration = 0
        for index in range(gif.n_frames):
            gif.seek(index)
            encoded_duration += gif.info["duration"]
        assert encoded_duration == LOOP_MS, (path, encoded_duration)
        return {"file": path.name, "sampled_frames": len(frames), "encoded_frames": gif.n_frames,
                "duration_ms": encoded_duration, "bytes": path.stat().st_size}


def gallery_markup(samples: list[dict], poses: list[dict], title: str, compact: bool = False) -> str:
    style = """*{box-sizing:border-box}body{margin:0;background:#edf0df;color:#243b29;font:13px system-ui;padding:20px}h1{font-size:20px;margin:0 0 8px}p{max-width:1050px;line-height:1.6;margin:8px 0 18px}main{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:6px}figure{margin:0;padding:4px;background:#fffdf1;border:1px solid #bfcbb1}img{display:block;width:100%;aspect-ratio:1;object-fit:contain;image-rendering:pixelated;background:repeating-conic-gradient(#e7eddd 0% 25%,#f7f5eb 0% 50%) 50%/12px 12px}figcaption{font:10px ui-monospace,monospace;padding-top:4px;white-space:nowrap}a{color:#285b2e}section{margin:20px 0}section main{grid-template-columns:repeat(10,minmax(0,1fr))}@media(max-width:700px){main{grid-template-columns:repeat(4,minmax(0,1fr))}section main{grid-template-columns:repeat(5,minmax(0,1fr))}}"""
    result = f"<!doctype html><html lang='zh-Hant'><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>{html.escape(title)}</title><style>{style}</style><h1>{html.escape(title)}</h1>"
    result += "<p>實際網站 Canvas 輸出。2300 ms 連續時間軸，每秒取樣 120 個時刻，共 276 個樣本；這是確定性時間取樣，並非螢幕實測 FPS。重複像素只存一份 PNG，所有時刻仍列在 manifest。點選縮圖可看原圖。</p>"
    if poses and not compact:
        result += "<section><h2>10 個參考姿態</h2><p>姿態 4 固定半閉眼；連續時間軸 630 ms 是閉眼起點，兩者刻意分開。</p><main>"
        for pose in poses:
            result += f"<figure><a href='{pose['file']}'><img src='{pose['file']}' alt='參考姿態 {pose['pose']}'></a><figcaption>POSE {pose['pose']:02} · {pose['time_ms']} ms</figcaption></figure>"
        result += "</main></section>"
    result += "<main>"
    for sample in samples:
        result += f"<figure><a href='{sample['file']}'><img src='{sample['file']}' alt='{sample['time_ms']:.3f} 毫秒實際畫面'></a><figcaption>#{sample['index']:03} · {sample['time_ms']:.3f} ms</figcaption></figure>"
    return result + "</main></html>"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://127.0.0.1:5173/")
    parser.add_argument("--output", type=Path, default=ROOT / "artifacts/pixel-world")
    parser.add_argument("--chromium", default="/usr/bin/chromium")
    parser.add_argument("--skip-gif", action="store_true")
    parser.add_argument("--site-gif", action="store_true", help="Also encode actual homepage hero screenshots")
    args = parser.parse_args()
    output = args.output.resolve()
    frames_path = output / "frames"
    frames_path.mkdir(parents=True, exist_ok=True)
    errors: list[str] = []
    all_frames: dict[str, bytes] = {}
    timeline_frames: dict[float, bytes] = {}
    poses: list[dict] = []
    samples: list[dict] = []

    def record(data: bytes) -> dict:
        sha = hashlib.sha256(data).hexdigest()
        if sha not in all_frames:
            all_frames[sha] = data
            (frames_path / f"{sha}.png").write_bytes(data)
        return {"file": f"frames/{sha}.png", "sha256": sha, "bytes": len(data)}

    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=args.chromium, headless=True, args=["--no-sandbox"])
        page = browser.new_page(viewport={"width": 1200, "height": 1000}, device_scale_factor=1)
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.on("response", lambda response: errors.append(f"HTTP {response.status}: {response.url}") if response.status >= 400 else None)
        for index, time_ms in enumerate(KEY_TIMES, 1):
            data = capture(page, args.url, pose=index)
            poses.append({"pose": index, "time_ms": time_ms, "kind": "explicit reference pose", **record(data)})
        assert poses[0]["sha256"] == poses[-1]["sha256"], "Final reference pose must equal rest"
        for index, time_ms in enumerate(SAMPLE_TIMES):
            data = capture(page, args.url, t=time_ms)
            timeline_frames[time_ms] = data
            samples.append({"index": index, "time_ms": round(time_ms, 9), **record(data)})
        # Exact anchors supplement, rather than replace, the uniform 120 Hz samples.
        anchors = []
        for time_ms in KEY_TIMES:
            data = timeline_frames.get(time_ms)
            if data is None:
                data = capture(page, args.url, t=time_ms)
            timeline_frames[time_ms] = data
            anchors.append({"time_ms": time_ms, "kind": "continuous timeline anchor", **record(data)})
        original = ROOT / "assets/source/original_reference.jpg"
        cards = [("原始參考 · 身份／構圖", original.read_bytes(), "jpeg", False),
                 ("實際網站 · 靜止 0 ms", timeline_frames[0], "png", True),
                 ("實際網站 · 風動 1020 ms", timeline_frames[1020], "png", True),
                 ("實際網站 · 閉眼 740 ms", timeline_frames[740], "png", True)]
        comparison = browser.new_page(viewport={"width": 1120, "height": 350}, device_scale_factor=1)
        markup = """<!doctype html><meta charset='utf-8'><style>*{box-sizing:border-box}body{margin:0;padding:18px;background:#edf0df;color:#243b29;font:13px system-ui}main{display:grid;grid-template-columns:repeat(4,256px);gap:20px}figure{margin:0}img{display:block;width:256px;height:256px;object-fit:contain}.pixel{image-rendering:pixelated}figcaption{padding:12px 0 0}footer{padding-top:10px;font-size:11px}</style><main>"""
        for caption, data, extension, pixel in cards:
            markup += f"<figure><img class='{'pixel' if pixel else ''}' src='data:image/{extension};base64,{base64.b64encode(data).decode()}'><figcaption>{caption}</figcaption></figure>"
        comparison.set_content(markup + "</main><footer>像素畫面皆取自同一網站 Canvas；AI 輔助像素重繪並非原圖幾何誤差認證。</footer>")
        comparison.screenshot(path=str(output / "comparison.png"))
        comparison.close()
        gallery = gallery_markup(samples, poses, "276 個實際動畫樣本 · 120 次／秒時間取樣")
        (output / "gallery.html").write_text(gallery)
        # Browser lays out actual PNG thumbnails; no generated replacement artwork.
        contact_samples = [samples[round(index * (SAMPLE_COUNT - 1) / 143)] for index in range(144)]
        sheet = browser.new_page(viewport={"width": 1400, "height": 1800}, device_scale_factor=1)
        sheet.route("**/frames/*.png", lambda request: request.fulfill(path=output / urlsplit(request.request.url).path.lstrip("/")))
        contact_markup = gallery_markup(contact_samples, [], "144 個實際樣本縮圖 · 完整 276 個見 gallery.html", compact=True)
        sheet.set_content(contact_markup.replace("<meta charset", "<base href='http://capture.local/'><meta charset", 1))
        sheet.wait_for_function("[...document.images].every(image=>image.complete&&image.naturalWidth>0)")
        sheet.screenshot(path=str(output / "contact_sheet_144.png"), full_page=True)
        sheet.close()
        gif_result = None
        if not args.skip_gif:
            # GIF has centisecond timing. 50 Hz uses representable 20 ms delays;
            # each image is the nearest genuine 120 Hz sample (<= 3.334 ms away).
            gif_indices = [round(index * .02 * 120) for index in range(115)]
            gif_result = save_gif(output / "animation_preview.gif", [timeline_frames[SAMPLE_TIMES[index]] for index in gif_indices], [20] * 115)
            gif_result.update({"encoded_target_hz": 50, "max_sample_time_error_ms": round(max(abs(SAMPLE_TIMES[index] - step * 20) for step, index in enumerate(gif_indices)), 6),
                               "sampling": "Nearest actual 120 Hz browser canvas export for each 20 ms GIF slot; GIF playback is not live display FPS evidence"})
            if args.site_gif:
                home = browser.new_page(viewport={"width": 1440, "height": 1000}, device_scale_factor=1)
                home.on("pageerror", lambda error: errors.append(str(error)))
                site_frames = []
                site_times = list(range(0, LOOP_MS, 40))
                for time_ms in site_times:
                    home.goto(route(args.url, view="site", t=time_ms, pixel=256))
                    home.wait_for_selector("canvas[data-ready='true'][data-painted='true']")
                    home.evaluate("document.fonts.ready")
                    site_frames.append(home.locator(".hero").screenshot())
                durations = [b - a for a, b in zip(site_times, site_times[1:] + [LOOP_MS])]
                gif_result["homepage_preview"] = save_gif(output / "website_motion.gif", site_frames, durations)
                gif_result["homepage_preview"]["source"] = "Actual complete homepage hero screenshots at 40 ms phases; final slot 20 ms"
                home.close()
        page.goto(route(args.url, t=0, pixel=256))
        page.wait_for_selector("canvas[data-ready='true'][data-painted='true']")
        page.screenshot(path=str(output / "desktop.png"))
        mobile = browser.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        mobile.goto(route(args.url, t=0, pixel=256))
        mobile.wait_for_selector("canvas[data-ready='true'][data-painted='true']")
        mobile.screenshot(path=str(output / "mobile.png"))
        mobile.close()
        browser.close()
    if errors:
        raise RuntimeError("Browser capture failed: " + "; ".join(errors))
    manifest = {"url": args.url, "source": "Actual website canvas PNG exports; runtime remains procedural",
                "loop_ms": LOOP_MS, "sample_rate_hz": 120, "sample_count": len(samples),
                "sample_time_definition": "index*1000/120 ms, index 0..275; interval [0,2300)",
                "unique_png_files": len(all_frames), "unique_png_bytes": sum(map(len, all_frames.values())),
                "deduplication": "SHA-256 of actual PNG bytes; all samples remain mapped even when identical",
                "file_paths_relative_to": "capture output directory (parent of this manifest directory)",
                "samples": samples, "reference_poses": poses, "continuous_anchors": anchors}
    (frames_path / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
    # Remove stale outputs of earlier captures, never source material.
    referenced = {Path(item["file"]).name for item in samples + poses + anchors}
    for path in frames_path.glob("*.png"):
        if path.name not in referenced:
            path.unlink()
    result = {"url": args.url, "logical_size": [256, 256], "loop_ms": LOOP_MS,
              "sample_rate_hz": 120, "sampled_timeline_frames": len(samples), "reference_poses": len(poses),
              "continuous_anchor_frames": len(anchors), "unique_png_files": len(all_frames),
              "unique_png_bytes": sum(map(len, all_frames.values())),
              "pixel_reference_sha256": poses[0]["sha256"], "original_reference_sha256": hashlib.sha256(original.read_bytes()).hexdigest(),
              "source": "Actual website canvas exports, not standalone AI candidate images",
              "frame_01_equals_10": True, "browser_errors": errors, "gif": gif_result,
              "manifest": "frames/manifest.json", "gallery": "gallery.html", "contact_sheet": "contact_sheet_144.png",
              "interpretation": "120 timestamp samples per second demonstrate deterministic phases; realtime performance is reported separately in performance.json"}
    (output / "capture.json").write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
