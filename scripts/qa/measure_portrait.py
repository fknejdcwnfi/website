#!/usr/bin/env python3
"""Measure native and unconstrained production rAF, render cost, CPU and long tasks.

No screenshots are taken during timed samples. Unconstrained headless throughput
is a CPU/compositor benchmark, never evidence of a physical 120/144/240 Hz display.
"""
from __future__ import annotations

import argparse
import json
import math
import statistics
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
INSTRUMENT = r"""
window.__sample = null;
const clocks = new WeakMap();
let rafContext = null;
const nativeRAF = window.requestAnimationFrame.bind(window);
window.requestAnimationFrame = cb => nativeRAF(ts => {
  const start = performance.now();
  const current = window.__sample;
  const context = {timestamp: ts, portraitPhase: null};
  rafContext = context;
  try { cb(ts); }
  finally {
    rafContext = null;
    if (current) current.callbacks.push({time: ts, cost: performance.now() - start, phase: context.portraitPhase});
  }
});
const nativePut = CanvasRenderingContext2D.prototype.putImageData;
CanvasRenderingContext2D.prototype.putImageData = function(...args) {
  if (this.canvas.dataset.style === 'portrait') {
    if (rafContext) {
      let clock = clocks.get(this.canvas);
      if (!clock) { clock = {last: rafContext.timestamp, elapsed: 0}; clocks.set(this.canvas, clock); }
      else { clock.elapsed += Math.min(rafContext.timestamp - clock.last, 100); clock.last = rafContext.timestamp; }
      rafContext.portraitPhase = clock.elapsed % Number(this.canvas.dataset.loopDuration);
    }
    if (window.__sample) window.__sample.paints.push(performance.now());
  }
  return nativePut.apply(this, args);
};
"""


def stats(values: list[float]) -> dict:
    if not values:
        return {"count": 0}
    values = sorted(values)
    at = lambda fraction: round(values[min(len(values) - 1, math.ceil(len(values) * fraction) - 1)], 3)
    return {"count": len(values), "min": round(values[0], 3), "median": round(statistics.median(values), 3),
            "p95": at(.95), "p99": at(.99), "max": round(values[-1], 3),
            "mean": round(statistics.mean(values), 3)}


def clean_url(url: str) -> str:
    parts = urlsplit(url)
    query = dict(parse_qsl(parts.query))
    for name in ("t", "pose", "pause", "debug", "speed"):
        query.pop(name, None)
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


def measure(playwright, args, mode: str) -> dict:
    flags = ["--no-sandbox"]
    if mode == "unconstrained":
        flags += ["--disable-frame-rate-limit", "--disable-gpu-vsync"]
    browser = playwright.chromium.launch(executable_path=args.chromium, args=flags)
    page = browser.new_page(viewport={"width": 1200, "height": 1000}, device_scale_factor=1)
    errors, responses = [], []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("response", lambda response: responses.append({"url": response.url, "status": response.status}))
    page.add_init_script(INSTRUMENT)
    response = page.goto(clean_url(args.url))
    assert response and response.status == 200, "Production route did not return HTTP 200"
    page.wait_for_selector("canvas[data-style=portrait][data-ready=true][data-painted=true][data-playback=looping]")
    loop_ms = int(page.locator("canvas").get_attribute("data-loop-duration"))
    phase_ranges = (("first_wind_third", 0, loop_ms / 3), ("middle_wind_third", loop_ms / 3, loop_ms * 2 / 3), ("final_wind_third", loop_ms * 2 / 3, loop_ms))
    page.wait_for_timeout(args.settle_ms)
    cdp = page.context.new_cdp_session(page)
    cdp.send("Performance.enable")
    before = {item["name"]: item["value"] for item in cdp.send("Performance.getMetrics")["metrics"]}
    data = page.evaluate(r"""async duration => {
      const longtasks = [];
      const observer = new PerformanceObserver(entries => entries.getEntries().forEach(entry =>
        longtasks.push({start: entry.startTime, duration: entry.duration})));
      observer.observe({type: 'longtask'});
      const sample = {callbacks: [], paints: [], start: performance.now()};
      window.__sample = sample;
      await new Promise(resolve => setTimeout(resolve, duration));
      sample.end = performance.now();
      window.__sample = null;
      observer.takeRecords().forEach(entry => longtasks.push({start: entry.startTime, duration: entry.duration}));
      observer.disconnect();
      sample.longtasks = longtasks.filter(entry => entry.start >= sample.start);
      return sample;
    }""", args.sample_ms)
    after = {item["name"]: item["value"] for item in cdp.send("Performance.getMetrics")["metrics"]}
    elapsed = (data["end"] - data["start"]) / 1000
    costs = [item["cost"] for item in data["callbacks"]]
    frame_intervals = [b["time"] - a["time"] for a, b in zip(data["callbacks"], data["callbacks"][1:])]
    paint_intervals = [b - a for a, b in zip(data["paints"], data["paints"][1:])]
    phase_rates = {}
    for name, low, high in phase_ranges:
        intervals = [current["time"] - previous["time"]
                     for previous, current in zip(data["callbacks"], data["callbacks"][1:])
                     if current["phase"] is not None and low <= current["phase"] < high]
        duration = sum(intervals)
        phase_rates[name] = {"raf_callbacks": len(intervals), "raf_timestamp_duration_ms": round(duration, 3),
                             "callbacks_per_second": round(len(intervals) * 1000 / duration, 2) if duration else None}
    cdp_elapsed = after.get("Timestamp", 0) - before.get("Timestamp", 0)
    if cdp_elapsed <= 0:
        cdp_elapsed = elapsed
    cpu = {name: round(after.get(name, 0) - before.get(name, 0), 6)
           for name in ("TaskDuration", "ScriptDuration", "LayoutDuration", "RecalcStyleDuration")}
    result = {"mode": mode, "url": clean_url(args.url), "chromium_flags": flags, "chromium_version": browser.version,
              "sample_seconds": round(elapsed, 3), "settle_ms": args.settle_ms, "wind_loop_ms": loop_ms,
              "raf_callbacks": len(costs), "raf_callbacks_per_second": round(len(costs) / elapsed, 2),
              "portrait_canvas_paints": len(data["paints"]), "portrait_paints_per_second": round(len(data["paints"]) / elapsed, 2),
              "callback_cpu_ms": stats(costs),
              "callback_cpu_by_phase_ms": {
                  name: stats([item["cost"] for item in data["callbacks"] if item["phase"] is not None and low <= item["phase"] < high])
                  for name, low, high in phase_ranges},
              "phase_callback_rate_estimates": phase_rates,
              "raf_interval_ms": stats(frame_intervals),
              "paint_interval_ms": stats(paint_intervals), "long_tasks": data["longtasks"],
              "cdp_cpu_seconds": cpu, "cdp_metric_window_seconds": round(cdp_elapsed, 6),
              "main_thread_busy_percent": round(cpu["TaskDuration"] / cdp_elapsed * 100, 2),
              "js_heap_used_bytes": int(after.get("JSHeapUsedSize", 0)),
              "runtime_images": sorted({item["url"] for item in responses if "/assets/portrait-natural/" in item["url"]}),
              "browser_errors": errors, "http_errors": [item for item in responses if item["status"] >= 400],
              "callback_cost_within_frame_budget_percent": {
                  str(hz): round(sum(cost <= 1000 / hz for cost in costs) / max(1, len(costs)) * 100, 2)
                  for hz in (60, 120, 144, 240)}}
    # Network checks run after the timed sample.
    for path in ("og-portrait.png", "portrait-rest.png", "assets/portrait-natural/base.png", "assets/portrait-natural/eyelids.png", "assets/portrait-natural/underpaint.png"):
        assert page.request.get(args.url.rstrip("/") + "/" + path).status == 200, path
    result["metadata_and_asset_http200"] = True
    assert costs and len(data["paints"]) > 0, "No actual portrait frames measured"
    assert not errors and not result["http_errors"], (errors, result["http_errors"])
    browser.close()
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://127.0.0.1:4173/website/")
    parser.add_argument("--output", type=Path, default=ROOT / "artifacts/gentle-portrait/performance.json")
    parser.add_argument("--chromium", default="/usr/bin/chromium")
    parser.add_argument("--sample-ms", type=int, default=12000)
    parser.add_argument("--settle-ms", type=int, default=2500)
    parser.add_argument("--mode", choices=("both", "native", "unconstrained"), default="both")
    args = parser.parse_args()
    modes = ("native", "unconstrained") if args.mode == "both" else (args.mode,)
    with sync_playwright() as playwright:
        runs = [measure(playwright, args, mode) for mode in modes]
    result = {"conditions": "fresh single-page headless Chromium per run;1200x1000;DPR1;no CPU throttle;no screenshots during sample",
              "interpretation": "Native mode measures this container's rAF schedule. Unconstrained mode removes Chromium frame pacing to measure actual callback/paint throughput; neither establishes physical display refresh or device-wide performance.",
              "phase_measurement": "Phase inferred from per-canvas native rAF paint timestamps using the player's elapsed-ms deltas (clamped at100ms), initial phase0 and speed1; uninterrupted visible playback throughout each sample. The whole12s breeze period remains active; no settled-rest interval is included. Three equal wind-phase bins expose phase differences. Per-phase rates assign each rAF interval to its ending phase and are estimates.",
              "cpu_window_note": "CDP TaskDuration is divided by the CDP Timestamp window, which includes tool-call overhead around the page timer.",
              "frame_budget_note": "Callback cost is JavaScript work including rendering; budgets exclude compositor, GPU, browser and OS overhead.",
              "physical_high_refresh_display_verified": False, "runs": runs}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result))


if __name__ == "__main__":
    main()
