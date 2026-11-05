# Calm-circle selection and hidden-surface references

The user rejected the full-image optical-flow deformation and requested a plain circular portrait without background. These two image-generation edits are authoring references for stable, local-layer animation. They are not independently generated animation frames or a replacement character face.

- `cutout-reference.png` removes Fuji, blossoms and all landscape while retaining the same1452×1083 portrait composition. Use its alpha to select **the original master's RGB**.
- `clean-plate-reference.png` removes the long hanging hair below the jaw and reconstructs ordinary neck/shoulder underpaint; where outer hair was outside the body, the output is transparent. Use only pixels underneath explicitly removed hair, never the rest of the generated face/body.

Generated alpha is mostly254 across opaque material, with0 outside and partial boundary values. Do not select `alpha == 255`; choose an explicit binary threshold. Some boundary RGB contains red/yellow matting contamination, so it must not replace source RGB. Geometry is visually similar but is not guaranteed pixel-perfect; keep masks conservative and verify alignment.

The original Minecraft master, uploaded source files and runtime code were not changed here. `provenance.json` records both prompts, source SHA, output SHA, dimensions, transparency statistics and tool-original paths. Hidden-surface reconstruction is newly inferred artwork, not recovery of original layers.
