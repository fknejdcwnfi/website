import assert from 'node:assert/strict'
import test from 'node:test'
import { HairMesh } from '../../src/features/portrait/renderer/hairMesh.ts'

const size = 32
const makeMaterial = () => {
  const pixels = new Uint32Array(size * size)
  for (let y = 5; y < 28; y += 1) for (let x = 10; x < 22; x += 1) {
    if ((x === 10 || x === 21) && y % 3 === 0) continue
    if (x === 15 && y > 12 && y < 17) continue
    pixels[y * size + x] = [0xffa1c1de, 0xff303d52, 0xffd4e8f2][(x + y) % 3]
  }
  const spine = new Float32Array(32)
  for (let node = 0; node < 16; node += 1) { spine[node * 2] = 16; spine[node * 2 + 1] = 5 + node * 22 / 15 }
  return { id: 'test-lock', side: 1, z: 1, pixels, bounds: { x0: 10, y0: 5, x1: 21, y1: 27 }, spine,
    motion: { mass: 1, drag: 1, bend: 1, wind: 1 } }
}

test('a rest skeletal mesh reconstructs every opaque cutout pixel and preserves its transparent holes', () => {
  const material = makeMaterial(), mesh = new HairMesh(material, size), target = new Uint32Array(size * size)
  mesh.update(material.spine)
  mesh.draw(target)
  assert.deepEqual(target, material.pixels)
  assert.equal(mesh.diagnostics.foldedTriangles, 0)
})

test('a translated lock moves its own complete silhouette without copying neighboring artwork', () => {
  const material = makeMaterial(), mesh = new HairMesh(material, size), pose = new Float32Array(material.spine)
  const expected = new Uint32Array(size * size), target = new Uint32Array(expected.length)
  const dx = 7, dy = -3
  for (let node = 0; node < 16; node += 1) { pose[node * 2] += dx; pose[node * 2 + 1] += dy }
  for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) {
    if (x + dx >= 0 && x + dx < size && y + dy >= 0 && y + dy < size) expected[(y + dy) * size + x + dx] = material.pixels[y * size + x]
  }
  mesh.update(pose)
  mesh.draw(target)
  assert.deepEqual(target, expected)
  assert.equal(mesh.diagnostics.foldedTriangles, 0)
})

test('bone-frame skinning rotates the cutout around its root while preserving nearest-neighbor colors', () => {
  const material = makeMaterial(), mesh = new HairMesh(material, size), pose = new Float32Array(material.spine)
  const expected = new Uint32Array(size * size), target = new Uint32Array(expected.length)
  const rootX = 16, rootY = 16
  for (let node = 0; node < 16; node += 1) {
    const x = pose[node * 2] - rootX, y = pose[node * 2 + 1] - rootY
    pose[node * 2] = rootX - y; pose[node * 2 + 1] = rootY + x
  }
  for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) {
    const nx = Math.floor(rootX - (y + 0.5 - rootY)), ny = Math.floor(rootY + (x + 0.5 - rootX))
    if (nx >= 0 && nx < size && ny >= 0 && ny < size) expected[ny * size + nx] = material.pixels[y * size + x]
  }
  mesh.update(pose)
  mesh.draw(target)
  assert.deepEqual(target, expected)
  assert.equal(mesh.diagnostics.foldedTriangles, 0)
})

test('off-canvas material is clipped without corrupting existing scene pixels', () => {
  const material = makeMaterial(), mesh = new HairMesh(material, size), pose = new Float32Array(material.spine)
  for (let node = 0; node < 16; node += 1) pose[node * 2] += 1000
  const target = new Uint32Array(size * size).fill(0xff010203), expected = new Uint32Array(target)
  mesh.update(pose)
  mesh.draw(target)
  assert.deepEqual(target, expected)
  assert.equal(mesh.diagnostics.paintedPixels, 0)
})

test('a curled broad edge keeps positive area with a local correction while the attachment and tip motion remain intact', () => {
  // Actual 2791.6667 ms curl-left regression: the unconstrained outer triangle
  // at (0,171.3), (7.9286,171.3), (0,179) had signed area -1.90025.
  const grid = 256, pixels = new Uint32Array(grid * grid)
  for (let y = 102; y < grid; y += 1) for (let x = 0; x < 111; x += 1) pixels[y * grid + x] = 0xffa1c1de
  const spine = Float32Array.from([
    42,109,41.5522537,119.745911,41.1045074,130.491821,45.0284729,140.19371,
    50.2835159,149.577713,55.15588,159.091171,56.676899,169.738312,57.575665,180.333633,
    54.314636,190.582565,51.053612,200.831512,53.783367,211.205673,56.613255,221.58194,
    63.042843,230.049988,70.042259,238.215973,76.58075,246.709854,82,256,
  ])
  const pose = Float32Array.from([
    42,109,41.5522537,119.745911,40.53299,130.452393,43.40303,140.515915,
    47.209312,150.573425,50.216576,160.82782,49.272678,171.538422,47.425472,182.007477,
    41.387066,190.904663,35.204765,199.703781,34.556847,210.410263,33.933365,221.146561,
    37.297256,231.231995,41.279243,241.222275,44.707584,251.377792,46.813629,261.924805,
  ])
  const originalPose = new Float32Array(pose)
  const mesh = new HairMesh({ id: 'wide-curl-regression', side: -1, z: 20, pixels,
    bounds: { x0: 0, y0: 102, x1: 110, y1: 255 }, spine,
    motion: { mass: 1, drag: 1, bend: 1, wind: 1 } }, grid)
  mesh.update(pose)
  let minimumArea = Infinity
  for (let i = 0; i < mesh.triangles.length; i += 3) {
    const a = mesh.triangles[i] * 2, b = mesh.triangles[i + 1] * 2, c = mesh.triangles[i + 2] * 2, p = mesh.positions
    minimumArea = Math.min(minimumArea, (p[b] - p[a]) * (p[c + 1] - p[a + 1]) - (p[b + 1] - p[a + 1]) * (p[c] - p[a]))
  }
  assert.ok(minimumArea > 6, `every triangle needs positive membrane area, received ${minimumArea}`)
  assert.ok(mesh.diagnostics.areaProjections > 0)
  assert.equal(mesh.diagnostics.correctedVertices, 3)
  assert.ok(mesh.diagnostics.maxVertexCorrection < .6)
  assert.deepEqual(pose, originalPose, 'the physical rod is never weakened or rewritten')
  assert.deepEqual(mesh.positions.slice(10, 12), mesh.rest.slice(10, 12), 'the prescribed attachment remains exact')
  const tip = mesh.positions.length - 2
  assert.ok(Math.hypot(mesh.positions[tip] - mesh.rest[tip], mesh.positions[tip + 1] - mesh.rest[tip + 1]) > 30)
  const target = new Uint32Array(grid * grid)
  mesh.draw(target)
  assert.equal(mesh.diagnostics.foldedTriangles, 0)
  assert.ok(mesh.diagnostics.paintedPixels > 10000)
  assert.ok(target.every(color => color === 0 || color === 0xffa1c1de))
  const corrected = new Float32Array(mesh.positions)
  mesh.update(pose)
  assert.deepEqual(mesh.positions, corrected, 'area correction is deterministic and does not accumulate')
  mesh.update(spine)
  target.fill(0)
  mesh.draw(target)
  assert.deepEqual(target, pixels, 'returning to rest keeps the complete canonical silhouette')
  assert.equal(mesh.diagnostics.areaProjections, 0)
})
