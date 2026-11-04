import { HAIR_NODES, type HairMaterial } from './hairTypes.ts'

export type MeshDiagnostics = {
  vertices: number
  triangles: number
  foldedTriangles: number
  rasterCandidates: number
  paintedPixels: number
  areaProjections: number
  correctedVertices: number
  maxVertexCorrection: number
  minimumAreaRatio: number
}

/**
 * A transparent cutout bound to the arc of its own rest spine. The source grid
 * merely tessellates its texture; it is never a global image displacement field.
 * Each vertex blends the two neighboring bone frames at its closest arc point.
 */
export class HairMesh {
  readonly material: HairMaterial
  readonly size: number
  readonly rest: Float32Array
  readonly positions: Float32Array
  readonly triangles: Uint16Array
  readonly diagnostics: MeshDiagnostics
  private readonly first: Uint8Array
  private readonly blend: Float32Array
  private readonly inverseMass: Uint8Array
  private readonly minimumAreas: Float64Array
  private readonly unprojected: Float32Array
  private readonly cosine = new Float64Array(HAIR_NODES - 1)
  private readonly sine = new Float64Array(HAIR_NODES - 1)
  private readonly rootsX = new Float64Array(HAIR_NODES - 1)
  private readonly rootsY = new Float64Array(HAIR_NODES - 1)

  constructor(material: HairMaterial, size: number) {
    this.material = material
    this.size = size
    const { x0, y0, x1, y1 } = material.bounds
    const step = Math.max(3, size / 32)
    const columns = Math.max(1, Math.ceil((x1 + 1 - x0) / step))
    const rows = Math.max(1, Math.ceil((y1 + 1 - y0) / step))
    const vertices = (columns + 1) * (rows + 1)
    this.rest = new Float32Array(vertices * 2)
    this.positions = new Float32Array(this.rest.length)
    this.first = new Uint8Array(vertices)
    this.blend = new Float32Array(vertices)
    this.inverseMass = new Uint8Array(vertices)
    this.unprojected = new Float32Array(this.rest.length)
    const indices: number[] = []
    for (let row = 0; row <= rows; row += 1) {
      for (let column = 0; column <= columns; column += 1) {
        const index = row * (columns + 1) + column
        const x = x0 + (x1 + 1 - x0) * column / columns
        const y = y0 + (y1 + 1 - y0) * row / rows
        this.rest[index * 2] = x
        this.rest[index * 2 + 1] = y
        let nearest = Infinity, bone = 0, mix = 0
        for (let node = 0; node < HAIR_NODES - 1; node += 1) {
          const ax = material.spine[node * 2]!, ay = material.spine[node * 2 + 1]!
          const dx = material.spine[node * 2 + 2]! - ax
          const dy = material.spine[node * 2 + 3]! - ay
          const fraction = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / Math.max(1e-8, dx * dx + dy * dy)))
          const distance = (x - ax - dx * fraction) ** 2 + (y - ay - dy * fraction) ** 2
          if (distance < nearest) { nearest = distance; bone = node; mix = fraction }
        }
        this.first[index] = bone
        this.blend[index] = mix
        // A vertex bound entirely to the attachment frame remains prescribed.
        this.inverseMass[index] = bone === 0 && mix === 0 ? 0 : 1
      }
    }
    // Transparent cells never become visible when the mesh moves. Omit them
    // once, rather than scanning a padded rectangle every animation frame.
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const a = row * (columns + 1) + column, b = a + 1
        const c = a + columns + 1, d = c + 1
        let visible = false
        const left = Math.max(0, Math.floor(this.rest[a * 2]!))
        const right = Math.min(size - 1, Math.ceil(this.rest[d * 2]!) - 1)
        const top = Math.max(0, Math.floor(this.rest[a * 2 + 1]!))
        const bottom = Math.min(size - 1, Math.ceil(this.rest[d * 2 + 1]!) - 1)
        for (let y = top; y <= bottom && !visible; y += 1) {
          for (let x = left; x <= right; x += 1) {
            if (material.pixels[y * size + x]! >>> 24) { visible = true; break }
          }
        }
        if (visible) indices.push(a, b, c, b, d, c)
      }
    }
    this.triangles = new Uint16Array(indices)
    this.minimumAreas = new Float64Array(indices.length / 3)
    for (let triangle = 0; triangle < indices.length; triangle += 3) {
      const a = indices[triangle]! * 2, b = indices[triangle + 1]! * 2, c = indices[triangle + 2]! * 2
      const area = (this.rest[b]! - this.rest[a]!) * (this.rest[c + 1]! - this.rest[a + 1]!)
        - (this.rest[b + 1]! - this.rest[a + 1]!) * (this.rest[c]! - this.rest[a]!)
      this.minimumAreas[triangle / 3] = area * 0.1
    }
    this.positions.set(this.rest)
    this.diagnostics = { vertices, triangles: indices.length / 3, foldedTriangles: 0, rasterCandidates: 0, paintedPixels: 0,
      areaProjections: 0, correctedVertices: 0, maxVertexCorrection: 0, minimumAreaRatio: 1 }
  }

  update(pose: Float32Array): void {
    const spine = this.material.spine
    for (let bone = 0; bone < HAIR_NODES - 1; bone += 1) {
      const index = bone * 2
      const rx = spine[index + 2]! - spine[index]!, ry = spine[index + 3]! - spine[index + 1]!
      const px = pose[index + 2]! - pose[index]!, py = pose[index + 3]! - pose[index + 1]!
      const denominator = Math.max(1e-8, Math.hypot(rx, ry) * Math.hypot(px, py))
      this.cosine[bone] = (rx * px + ry * py) / denominator
      this.sine[bone] = (rx * py - ry * px) / denominator
      this.rootsX[bone] = pose[index]!
      this.rootsY[bone] = pose[index + 1]!
    }
    for (let vertex = 0; vertex < this.first.length; vertex += 1) {
      const first = this.first[vertex]!, second = Math.min(HAIR_NODES - 2, first + 1)
      const mix = this.blend[vertex]!
      const x = this.rest[vertex * 2]!, y = this.rest[vertex * 2 + 1]!
      const ax = x - spine[first * 2]!, ay = y - spine[first * 2 + 1]!
      const bx = x - spine[second * 2]!, by = y - spine[second * 2 + 1]!
      const firstX = this.rootsX[first]! + ax * this.cosine[first]! - ay * this.sine[first]!
      const firstY = this.rootsY[first]! + ax * this.sine[first]! + ay * this.cosine[first]!
      const secondX = this.rootsX[second]! + bx * this.cosine[second]! - by * this.sine[second]!
      const secondY = this.rootsY[second]! + bx * this.sine[second]! + by * this.cosine[second]!
      this.positions[vertex * 2] = firstX + (secondX - firstX) * mix
      this.positions[vertex * 2 + 1] = firstY + (secondY - firstY) * mix
    }
    this.preserveArea()
  }

  /**
   * A broad curl's outer edge can cross neighboring bone Voronoi regions. Keep
   * those few membrane triangles positively oriented with a local PBD area
   * constraint. This moves vertices, never hides triangles or reduces the rod's
   * motion. Every frame starts from LBS, so projection cannot accumulate drift.
   */
  private preserveArea(): void {
    const { positions: p, triangles, minimumAreas, inverseMass: mass } = this
    let projections = 0, minimumRatio = Infinity, needsFinalAreaScan = false
    for (let iteration = 0; iteration < 8; iteration += 1) {
      let changed = false
      minimumRatio = Infinity
      for (let triangle = 0; triangle < triangles.length; triangle += 3) {
        const va = triangles[triangle]!, vb = triangles[triangle + 1]!, vc = triangles[triangle + 2]!
        const a = va * 2, b = vb * 2, c = vc * 2
        const ax = p[a]!, ay = p[a + 1]!, bx = p[b]!, by = p[b + 1]!, cx = p[c]!, cy = p[c + 1]!
        const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)
        const minimum = minimumAreas[triangle / 3]!
        minimumRatio = Math.min(minimumRatio, area / (minimum * 10))
        if (area >= minimum * 0.999) continue
        const gaX = by - cy, gaY = cx - bx
        const gbX = cy - ay, gbY = ax - cx
        const gcX = ay - by, gcY = bx - ax
        const wa = mass[va]!, wb = mass[vb]!, wc = mass[vc]!
        const denominator = wa * (gaX * gaX + gaY * gaY) + wb * (gbX * gbX + gbY * gbY) + wc * (gcX * gcX + gcY * gcY)
        if (denominator < 1e-10) continue
        if (projections === 0) this.unprojected.set(p)
        const correction = (minimum * 1.001 - area) / denominator
        p[a] = ax + wa * correction * gaX; p[a + 1] = ay + wa * correction * gaY
        p[b] = bx + wb * correction * gbX; p[b + 1] = by + wb * correction * gbY
        p[c] = cx + wc * correction * gcX; p[c + 1] = cy + wc * correction * gcY
        projections += 1
        changed = true
      }
      needsFinalAreaScan = changed
      if (!changed) break
    }
    let corrected = 0, maximum = 0
    if (projections) for (let vertex = 0; vertex < p.length; vertex += 2) {
      const distance = Math.hypot(p[vertex]! - this.unprojected[vertex]!, p[vertex + 1]! - this.unprojected[vertex + 1]!)
      if (distance > 1e-7) corrected += 1
      maximum = Math.max(maximum, distance)
    }
    if (needsFinalAreaScan) {
      minimumRatio = Infinity
      for (let triangle = 0; triangle < triangles.length; triangle += 3) {
        const a = triangles[triangle]! * 2, b = triangles[triangle + 1]! * 2, c = triangles[triangle + 2]! * 2
        const area = (p[b]! - p[a]!) * (p[c + 1]! - p[a + 1]!) - (p[b + 1]! - p[a + 1]!) * (p[c]! - p[a]!)
        minimumRatio = Math.min(minimumRatio, area / (minimumAreas[triangle / 3]! * 10))
      }
    }
    this.diagnostics.areaProjections = projections
    this.diagnostics.correctedVertices = corrected
    this.diagnostics.maxVertexCorrection = maximum
    this.diagnostics.minimumAreaRatio = minimumRatio
  }

  /** Forward triangles with nearest texel lookup, opaque palette or clear alpha. */
  draw(target: Uint32Array): void {
    const { positions, rest, triangles, size } = this
    let candidates = 0, painted = 0, folded = 0
    for (let triangle = 0; triangle < triangles.length; triangle += 3) {
      const a = triangles[triangle]! * 2, b = triangles[triangle + 1]! * 2, c = triangles[triangle + 2]! * 2
      const ax = positions[a]!, ay = positions[a + 1]!
      const bx = positions[b]!, by = positions[b + 1]!
      const cx = positions[c]!, cy = positions[c + 1]!
      const area = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
      if (!Number.isFinite(area) || Math.abs(area) < 1e-7) continue
      if (area < 0) folded += 1
      const left = Math.max(0, Math.ceil(Math.min(ax, bx, cx) - 0.5))
      const right = Math.min(size - 1, Math.floor(Math.max(ax, bx, cx) - 0.5))
      const top = Math.max(0, Math.ceil(Math.min(ay, by, cy) - 0.5))
      const bottom = Math.min(size - 1, Math.floor(Math.max(ay, by, cy) - 0.5))
      if (left > right || top > bottom) continue
      const inverse = 1 / area
      const w0x = (by - cy) * inverse, w0y = (cx - bx) * inverse
      const w1x = (cy - ay) * inverse, w1y = (ax - cx) * inverse
      const w0c = (bx * cy - cx * by) * inverse, w1c = (cx * ay - ax * cy) * inverse
      const ux = rest[a]! * w0x + rest[b]! * w1x - rest[c]! * (w0x + w1x)
      const uy = rest[a]! * w0y + rest[b]! * w1y - rest[c]! * (w0y + w1y)
      const vx = rest[a + 1]! * w0x + rest[b + 1]! * w1x - rest[c + 1]! * (w0x + w1x)
      const vy = rest[a + 1]! * w0y + rest[b + 1]! * w1y - rest[c + 1]! * (w0y + w1y)
      const uc = rest[a]! * w0c + rest[b]! * w1c + rest[c]! * (1 - w0c - w1c)
      const vc = rest[a + 1]! * w0c + rest[b + 1]! * w1c + rest[c + 1]! * (1 - w0c - w1c)
      for (let y = top; y <= bottom; y += 1) {
        let w0 = w0x * (left + 0.5) + w0y * (y + 0.5) + w0c
        let w1 = w1x * (left + 0.5) + w1y * (y + 0.5) + w1c
        let u = ux * (left + 0.5) + uy * (y + 0.5) + uc
        let v = vx * (left + 0.5) + vy * (y + 0.5) + vc
        for (let x = left; x <= right; x += 1, w0 += w0x, w1 += w1x, u += ux, v += vx) {
          if (w0 < -1e-7 || w1 < -1e-7 || w0 + w1 > 1.0000001) continue
          candidates += 1
          const sx = Math.floor(u + 1e-8), sy = Math.floor(v + 1e-8)
          if (sx < 0 || sx >= size || sy < 0 || sy >= size) continue
          const color = this.material.pixels[sy * size + sx]!
          if (color >>> 24 === 255) { target[y * size + x] = color; painted += 1 }
        }
      }
    }
    this.diagnostics.foldedTriangles = folded
    this.diagnostics.rasterCandidates = candidates
    this.diagnostics.paintedPixels = painted
  }
}
