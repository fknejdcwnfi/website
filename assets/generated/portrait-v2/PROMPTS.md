# Pixel portrait v2 generation record

Generated 2026-10-28 using the image-generation tool; the source reference was
`assets/source/original_reference.jpg`. It was inspected before generation and
was never modified. Generated masters remain unmodified; model output is not
claimed to be geometrically identical to the original.

## Open master

Translate the exact reference composition into carefully designed 2D pixel art:
an elegant adult Vermouth, pointed chin, inclined icy-blue eyes, original bright
highlights, arched brows, small nose, restrained red smirk, asymmetrical swept
platinum/champagne bangs and long shoulder curls, matching sapphire teardrop
earrings, metal chains, low sapphire pendant, bare shoulders and black straps.
Preserve the close square crop and raised viewer-right shoulder. Use disciplined
pixel clusters, controlled colors, stepped contours and clustered highlights.
No Steve/cuboid head, voxel body, chibi proportions, scenery, text, frame or
particles. This is one canonical character, not independent generated frames.

The requested logical grid was 256², with hard pixels; the generator delivered
1254² PNGs with additional shades. The shared export pipeline therefore enforces
192/256/320 grids and the reviewed 42-color palette. This normalization happens
after the pixel-art redraw, rather than applying a mosaic filter to the anime
reference. The resulting images were compared in the actual website renderer.

## Closed-eye donor

Edit the open master, keeping the same crop, face position, eyebrows, nose,
mouth, hair, shoulders, jewelry and background. Change only the eyes to naturally
closed upper eyelids, preserving tilted eye structure, eyelid skin, stepped curved
lash contours and fine lash tips. This is a donor for two eye polygons only;
all non-eye pixels always come from the open master in the website renderer.

## Reproduction and limitations

Run the Vite dev server, then `python3 scripts/export_portrait.py --url <dev-url>`.
The script invokes the same browser Canvas normalization module used for the
reviewed exports and refreshes the SHA-256 manifest. It cannot reproduce the AI
master bit-for-bit from a fresh model generation; retained masters and hashes are
the reproducible source for this version. Pixel clusters, facial proportions and
likeness remain artistic judgments, not an objective 1:1 certification.
