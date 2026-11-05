# Uploaded GIF source and derived motion review

The owner's archive is retained under `reference-projects/fuji-wind/`. Its Python
file is treated as source data and is not executed by this review.

`original.gif` contains 16 full opaque 358x267 frames, each 80ms, looping with
GIF loop=0 and disposal=2. All supplied `frames/frame_000.png` through 015 match
the corresponding decoded GIF frame in **every RGBA byte**. The reference cycle
is 1280ms /12.5 source fps, not the old website's12-second procedural cycle.

`source.json` records source hashes, exact frame checks and regional RGB changes;
`contact.png` shows the actual sixteen source frames at their original times.
The hair moves strongly toward the right and frames7/8 close the eyes. The
reference itself also changes face/body geometry and distant pixels. A
requirement that the old website's face region be absolutely fixed conflicts
with reproducing this particular GIF, and no extra independent blink should be
painted on top of its existing eye frames.

The source final-to-first transition is larger than an ordinary adjacent step:
full-frame mean absolute RGB difference20.913 versus16.370 for ordinary source
steps; central face18.214 versus9.844. These are photometric differences, not
optical-flow measurements or an aesthetic score.

`derive_reference_motion.py` creates optional estimated intermediate frames with
FFmpeg bidirectional motion-compensated adaptive overlapping blocks in4:4:4
YUV, using three source cycles and selecting the middle cycle. It produces128
10ms frames while force-copying each original PNG byte-for-byte at frame0,8,...120.
The 16 anchors and the total1280ms duration are unchanged. The filter's anchors
before exact replacement differ from source only by RGB/YUV roundoff, maximum
mean RGB error0.361/255; replacement then makes all anchor errors0.

`interpolation.json` records the exact method, versions, hashes and anchor checks.
`intermediate-contact.png` deliberately includes difficult half-way blinking and
loop samples. The first unrestricted MCI experiment visibly blurred/doubled eyes
around520/680ms. The final default protects two reviewed eye regions:
left[114,75,169,118], right[188,74,243,116]. Every estimated frame uses the
floor(index/8) original eye frame in the eye/eyelash core; only an outer3px
skin border is feathered before the common pixel-art palette conversion. All128
protected eye cores match their source donor in every RGB byte; every original
80ms whole-image anchor remains a byte-identical PNG. Eyes therefore retain
source12.5fps semantics while hair/background use estimated10ms samples.

Thin hair, earrings, snow and occlusions can still be estimated incorrectly.
These samples are not recovered original frames, a new simulation of source
wind, proof of perfect natural motion, or a physical high-refresh display test.

The final protected10ms sampled final-to-first RGB step is4.090; maximum step
is4.709. The unrestricted first experiment measured2.752 at the seam and2.933
ordinary-step mean, but also contained the eye artifacts. A smaller RGB step is
not inherently better quality. Per-step magnitudes partly follow from shorter
time steps and must not be presented as independent proof of visual quality.
