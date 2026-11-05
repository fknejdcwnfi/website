#!/usr/bin/env python3
"""Verify progressive start, single-video handoff, independent snow and styled assets.

A blocked main module and a separately blocked atlas simulate first paint and slow
motion assets. No throughput or encoded sample rate is called physical monitor FPS.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import time
from PIL import Image
from playwright.sync_api import sync_playwright, Error as PlaywrightError

ROOT = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url', default='http://127.0.0.1:5180/website/')
parser.add_argument('--output', type=Path, default=ROOT / 'artifacts/scenic-snow/progressive-start.json')
args = parser.parse_args()
base = ROOT / 'public/assets/reference-scene'
source = json.loads((base / 'pixel-source-manifest.json').read_text())
smooth = json.loads((base / 'pixel-smooth-manifest.json').read_text())
presentation = json.loads((base / 'presentation-manifest.json').read_text())
report = {'status': 'failed', 'checks': [], 'details': {}, 'browserErrors': [], 'scope': 'Styled reconstruction and progressive presentation; not equality of restyled RGB with the original GIF or physical display FPS'}

def save():
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')

def check(name, passed, detail=None):
    report['checks'].append({'name': name, 'passed': bool(passed), 'detail': detail})
    if not passed:
        save()
        raise AssertionError((name, detail))

# New artistic assets have their own provenance. The original atlases are checked
# separately by verify_source_scene_assets.py; no identity/RGB equivalence implied.
for label, manifest in [('styled_source', source), ('styled_smooth', smooth)]:
    image = Image.open(base / manifest['atlas']).convert('RGBA')
    check(label + '_native_atlas_geometry', image.size == (manifest['tileWidth'] * manifest['atlasColumns'], manifest['tileHeight'] * manifest['atlasRows']), image.size)
    check(label + '_opaque_palette_budget', image.getcolors(maxcolors=256) is not None and image.getextrema()[3] == (255, 255))
    for entry in manifest.get('files', []) + manifest.get('authoring', []):
        path = ROOT / entry['file']
        check(label + '_hash_' + entry['file'], path.is_file() and path.stat().st_size == entry['bytes'] and hashlib.sha256(path.read_bytes()).hexdigest() == entry['sha256'])
check('source_and_styled_sample_timing_keeps_1280ms', source['frameCount'] == 16 and source['frameDurationsMs'] == [80] * 16 and smooth['frameCount'] == 160 and smooth['frameDurationsMs'] == [8] * 160 and source['durationMs'] == smooth['durationMs'] == 1280)
check('one_styled_palette', source['palette'] == smooth['palette'])
check('styled_blink_retains_closed_source_anchors_seven_and_eight', len(source.get('eyelidClosure', [])) == 16 and source['eyelidClosure'][7] == source['eyelidClosure'][8] == 1 and source['eyelidClosure'][0] == 0, source.get('eyelidClosure'))
check('derived_blink_follows_the_same_source_closure_timestamps', len(smooth.get('eyelidClosure', [])) == 160 and smooth['eyelidClosure'][70] == smooth['eyelidClosure'][80] == 1 and smooth['eyelidClosure'][0] == smooth['eyelidClosure'][-1] == 0)
check('provenance_uses_one_repainted_open_master', sum(entry['file'].endswith('/style-master.png') for entry in presentation.get('sources', [])) == 1, presentation.get('sources'))

# Compare the styled anchor tiles and validate that edge reconstruction is
# reversible to the new styled master, without claiming original-GIF RGB.
def tile(image, manifest, index):
    x = index % manifest['atlasColumns'] * manifest['tileWidth']
    y = index // manifest['atlasColumns'] * manifest['tileHeight']
    return image.crop((x, y, x + manifest['tileWidth'], y + manifest['tileHeight']))
a = Image.open(base / source['atlas']).convert('RGBA')
b = Image.open(base / smooth['atlas']).convert('RGBA')
group = smooth['frameCount'] // source['frameCount']
check('all_sixteen_styled_anchors_match_between_motion_modes', all(tile(a, source, index).tobytes() == tile(b, smooth, index * group).tobytes() for index in range(source['frameCount'])))
hd = Image.open(base / 'canonical-hd.png').convert('RGBA')
native = tile(a, source, 0)
check('hd_canonical_has_twice_the_native_styled_dimensions', hd.size == (native.width * 2, native.height * 2), hd.size)
restored = Image.new('RGBA', native.size)
for y in range(native.height):
    for x in range(native.width):
        block = [hd.getpixel((x * 2 + dx, y * 2 + dy)) for dy in range(2) for dx in range(2)]
        restored.putpixel((x, y), max(block, key=block.count))
native_bytes, restored_bytes = native.tobytes(), restored.tobytes()
canonical_differences = sum(native_bytes[index:index+4] != restored_bytes[index:index+4] for index in range(0, len(native_bytes), 4))
check('hd_canonical_restores_exact_styled_native_pixels', canonical_differences == 0, {'differentNativePixels': canonical_differences, 'nativePixels': native.width * native.height})
for entry in presentation.get('files', []) + presentation.get('authoring', []):
    path = ROOT / entry['file']
    check('presentation_hash_' + entry['file'], path.is_file() and path.stat().st_size == entry['bytes'] and hashlib.sha256(path.read_bytes()).hexdigest() == entry['sha256'])

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    context = browser.new_context(viewport={'width': 1440, 'height': 1000}, device_scale_factor=1)
    page = context.new_page()
    page.on('pageerror', lambda error: report['browserErrors'].append(str(error)))
    page.add_init_script('''
        window.__qaBootPauses=[];window.__qaBootMutations=[];window.__qaHandoffReads=[];window.__qaFirstVideoFrame=null;window.__qaFirstVideoDataMs=null;
        function observeFirstFrame(video){video.requestVideoFrameCallback?.((now,metadata)=>{if(window.__qaFirstVideoFrame===null)window.__qaFirstVideoFrame={at:now,expectedDisplayTime:metadata.expectedDisplayTime,mediaTime:metadata.mediaTime,presentedFrames:metadata.presentedFrames}})}
        document.addEventListener('loadeddata',event=>{
            if(event.target.id!=='vermouth-bootstrap'||window.__qaFirstVideoDataMs!==null)return;
            window.__qaFirstVideoDataMs=performance.now();
            if(window.__qaFirstVideoFrame===null)observeFirstFrame(event.target);
        },true);
        for(const property of ['src','currentTime']){
            const descriptor=Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype,property);
            Object.defineProperty(HTMLMediaElement.prototype,property,{...descriptor,
                get(){const value=descriptor.get.call(this);if(property==='currentTime'&&this.id==='vermouth-bootstrap'&&(new Error().stack||'').includes('initialElapsedMs'))window.__qaHandoffReads.push({phaseMs:value*1000,at:performance.now(),ready:this.readyState,seeking:this.seeking});return value},
                set(value){if(this.id==='vermouth-bootstrap')window.__qaBootMutations.push({property,value,at:performance.now()});const result=descriptor.set.call(this,value);if(property==='src'&&this.id==='vermouth-bootstrap'&&window.__qaFirstVideoFrame===null)observeFirstFrame(this);return result}
            });
        }
        const load=HTMLMediaElement.prototype.load;
        HTMLMediaElement.prototype.load=function(...args){if(this.id==='vermouth-bootstrap')window.__qaBootMutations.push({property:'load',at:performance.now()});return load.apply(this,args)};
        const pause=HTMLMediaElement.prototype.pause;
        HTMLMediaElement.prototype.pause=function(...args){
            if(this.id==='vermouth-bootstrap') window.__qaBootPauses.push({phaseMs:this.currentTime*1000,at:performance.now()});
            return pause.apply(this,args);
        };
    ''')
    held_modules, held_atlases = [], []
    page.route('**/assets/index-*.js', lambda route: held_modules.append(route))
    page.route('**/' + smooth['atlas'] + '*', lambda route: held_atlases.append(route))
    navigation_start = time.monotonic()
    page.goto(args.url, wait_until='commit')
    page.wait_for_selector('#vermouth-bootstrap', state='attached')
    page.wait_for_function("document.querySelector('#vermouth-bootstrap').readyState>=2&&!document.querySelector('#vermouth-bootstrap').paused")
    first = page.locator('#vermouth-bootstrap').evaluate('v=>({phase:v.currentTime,ready:v.readyState,source:v.currentSrc})')
    page.evaluate("window.__qaOriginalBoot=document.querySelector('#vermouth-bootstrap')")
    page.wait_for_timeout(350)
    second = page.locator('#vermouth-bootstrap').evaluate('v=>({phase:v.currentTime,ready:v.readyState,source:v.currentSrc})')
    report['details']['firstVideoDataMs'] = page.evaluate('window.__qaFirstVideoDataMs')
    report['details']['firstObservedBrowserVideoFrame'] = page.evaluate('window.__qaFirstVideoFrame')
    report['details']['videoFrameTimingInterpretation'] = 'The first requestVideoFrameCallback observed from JavaScript is best effort and may follow earlier compositor frames. It is an upper-bound observation of browser presentation, not an exact physical first-frame time.'
    report['details']['startupTimingConditions'] = 'Fresh local production page; main module deliberately held; native media clock and requestVideoFrameCallback; not a physical display or slow-network measurement'
    check('static_html_video_plays_before_react_module_download', bool(held_modules) and abs(second['phase'] - first['phase']) > .1, {'first': first, 'second': second, 'elapsedWallMs': round((time.monotonic() - navigation_start) * 1000)})
    before_react = page.locator('#vermouth-bootstrap').evaluate('v=>({phaseMs:v.currentTime*1000,at:performance.now(),mutations:window.__qaBootMutations.length})')
    for route in tuple(held_modules):
        route.continue_()
    page.unroute('**/assets/index-*.js')
    page.wait_for_selector('.reference-scene__snow[data-weather=snow]')
    page.wait_for_function("document.querySelector('.reference-scene__snow').dataset.playback==='looping'")
    check('react_retains_the_already_playing_video_node', page.evaluate("window.__qaOriginalBoot===document.querySelector('#vermouth-bootstrap')"))
    after_react = page.locator('#vermouth-bootstrap').evaluate('v=>({phaseMs:v.currentTime*1000,at:performance.now(),mutations:window.__qaBootMutations.length})')
    check('react_attachment_does_not_reload_or_seek_the_preview', after_react['mutations'] == before_react['mutations'], {'before': before_react, 'after': after_react, 'mutations': page.evaluate('window.__qaBootMutations')})
    page.wait_for_function("document.querySelector('.reference-scene__canvas').dataset.playback==='preparing'")
    before = page.locator('.reference-scene__snow').evaluate('c=>({elapsed:Number(c.dataset.elapsedMs),pixels:c.toDataURL()})')
    boot_before = page.locator('#vermouth-bootstrap').evaluate('v=>v.currentTime')
    page.wait_for_timeout(400)
    after = page.locator('.reference-scene__snow').evaluate('c=>({elapsed:Number(c.dataset.elapsedMs),pixels:c.toDataURL()})')
    boot_after = page.locator('#vermouth-bootstrap').evaluate('v=>v.currentTime')
    check('snow_changes_before_the_full_atlas_is_available', after['elapsed'] > before['elapsed'] + 250 and after['pixels'] != before['pixels'], {'beforeMs': before['elapsed'], 'afterMs': after['elapsed']})
    check('avatar_video_keeps_playing_while_atlas_is_blocked', bool(held_atlases) and abs(boot_after - boot_before) > .1 and page.locator('.reference-scene__boot-host').is_visible(), {'beforePhase': boot_before, 'afterPhase': boot_after})
    # Hold the complete atlas for at least three seconds without blocking browser
    # media clocks or the independent weather animation.
    remaining = max(0, 3000 - (time.monotonic() - navigation_start) * 1000)
    page.wait_for_timeout(remaining)
    check('full_atlas_has_not_been_needed_for_first_motion', page.locator('.reference-scene__canvas').get_attribute('data-ready') == 'false')
    page.evaluate('''()=>{
        window.__qaHandoff=null;
        const canvas=document.querySelector('.reference-scene__canvas');
        const observer=new MutationObserver(()=>{
            if(!window.__qaHandoff&&canvas.dataset.playback==='looping'){
                window.__qaHandoff={frame:Number(canvas.dataset.sourceFrame),phaseMs:Number(canvas.dataset.initialElapsedMs),at:performance.now()};observer.disconnect();
            }
        });
        observer.observe(canvas,{attributes:true});
    }''')
    report['details']['beforeRelease'] = page.evaluate('(()=>{const v=window.__qaOriginalBoot;return {phaseMs:v.currentTime*1000,paused:v.paused,ready:v.readyState,connected:v.isConnected,src:v.getAttribute("src"),playback:document.querySelector(".reference-scene__canvas").dataset.playback,upgraded:document.querySelector(".reference-scene").dataset.upgraded,at:performance.now()}})()')
    already_handled = 0
    for route in tuple(held_atlases):
        try:
            route.continue_()
        except PlaywrightError as error:
            if 'Route is already handled' not in str(error):
                raise
            already_handled += 1
    page.unroute('**/' + smooth['atlas'] + '*')
    report['details']['heldAtlasRequests'] = len(held_atlases)
    report['details']['staleHandledAtlasRequests'] = already_handled
    page.wait_for_function('window.__qaHandoff!==null')
    handoff = page.evaluate('window.__qaHandoff')
    pauses = page.evaluate('window.__qaBootPauses')
    report['details']['bootPauses'] = pauses
    report['details']['loopBoundaryExplanation'] = 'Native MP4 looping briefly seeks to0 and may expose currentTime0 or1280; compare phases modulo1280. Separate bootstrap-loop-probe.json records three real loop wraps with loop=true and ended=false.'
    expected = int((handoff['phaseMs'] % smooth['durationMs']) // smooth['frameDurationsMs'][0])
    handoff_reads = page.evaluate('window.__qaHandoffReads')
    check('hd_canvas_starts_at_the_actual_video_phase_even_at_loop_zero', handoff['frame'] == expected and len(handoff_reads) == 1 and abs(handoff_reads[0]['phaseMs'] - handoff['phaseMs']) < .001, {'handoff': handoff, 'expectedFrame': expected, 'actualVideoReads': handoff_reads})
    relevant = [pause for pause in pauses if abs(pause['at'] - handoff['at']) < 300]
    check('handoff_does_not_rewind_the_visible_source_clock', bool(relevant) and min(abs(((pause['phaseMs'] - handoff['phaseMs'] + 640) % 1280) - 640) for pause in relevant) < 40, {'handoff': handoff, 'pauses': pauses})
    page.wait_for_function("document.querySelector('.reference-scene').dataset.upgraded==='true'")
    check('bootstrap_is_released_after_hd_upgrade', page.locator('.reference-scene__boot-host').is_hidden() and page.evaluate('window.__qaOriginalBoot.paused&&!window.__qaOriginalBoot.getAttribute("src")'))
    check('source_canvas_is_hd_and_weather_separate', page.locator('.reference-scene__canvas').evaluate('c=>c.width===716&&c.height===534') and page.locator('.reference-scene__snow').count() == 1)
    page.evaluate('scrollTo(0,document.documentElement.scrollHeight)')
    page.wait_for_function("document.querySelector('.reference-scene__snow').dataset.playback==='suspended'")
    hidden = page.locator('.reference-scene__snow').get_attribute('data-elapsed-ms')
    page.wait_for_timeout(200)
    check('offscreen_snow_suspends', hidden == page.locator('.reference-scene__snow').get_attribute('data-elapsed-ms'))
    page.evaluate('scrollTo(0,0)')
    page.wait_for_function("document.querySelector('.reference-scene__snow').dataset.playback==='looping'")
    page.wait_for_timeout(100)
    check('onscreen_snow_resumes_without_restart', float(page.locator('.reference-scene__snow').get_attribute('data-elapsed-ms')) > float(hidden))
    context.close()
    reduced = browser.new_context(viewport={'width': 1200, 'height': 1000}, reduced_motion='reduce')
    page = reduced.new_page(); requests = []
    page.on('request', lambda request: requests.append(request.url))
    page.goto(args.url)
    page.wait_for_selector('.reference-scene__canvas[data-playback=static]')
    page.wait_for_selector('.reference-scene__snow[data-playback=static]')
    snow_before = page.locator('.reference-scene__snow').evaluate('c=>c.toDataURL()')
    page.wait_for_timeout(200)
    check('system_reduced_motion_skips_video_and_full_atlas', not any('boot.mp4' in request or 'atlas.png' in request for request in requests), requests)
    check('system_reduced_motion_keeps_snow_static', snow_before == page.locator('.reference-scene__snow').evaluate('c=>c.toDataURL()'))
    reduced.close(); browser.close()
check('no_browser_errors', not report['browserErrors'], report['browserErrors'])
report['status'] = 'passed'
save()
print(json.dumps({'status': report['status'], 'checks': len(report['checks']), 'output': str(args.output)}))
