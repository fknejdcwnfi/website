import type { Theme } from '../../features/portrait/animation/stageOptions'

export const SIZE = 192
type Point = readonly [number, number]
type Scene = { timeMs: number; wind: number; seed: number; theme: Theme; eyeOpen: number }
type Colors = { sky: string; haze: string; glow: string; stone: string; edge: string; accent: string }

/** Small, editable palettes, separate from geometry and motion. */
export const THEMES: Record<Theme, Colors> = {
  midnight: { sky: '#080e1c', haze: '#101f35', glow: '#244654', stone: '#142a37', edge: '#2d5360', accent: '#83dddf' },
  emerald: { sky: '#081713', haze: '#102a22', glow: '#275142', stone: '#16392e', edge: '#39634a', accent: '#b1e5a0' },
  amethyst: { sky: '#160f24', haze: '#29203e', glow: '#493657', stone: '#302640', edge: '#625074', accent: '#dbb2fa' },
}

const HAIR = ['#50494b', '#716662', '#96867a', '#bba88b', '#d8c4a0', '#f0debb', '#fff0d0']
const SKIN = ['#956b64', '#b68576', '#cca38b', '#dfb99b', '#f0cdb0']
const TAU = Math.PI * 2

/** Stable integer hash: texture and particles do not shimmer between frames. */
const noise = (x: number, y: number, seed: number): number => {
  let value = Math.imul(x + 17, 374761393) ^ Math.imul(y + 71, 668265263) ^ seed
  value = Math.imul(value ^ (value >>> 13), 1274126177)
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296
}

/** Original procedural pixel portrait; no edits or sampling of source artwork. */
export const drawVoxel = (ctx: CanvasRenderingContext2D, scene: Scene): void => {
  const { seed, wind, eyeOpen } = scene
  const palette = THEMES[scene.theme]
  const phase = scene.timeMs / 4800 * TAU
  const rect = (x: number, y: number, w: number, h: number, color: string): void => {
    ctx.fillStyle = color
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h))
  }
  const poly = (points: readonly Point[], color: string): void => {
    ctx.fillStyle = color
    ctx.beginPath()
    points.forEach(([x, y], i) => i === 0 ? ctx.moveTo(Math.round(x), Math.round(y)) : ctx.lineTo(Math.round(x), Math.round(y)))
    ctx.closePath()
    ctx.fill()
  }
  const gem = (x: number, y: number, scale = 1): void => {
    rect(x, y, 3 * scale, 1 * scale, '#ede3c8')
    rect(x - scale, y + scale, 5 * scale, 5 * scale, '#24465c')
    rect(x, y + scale, 3 * scale, 6 * scale, '#47aace')
    rect(x, y + scale, scale, 3 * scale, '#dcf8f1')
    rect(x + scale, y + 4 * scale, 2 * scale, 2 * scale, '#24749f')
    rect(x + scale, y + 7 * scale, scale, scale, '#b7e6e3')
  }
  const strand = (x: number, y: number, width: number, length: number, delay: number, amplitude: number, light: number): void => {
    for (let row = 0; row < length; row += 3) {
      const weight = (row / length) ** 2
      const sway = Math.round(Math.sin(phase - delay + row / length) * amplitude * wind * weight)
      const taper = row > length * 0.82 ? Math.floor((row / length - 0.82) * width * 3) : 0
      const left = x + sway + Math.floor(row / length * 2)
      const span = Math.max(3, width - taper)
      rect(left, y + row, span, 3, HAIR[light]!)
      rect(left, y + row, 2, 3, HAIR[Math.max(0, light - 2)]!)
      rect(left + 3, y + row, Math.max(1, span / 3), 3, HAIR[Math.min(6, light + 1)]!)
      if (noise(Math.floor(x / 3), row / 3, seed) > 0.72) rect(left + span - 3, y + row, 2, 2, HAIR[Math.max(0, light - 1)]!)
    }
  }

  ctx.imageSmoothingEnabled = false
  rect(0, 0, SIZE, SIZE, palette.sky)
  // A restrained, block-built night scene. No blur, filters or external textures.
  rect(16, 16, 160, 158, palette.haze)
  rect(25, 23, 144, 137, palette.sky)
  rect(44, 29, 105, 122, palette.haze)
  rect(59, 39, 77, 104, palette.glow)
  for (let i = 0; i < 24; i += 1) {
    const x = Math.floor(noise(i, 2, seed) * 178) + 6
    const y = Math.floor(noise(i, 9, seed) * 127) + 9
    rect(x, y, i % 4 === 0 ? 2 : 1, 1, i % 3 === 0 ? palette.accent : palette.edge)
  }
  // Pixel moon and quiet architectural blocks establish the voxel world.
  rect(145, 26, 15, 15, '#c7d8ce')
  rect(148, 26, 12, 3, '#e0ead8')
  rect(142, 26, 5, 12, palette.sky)
  rect(155, 35, 5, 6, '#92adae')
  for (const [x, y, w, h] of [[10, 121, 27, 48], [155, 111, 27, 61], [19, 103, 14, 18], [162, 96, 11, 15]]) {
    rect(x!, y!, w!, h!, palette.stone)
    rect(x!, y!, w!, 2, palette.edge)
    rect(x!, y!, 2, h!, palette.edge)
    for (let j = 0; j < 4; j += 1) rect(x! + 5 + j % 2 * 8, y! + 7 + j * 9, 6, 3, palette.haze)
  }
  poly([[17, 172], [100, 153], [181, 172], [100, 191]], palette.stone)
  poly([[17, 172], [100, 190], [100, 192], [17, 177]], palette.sky)
  poly([[17, 172], [100, 153], [181, 172], [177, 173], [100, 157], [22, 174]], palette.edge)

  // Seven independently phased hair groups; roots stay anchored.
  rect(56, 51, 88, 111, HAIR[0]!)
  strand(48, 55, 20, 112, 0.2, 3, 2)
  strand(125, 51, 22, 124, 0.9, 5, 3)
  strand(42, 83, 18, 86, 1.3, 5, 3)
  strand(139, 79, 17, 92, 2.2, 6, 4)

  // Fixed cuboid shoulders, neckline and dress. Nothing translates the body.
  poly([[55, 126], [117, 117], [148, 130], [148, 174], [60, 174]], '#21222e')
  poly([[148, 130], [160, 120], [160, 166], [148, 174]], '#111725')
  poly([[55, 126], [67, 115], [129, 108], [160, 120], [148, 130], [117, 117]], '#48404a')
  rect(55, 126, 18, 39, SKIN[2]!)
  rect(59, 126, 14, 31, SKIN[3]!)
  rect(128, 126, 20, 35, SKIN[3]!)
  rect(144, 128, 4, 33, SKIN[1]!)
  rect(78, 114, 45, 26, SKIN[2]!)
  rect(84, 108, 33, 20, SKIN[3]!)
  rect(84, 109, 33, 7, SKIN[1]!)
  poly([[73, 126], [86, 130], [100, 148], [116, 130], [128, 126], [128, 139], [100, 159], [73, 140]], SKIN[3]!)
  rect(73, 126, 3, 17, '#292633')
  rect(125, 126, 3, 17, '#292633')
  for (let i = 0; i <= 9; i += 1) {
    const y = 129 + i * 2
    rect(82 + i * 2, y, 2, 2, i % 2 ? '#b6b4a8' : '#5c6063')
    rect(118 - i * 2, y, 2, 2, i % 2 ? '#e2dcc8' : '#687479')
  }
  gem(98, 150, 1.2)
  rect(65, 166, 72, 2, '#303341')
  rect(76, 169, 59, 3, '#191d2a')

  // Head: square front, extruded side and top, with hand placed pixel texture.
  poly([[63, 48], [79, 35], [143, 35], [127, 48]], HAIR[5]!)
  poly([[127, 48], [143, 35], [143, 99], [127, 112]], HAIR[2]!)
  rect(63, 48, 64, 64, SKIN[3]!)
  rect(63, 48, 5, 64, SKIN[1]!)
  rect(68, 61, 6, 44, SKIN[2]!)
  rect(74, 52, 49, 19, SKIN[4]!)
  rect(122, 65, 5, 47, SKIN[2]!)
  rect(68, 108, 54, 4, SKIN[2]!)
  // Nose planes and restrained red smirk remain identical throughout the loop.
  rect(95, 86, 3, 10, SKIN[2]!)
  rect(98, 92, 2, 5, SKIN[1]!)
  rect(94, 96, 5, 1, '#bd8b79')
  rect(89, 102, 16, 2, '#9e5352')
  rect(105, 100, 4, 2, '#794a48')
  rect(94, 104, 9, 1, '#f2c5ae')
  rect(103, 101, 2, 1, '#f7d8c0')

  // Arched brows and eyes are local pixels, never a second face image.
  for (const x of [74, 106]) {
    rect(x, 75, 13, 2, '#695951')
    rect(x + 2, 73, 9, 2, '#695951')
    const open = Math.max(0, Math.min(1, eyeOpen))
    const height = Math.round(open * 7)
    const top = 87 - height
    if (height > 0) {
      ctx.save()
      ctx.beginPath()
      ctx.rect(x, top, 15, height)
      ctx.clip()
      rect(x, 80, 15, 7, '#e0dace')
      rect(x + 4, 80, 7, 7, '#24617e')
      rect(x + 5, 82, 5, 5, '#61bdd4')
      rect(x + 6, 80, 3, 5, '#152939')
      rect(x + 8, 80, 2, 2, '#f3ffff')
      ctx.restore()
    }
    rect(x, 87, 14, 1, '#957566')
    rect(x - 1, top - 1, 16, 2, '#302a32')
    rect(x - 2, top - 2, 2, 2, '#302a32')
  }

  // Dark root/part and asymmetrical champagne bangs are unmistakable cues.
  rect(63, 48, 64, 11, HAIR[1]!)
  poly([[68, 44], [83, 35], [139, 35], [127, 44]], HAIR[4]!)
  // Broad voxel tiles instead of a smooth painted hair surface.
  poly([[82, 36], [99, 36], [91, 42], [74, 42]], HAIR[6]!)
  poly([[103, 36], [120, 36], [113, 42], [96, 42]], HAIR[5]!)
  poly([[122, 36], [138, 36], [130, 42], [114, 42]], HAIR[3]!)
  poly([[78, 42], [95, 42], [91, 45], [74, 45]], HAIR[4]!)
  rect(96, 47, 14, 8, HAIR[0]!)
  rect(99, 49, 8, 6, HAIR[1]!)
  strand(62, 47, 14, 38, 0, 1, 4)
  strand(73, 48, 12, 24, 0.2, 1, 5)
  strand(82, 48, 9, 20, 0.45, 1, 4)
  strand(109, 47, 12, 23, 0.4, 1, 5)
  strand(120, 46, 13, 35, 0.8, 1, 4)
  strand(60, 73, 9, 58, 1, 2, 3)
  strand(125, 74, 10, 62, 2, 2, 4)
  strand(57, 113, 12, 65, 2.3, 4, 4)
  strand(131, 116, 12, 63, 3, 5, 5)
  // Ear chains attach at a fixed point; only the lower links sway.
  for (const [x, delay] of [[70, 0.4], [123, 1.2]]) {
    for (let link = 0; link < 5; link += 1) {
      const sway = Math.round(Math.sin(phase - delay!) * wind * link! / 4)
      rect(x! + sway, 105 + link! * 3, 1, 2, link! % 2 ? '#a9b2b2' : '#e5d7b7')
    }
    gem(x! - 1 + Math.round(Math.sin(phase - delay!) * wind), 120)
  }

  // Three slow square motes, behind the outer frame and away from the face.
  for (let i = 0; i < 6; i += 1) {
    const x = (i % 2 ? 158 : 23) + Math.round(Math.sin(phase + i) * 5)
    const y = 64 + i * 17 + Math.round(Math.cos(phase + i * 2) * 4)
    rect(x, y, 2, 2, palette.accent)
    if (i % 2 === 0) rect(x - 1, y + 1, 1, 1, palette.edge)
  }
  // Crisp, inset frame with jewel-like corner details.
  for (const [x, y] of [[4, 4], [179, 4], [4, 179], [179, 179]]) {
    rect(x!, y!, 9, 2, palette.edge)
    rect(x!, y!, 2, 9, palette.edge)
    rect(x! + 3, y! + 3, 2, 2, palette.accent)
  }
}
