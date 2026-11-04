# Hair segmentation material

`hair-matte.png` is an AI-assisted binary selection matte generated from the
retained `portrait-v4/open.png` canonical portrait on 2026-10-30. Both are
1254×1254. The canonical portrait and original reference are unchanged.

- White selects hair; black selects other areas. Runtime sampling uses the
  canonical alpha and conservative outline/line closure to avoid treating drawn
  dark hair lines as physical holes.
- This material supplies selection only. No generated face, eyes, body or hair
  colors are substituted into the portrait.
- Runtime locks retain original canonical colors. The clean layer uses existing
  underpainting, transparent background and local hidden-material repair.
- The complete original generated matte is preserved here; runtime nearest/binary grid exports are
  in `public/assets/portrait-rig/hair-matte*.png` (192/256/320). The original 1.1MB
  edit is not downloaded by visitors.

SHA-256: `ebe9747a4ad9e541e8b2551b5800fe64a30a107c3f84fc6f742458a2d48141a8`.

This is segmentation-assisted cutout construction, not a claim that the original
illustration came with complete author-created layers or source-identical hidden
anatomy. See `docs/guides/video-layered-rebuild.md` for the model and verification.
