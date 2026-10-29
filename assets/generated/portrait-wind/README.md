# Hidden hair underpaint · 2026-10-29

`underpaint.png` is an AI-assisted repair donor edited from `../portrait-v4/open.png` with image_gen. It removes loose foreground curls and restores shoulder/neck skin and quiet back hair underneath. The master was copied unchanged from `/workspace/generated_images/exec-ec0ec416-4d4f-48e4-89d5-eee016ad0df8.png`.

The website continues to use the unchanged v4 face, open/closed eyes, close-up crop and original rest raster. Only pixels underneath a moving hair layer can sample this donor; the donor face and body are never swapped in as an animation frame. Eight source-color hair masks, root anchors, smooth deformation grids and 17 chain stations per lock with C1 Hermite interpolation are prepared once. Larger foreground curls can leave the rest silhouette and cross the two shoulder corridors; fixed face/pendant pixels are protected. Left/right earrings use separate delayed channels.

Browser export uses the same42-color palette and binaryalpha for192²/256²/320² donor PNGs. There are nine runtime textures in the manifest: three logical widths each for the canonical portrait, eyelids and underpaint. Original source/reference files remain read-only. This is a local repair donor, not a complete source-identical layered reconstruction.
