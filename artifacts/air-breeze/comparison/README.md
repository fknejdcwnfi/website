# Independent motion comparison

`mode-0.png` is rejected PR12 (`7041010aa178d6661762a722162dc9494baf73f1`); `mode-1.png` is the revised source. `side-by-side.gif` contains 120 paired raw-Canvas renders at 100ms intervals (10fps review encoding), using the same canonical pixel materials, eyes held open, nearest-pixel display and a circle mask. It is not a production FPS measurement or a prerecorded replacement used by the site.

Reproduce from the repository root:

```bash
python3 scripts/qa/capture_air_breeze_comparison.py --url http://127.0.0.1:5180/
node scripts/qa/review_air_breeze.mjs
```

The scripts temporarily load the old physics source from the fixed historical commit and remove that temporary source. Neither a copied baseline solver nor the large temporary JSON cycle is placed in runtime assets.

Independent inspection of twelve phase samples found visible horizontal travel in both shoulder curls, with distinct local responses instead of all locks opening and returning together. The revised left lower curl no longer appears nearly still. No complete duplicate resting curl or hole in the central face was visible in those samples. Fine cutout-edge fragments and local overlapping lines remain; sampled images cannot establish perfect natural hair, complete hidden-surface reconstruction, or all-phase absence of every small artifact.

The diagnostics in `../motion-review.json` sample 720 poses at 60Hz and average each lock's nodes4–13 whose rest position lies within the actual radius126 circle. Mean absolute correlation of pairwise vertical velocities changes from0.9623 to0.5285, evidence of less synchronized vertical rhythm. Left/right horizontal ranges of those mean trajectories change from4.01/9.92 to4.44/8.57 logical pixels; free-tip horizontal ranges change from8.94/24.61 to10.18/21.61. These are not the maximum single-node displacement metrics in the main rig QA.

Total y displacement RMS rises from0.914 to0.999 logical pixels. The revision does **not** remove every vertical motion: curved material still changes y as it bends horizontally. The intended improvement is removal of unconditional upward aerodynamic load and reduced common tidal rhythm, not a blanket decrease in every y metric. Numerical measures support the comparison but are not an aesthetic score or proof of equivalence to real-world hair.
