# Segmentation prompt and provenance

Input: `assets/generated/portrait-v4/open.png`, unmodified 1254² canonical.

Generated edit: `exec-b1d50523-c732-4a42-ac58-ba5697bbad1d.png`, retained verbatim as
`hair-matte.png`. This was an image edit with an opaque background.

Prompt:

> Technical image segmentation task. Output ONLY a binary black-and-white HAIR MATTE matching this exact input image pixel-for-pixel in framing and silhouette. White (#ffffff) = EVERY part of the platinum/blonde hair including dark hair shadows, internal line art, all long shoulder curls, side hair, bangs, and scalp hair. Black (#000000) = everything else, including transparent background, face, eyebrows, eyes, ears, jewelry, neck, shoulders, and all other non-hair areas. Preserve exact original 1:1 square crop, all hair edges and all holes between hair strands. Do not draw any portrait colors or anatomy in the output. No grayscale, antialiasing, outlines, labels, text, grid or decoration. This is a flat animation-rig selection mask, not an illustration. It should look like a precise solid white silhouette of ONLY the original hair regions on a pure black canvas, with original non-hair gaps and face cut out black. Match the original close-up exactly; no reposing, enlargement, rearrangement, new strands or redesigned contours.

The output contains thin black internal hair strokes and some edge antialiasing
despite the prompt. Runtime material construction handles those as selection
data; it does not use this output as visible artwork. A prior attempted clean
plate edit produced no usable output and is not part of the application.
