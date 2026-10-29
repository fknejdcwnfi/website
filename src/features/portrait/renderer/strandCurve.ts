/** Finer spatial samples keep long curls continuous without smoothing pixels. */
export const CHAIN_STATIONS = 17

/** Root-anchored flex reaches the visible middle before the cropped free tips. */
export const strandFlexibility = (position: number, longLock: boolean): number => {
  const u = Math.max(0, Math.min(1, position))
  // Both profiles keep zero slope at the root and a fixed unit tip weight.
  // Long curls retain a gradual pull; short locks bend through their middle.
  return longLock ? u ** 1.45 * (1 + 0.12 * Math.sin(Math.PI * u)) : u * u * (3 - 2 * u)
}

/** Reuse one cubic Hermite coefficient buffer for all strand channels. */
export const writeStrandCurve = (offsets: Float32Array, curve: Float64Array): void => {
  for (let base = 0; base < offsets.length; base += CHAIN_STATIONS) {
    for (let station = 0; station < CHAIN_STATIONS; station += 1) {
      const index = base + station
      const coefficient = index * 4
      const current = offsets[index]!
      const next = offsets[base + Math.min(CHAIN_STATIONS - 1, station + 1)]!
      const previous = offsets[base + Math.max(0, station - 1)]!
      const after = offsets[base + Math.min(CHAIN_STATIONS - 1, station + 2)]!
      const startTangent = station === 0 ? next - current : (next - previous) * 0.5
      const endTangent = station >= CHAIN_STATIONS - 2 ? next - current : (after - current) * 0.5
      curve[coefficient] = station === CHAIN_STATIONS - 1 ? 0 : 2 * (current - next) + startTangent + endTangent
      curve[coefficient + 1] = station === CHAIN_STATIONS - 1 ? 0 : 3 * (next - current) - 2 * startTangent - endTangent
      curve[coefficient + 2] = station === CHAIN_STATIONS - 1 ? 0 : startTangent
      curve[coefficient + 3] = current
    }
  }
}

/** index addresses a four-coefficient segment; mix is its local 0..1 position. */
export const sampleStrandCurve = (curve: Float64Array, index: number, mix: number): number =>
  ((curve[index]! * mix + curve[index + 1]!) * mix + curve[index + 2]!) * mix + curve[index + 3]!
