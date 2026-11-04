import { PALETTE } from './portraitAsset'
import { HAIR_NODES, type HairMaterial, type HairShadow, type PortraitMaterials } from './hairTypes'
import { createJewelryMasks } from './portraitJewelry'

type Point = readonly [number, number]
type Cutout = {
  id: string
  z: number
  side: -1 | 1
  polygon: readonly Point[]
  spine: readonly Point[]
  mass: number
  drag: number
  bend: number
  wind: number
}

/**
 * Traced on the retained canonical 256-square artwork. These are independent
 * alpha cutouts, not destination masks or world-y deformation fields. Curved
 * shoulder locks keep their complete S-shaped path from attachment to tip.
 */
const CUTOUTS: readonly Cutout[] = [
  { id: 'back-left', z: -30, side: -1,
    polygon: [[0, 39], [37, 36], [50, 76], [49, 117], [34, 151], [16, 173], [0, 175]],
    spine: [[31, 47], [28, 79], [29, 110], [18, 143], [3, 169]],
    mass: 1.1, drag: 0.9, bend: 0.9, wind: 1.05 },
  { id: 'back-right', z: -30, side: 1,
    polygon: [[186, 0], [255, 0], [256, 131], [230, 141], [206, 117], [197, 73]],
    spine: [[207, 15], [216, 45], [229, 77], [237, 107], [253, 127]],
    mass: 1.15, drag: 0.92, bend: 0.85, wind: 1.1 },
  { id: 'curl-left', z: 20, side: -1,
    polygon: [[28, 101], [57, 108], [76, 142], [79, 172], [67, 196], [64, 215], [82, 237], [100, 256], [54, 256], [42, 232], [36, 211], [39, 189], [25, 177], [19, 160], [25, 132]],
    spine: [[42, 109], [41, 133], [55, 158], [58, 179], [51, 201], [57, 223], [75, 244], [82, 256]],
    mass: 1.3, drag: 0.95, bend: 1.1, wind: 1.3 },
  { id: 'curl-right', z: 24, side: 1,
    polygon: [[190, 87], [215, 92], [233, 119], [225, 142], [204, 165], [194, 182], [205, 204], [222, 226], [227, 248], [214, 256], [189, 256], [187, 238], [173, 222], [163, 201], [166, 178], [179, 155], [184, 132]],
    spine: [[201, 97], [210, 119], [198, 144], [183, 165], [176, 185], [185, 207], [206, 230], [202, 254]],
    mass: 1.35, drag: 0.97, bend: 1.05, wind: 1.3 },
  { id: 'fringe-outer-left', z: 40, side: -1,
    polygon: [[25, 0], [44, 0], [38, 22], [24, 43], [12, 64], [16, 77], [29, 82], [21, 91], [3, 79], [0, 60], [8, 34]],
    spine: [[35, 3], [29, 24], [18, 44], [10, 64], [24, 83]],
    mass: 0.62, drag: 0.7, bend: 1.05, wind: 0.7 },
  { id: 'fringe-inner-left', z: 42, side: -1,
    polygon: [[45, 0], [78, 0], [67, 24], [55, 42], [53, 60], [54, 78], [68, 95], [87, 110], [86, 122], [70, 120], [47, 105], [32, 82], [24, 60], [35, 32]],
    spine: [[61, 2], [52, 23], [43, 42], [40, 62], [45, 82], [61, 102], [82, 115]],
    mass: 0.72, drag: 0.78, bend: 1.15, wind: 0.68 },
  { id: 'fringe-center', z: 44, side: -1,
    polygon: [[78, 0], [104, 0], [107, 24], [118, 43], [126, 66], [119, 77], [110, 68], [107, 48], [94, 32], [85, 17]],
    spine: [[93, 1], [97, 22], [110, 42], [117, 60], [119, 71]],
    mass: 0.58, drag: 0.72, bend: 1.2, wind: 0.58 },
  { id: 'fringe-right', z: 42, side: 1,
    polygon: [[160, 0], [183, 0], [196, 19], [204, 43], [210, 62], [207, 83], [195, 100], [178, 107], [172, 99], [183, 85], [188, 65], [179, 60], [187, 44], [178, 24]],
    spine: [[170, 1], [182, 22], [193, 44], [196, 66], [193, 84], [177, 101]],
    mass: 0.78, drag: 0.8, bend: 1.15, wind: 0.64 },
]

const BODY: readonly Point[] = [[0, 169], [18, 161], [46, 160], [69, 165], [91, 158], [101, 145], [108, 137], [159, 137], [170, 155], [187, 152], [206, 143], [223, 131], [242, 123], [256, 121], [256, 256], [0, 256]]
const HEAD: readonly Point[] = [[80, 15], [162, 14], [179, 40], [194, 66], [191, 98], [173, 128], [145, 157], [129, 160], [106, 138], [88, 115], [70, 91], [62, 67]]
const FACE_CORE: readonly Point[] = [[89, 87], [110, 83], [174, 82], [177, 103], [168, 130], [144, 157], [128, 158], [107, 138], [98, 122]]
const EYES: readonly (readonly Point[])[] = [
  [[64, 70], [70, 67], [88, 69], [104, 74], [104, 81], [93, 87], [77, 86], [65, 81]],
  [[138, 74], [146, 68], [160, 64], [178, 61], [183, 64], [178, 75], [168, 81], [151, 83], [140, 80]],
]
// The generated semantic matte approximates this narrow inner contour. Trace
// the canonical side lock explicitly so its warm highlights and dark ink do not
// become a stationary strip immediately outside the real right eye.
const RIGHT_TEMPLE: readonly Point[] = [[190, 47], [207, 55], [210, 82], [195, 102], [178, 107], [172, 99], [182, 88], [184, 76], [184, 66], [187, 57]]
const NECKLACE: readonly Point[] = [[98, 166], [105, 194], [116, 218], [128, 238], [136, 243], [149, 232], [162, 210], [171, 174]]
const SHADOW_REGIONS = [
  { hair: 'curl-left', bounds: [[49, 197, 59, 216], [82, 203, 92, 212]] },
  { hair: 'curl-right', bounds: [[164, 188, 180, 220], [195, 228, 202, 242]] },
] as const

const inside = (x: number, y: number, polygon: readonly Point[]): boolean => {
  let yes = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [ax, ay] = polygon[i]!, [bx, by] = polygon[j]!
    if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) yes = !yes
  }
  return yes
}

const segmentDistance = (x: number, y: number, a: Point, b: Point): number => {
  const dx = b[0] - a[0], dy = b[1] - a[1]
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1)))
  return Math.hypot(x - a[0] - dx * t, y - a[1] - dy * t)
}

const onNecklace = (x: number, y: number): boolean => {
  if (x >= 128 && x <= 143 && y >= 237) return true
  for (let i = 1; i < NECKLACE.length; i += 1) if (segmentDistance(x, y, NECKLACE[i - 1]!, NECKLACE[i]!) < 2.5) return true
  return false
}

const pixelColor = (hex: string): number => {
  const value = parseInt(hex.slice(1), 16)
  return (0xff000000 | (value & 255) << 16 | value & 0xff00 | value >>> 16) >>> 0
}
const skin = new Set(PALETTE.slice(17, 27).map(pixelColor))
const hairOutline = new Set([...PALETTE.slice(0, 17), ...PALETTE.slice(39)].map(pixelColor))

const read = (image: CanvasImageSource, size: number): Uint32Array => {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('Unable to prepare independent hair materials.')
  context.imageSmoothingEnabled = false
  context.drawImage(image, 0, 0, size, size)
  return new Uint32Array(context.getImageData(0, 0, size, size).data.buffer)
}

const prepareMatte = (image: CanvasImageSource, canonical: Uint32Array, repair: Uint32Array, size: number): Uint8Array => {
  const pixels = read(image, size)
  const mask = new Uint8Array(pixels.length)
  for (let i = 0; i < pixels.length; i += 1) {
    const value = pixels[i]!
    if (canonical[i]! >>> 24 && value >>> 24 && ((value & 255) + (value >>> 8 & 255) + (value >>> 16 & 255)) >= 384) mask[i] = 1
  }
  const original = mask.slice()
  const radius = Math.max(1, Math.ceil(size / 128))
  for (let index = 0; index < mask.length; index += 1) {
    // The editorial matte deliberately retains inked black strand lines. They
    // are hair material, not transparent holes. Close only canonical hair/ink
    // colors within two logical pixels of white. The local repaired image also
    // identifies brown ink which shares the skin palette: only an actual changed
    // donor surface permits those colors to join. Existing skin gaps stay open.
    const color = canonical[index]!
    if (mask[index] || !(color >>> 24) ||
      !(hairOutline.has(color) || (color !== repair[index] && skin.has(color)))) continue
    const x = index % size, y = Math.floor(index / size)
    let near = false
    for (let dy = -radius; dy <= radius && !near; dy += 1) for (let dx = -radius; dx <= radius; dx += 1) {
      if (dx * dx + dy * dy > radius * radius || x + dx < 0 || x + dx >= size || y + dy < 0 || y + dy >= size) continue
      if (original[(y + dy) * size + x + dx]) { near = true; break }
    }
    if (near) mask[index] = 1
  }
  return mask
}

const resample = (points: readonly Point[], scale: number): Float32Array => {
  const cumulative = [0]
  for (let i = 1; i < points.length; i += 1) cumulative.push(cumulative[i - 1]! + Math.hypot(points[i]![0] - points[i - 1]![0], points[i]![1] - points[i - 1]![1]))
  const total = cumulative[cumulative.length - 1]!
  const output = new Float32Array(HAIR_NODES * 2)
  let segment = 1
  for (let node = 0; node < HAIR_NODES; node += 1) {
    const distance = total * node / (HAIR_NODES - 1)
    while (segment < points.length - 1 && cumulative[segment]! < distance) segment += 1
    const t = (distance - cumulative[segment - 1]!) / (cumulative[segment]! - cumulative[segment - 1]!)
    output[node * 2] = (points[segment - 1]![0] * (1 - t) + points[segment]![0] * t) * scale
    output[node * 2 + 1] = (points[segment - 1]![1] * (1 - t) + points[segment]![1] * t) * scale
  }
  return output
}

/**
 * Multi-source nearest existing skin samples repair only newly uncovered hidden
 * pixels. No generated donor face or invented facial features enter the image.
 */
const nearestSkin = (canonical: Uint32Array, repair: Uint32Array, size: number, matte: Uint8Array | null): Uint32Array => {
  const values = new Uint32Array(size * size)
  const queue = new Uint32Array(values.length)
  let head = 0, tail = 0
  for (let i = 0; i < values.length; i += 1) {
    const x = (i % size + 0.5) * 256 / size, y = (Math.floor(i / size) + 0.5) * 256 / size
    // Hair and skin share palette colors. Seed only semantically known face /
    // repaired body surfaces, rather than treating blonde highlights as skin.
    if (inside(x, y, BODY) && skin.has(repair[i]!) &&
      (repair[i] !== canonical[i] || (!matte?.[i] && !hairOutline.has(canonical[i]!)))) values[i] = repair[i]!
    else if (inside(x, y, FACE_CORE) && skin.has(canonical[i]!)) values[i] = canonical[i]!
    if (values[i]) queue[tail++] = i
  }
  while (head < tail) {
    const index = queue[head++]!, x = index % size, y = Math.floor(index / size)
    for (const next of [x > 0 ? index - 1 : -1, x + 1 < size ? index + 1 : -1, y > 0 ? index - size : -1, y + 1 < size ? index + size : -1]) {
      if (next < 0 || values[next]) continue
      values[next] = values[index]!
      queue[tail++] = next
    }
  }
  return values
}

export const createHairMaterials = (
  open: CanvasImageSource,
  closedImage: CanvasImageSource,
  underpaint: CanvasImageSource,
  size: number,
  matteImage?: CanvasImageSource,
): PortraitMaterials => {
  const canonical = read(open, size), closed = read(closedImage, size), repair = read(underpaint, size)
  const clean = canonical.slice()
  const ownership = new Int16Array(canonical.length).fill(-1)
  const faceMask = new Uint8Array(canonical.length)
  const jewelryMask = new Uint8Array(canonical.length)
  for (const jewelry of createJewelryMasks(canonical, size)) {
    for (let i = 0; i < jewelryMask.length; i += 1) if (jewelry.mask[i]) jewelryMask[i] = 1
  }
  const scale = size / 256
  const matte = matteImage ? prepareMatte(matteImage, canonical, repair, size) : null
  const skinFill = nearestSkin(canonical, repair, size, matte)
  for (let index = 0; index < canonical.length; index += 1) {
    const color = canonical[index]!
    if (!(color >>> 24)) continue
    const x = (index % size + 0.5) / scale, y = (Math.floor(index / size) + 0.5) / scale
    const body = inside(x, y, BODY), head = inside(x, y, HEAD)
    const eyes = EYES.some((eye) => inside(x, y, eye))
    const jewelry = jewelryMask[index] !== 0
    const protectedFace = eyes || inside(x, y, FACE_CORE)
    const fixedBody = body && skin.has(color) && color === repair[index]! && !matte
    if (protectedFace || fixedBody || onNecklace(x, y)) faceMask[index] = 1
    if (protectedFace || fixedBody || jewelry || onNecklace(x, y) || y < 9) continue
    if (matte) {
      if (!matte[index] && !inside(x, y, RIGHT_TEMPLE)) continue
    }
    // Later, higher-z traced cutouts own overlaps. Rest composition is exactly
    // the same canonical pixels regardless of which transparent layer owns them.
    for (let lock = 0; lock < CUTOUTS.length; lock += 1) if (inside(x, y, CUTOUTS[lock]!.polygon)) ownership[index] = lock
    if (matte && (ownership[index]! < 0 || ((body || head) && CUTOUTS[ownership[index]!]!.z < 0))) {
      let best = Infinity, closest = -1
      for (let lock = 0; lock < CUTOUTS.length; lock += 1) {
        const candidate = CUTOUTS[lock]!
        if (candidate.side !== (x < 128 ? -1 : 1)) continue
        if ((body || head) && candidate.z < 0) continue
        for (let segment = 1; segment < candidate.spine.length; segment += 1) {
          const distance = segmentDistance(x, y, candidate.spine[segment - 1]!, candidate.spine[segment]!)
          if (distance < best) { best = distance; closest = lock }
        }
      }
      ownership[index] = closest
    }
    if (ownership[index]! < 0) continue
    if (body) clean[index] = skin.has(repair[index]!) ? repair[index]! : skinFill[index]!
    else if (head) clean[index] = skinFill[index]!
    else clean[index] = 0
  }

  const locks: HairMaterial[] = []
  const remap = new Int16Array(CUTOUTS.length).fill(-1)
  for (let lock = 0; lock < CUTOUTS.length; lock += 1) {
    const definition = CUTOUTS[lock]!
    const pixels = new Uint32Array(canonical.length)
    let x0 = size, y0 = size, x1 = -1, y1 = -1
    const radius = Math.max(1, Math.round(scale * 2))
    for (let index = 0; index < canonical.length; index += 1) {
      if (ownership[index] !== lock) continue
      const x = index % size, y = Math.floor(index / size)
      for (let dy = -radius; dy <= radius; dy += 1) for (let dx = -radius; dx <= radius; dx += 1) {
        const px = x + dx, py = y + dy
        if (px < 0 || py < 0 || px >= size || py >= size || dx * dx + dy * dy > radius * radius) continue
        const other = py * size + px
        // Hidden seam overlap uses only real adjacent canonical hair, never
        // visible skin, a donor face, or the old stationary underpainting.
        const owner = ownership[other]!
        if (owner < 0 || (owner !== lock && CUTOUTS[owner]!.z <= definition.z)) continue
        pixels[other] = canonical[other]!
        x0 = Math.min(x0, px); y0 = Math.min(y0, py)
        x1 = Math.max(x1, px); y1 = Math.max(y1, py)
      }
    }
    // Back locks continue beneath the visible front locks. Their source texture
    // comes exclusively from already classified canonical hair: this is an
    // invisible root-to-tip underlap, never a pasted skin or background strip.
    // Without it, a back lock divided by foreground ownership becomes floating
    // top/bottom fragments as soon as those foreground locks spread apart.
    if (definition.z < 0) {
      for (let index = 0; index < canonical.length; index += 1) {
        const owner = ownership[index]!
        if (owner < 0 || CUTOUTS[owner]!.z <= definition.z) continue
        const x = index % size, y = Math.floor(index / size)
        const px = (x + .5) / scale, py = (y + .5) / scale
        let distance = Infinity
        for (let segment = 1; segment < definition.spine.length; segment += 1) {
          distance = Math.min(distance, segmentDistance(px, py, definition.spine[segment - 1]!, definition.spine[segment]!))
        }
        if (distance > 8) continue
        pixels[index] = canonical[index]!
        x0 = Math.min(x0, x); y0 = Math.min(y0, y)
        x1 = Math.max(x1, x); y1 = Math.max(y1, y)
      }
    }
    if (x1 < 0) continue
    remap[lock] = locks.length
    locks.push({
      id: definition.id, z: definition.z, side: definition.side, pixels,
      bounds: { x0, y0, x1, y1 }, spine: resample(definition.spine, scale),
      motion: { mass: definition.mass, drag: definition.drag, bend: definition.bend, wind: definition.wind },
    })
  }
  const shadows: HairShadow[] = []
  for (const region of SHADOW_REGIONS) {
    const lock = locks.findIndex((material) => material.id === region.hair)
    if (lock < 0) continue
    const hair = locks[lock]!, pixels = new Uint32Array(canonical.length)
    let x0 = size, y0 = size, x1 = -1, y1 = -1
    for (const bounds of region.bounds) {
      const left = Math.max(0, Math.floor(bounds[0] * scale)), right = Math.min(size - 1, Math.ceil((bounds[2] + 1) * scale) - 1)
      const top = Math.max(0, Math.floor(bounds[1] * scale)), bottom = Math.min(size - 1, Math.ceil((bounds[3] + 1) * scale) - 1)
      for (let py = top; py <= bottom; py += 1) for (let px = left; px <= right; px += 1) {
        const index = py * size + px, color = canonical[index]!, donor = repair[index]!
        const x = (px + .5) / scale, y = (py + .5) / scale
        // Only independently reviewed, originally visible skin cast shadows.
        // They are not hair texture and remain separate from hair ownership.
        if (ownership[index]! >= 0 || jewelryMask[index] || !skin.has(color) || !skin.has(donor) ||
          color === donor || !inside(x, y, BODY) || inside(x, y, FACE_CORE) || onNecklace(x, y)) continue
        pixels[index] = color
        clean[index] = donor
        faceMask[index] = 0
        x0 = Math.min(x0, px); y0 = Math.min(y0, py)
        x1 = Math.max(x1, px); y1 = Math.max(y1, py)
      }
    }
    if (x1 < 0) continue
    const id = `shadow-${hair.id}`
    shadows.push({ id, lock, material: {
      id, z: 0, side: hair.side, pixels, bounds: { x0, y0, x1, y1 },
      spine: new Float32Array(hair.spine), motion: { ...hair.motion },
    } })
  }
  const bodyMask = new Uint8Array(canonical.length)
  for (let index = 0; index < ownership.length; index += 1) {
    const x = (index % size + .5) / scale, y = (Math.floor(index / size) + .5) / scale
    if (skin.has(clean[index]!) && inside(x, y, BODY) && !inside(x, y, FACE_CORE) && !onNecklace(x, y) && !jewelryMask[index]) bodyMask[index] = 1
    if (ownership[index]! >= 0) ownership[index] = remap[ownership[index]!]!
    if (ownership[index]! < 0 && !jewelryMask[index] && clean[index] === canonical[index] && canonical[index]! >>> 24 &&
      (inside((index % size + .5) / scale, (Math.floor(index / size) + .5) / scale, FACE_CORE) ||
        (skin.has(canonical[index]!) && inside((index % size + .5) / scale, (Math.floor(index / size) + .5) / scale, BODY)))) faceMask[index] = 1
  }
  return { size, canonical, closed, clean, repair, locks, faceMask, ownership, bodyMask, shadows }
}
