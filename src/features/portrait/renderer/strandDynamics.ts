import { HAIR_CHANNELS, LOOP_MS, sampleMotion } from '../animation/portraitTimeline.ts'
import { CHAIN_STATIONS } from './strandCurve.ts'

const HARMONICS = 3
const TAU = Math.PI * 2
const LIFT = [0.22, 0.30, 0.36, 0.12, 0.18, 0.28, 0.23, 0.34] as const
const FREQUENCY = [4.8, 4.2, 4.5, 5.2, 4.0, 3.8, 3.0, 2.7] as const
const DAMPING = [0.72, 0.76, 0.72, 0.82, 0.78, 0.82, 0.84, 0.88] as const

/**
 * Frequency response of equal masses linked by springs, with an anchored root
 * and a free tip. Air drag damps every mass. Uniform loading has the static
 * profile i(2n+1-i), which we divide out: the artwork's existing root-anchored
 * flexibility field supplies that spatial falloff without attenuating it twice.
 * A complex tridiagonal solve gives the periodic steady state directly.
 */
export const solveStrandResponse = (
  omega: number,
  frequency: number,
  damping: number,
): { real: Float64Array; imaginary: Float64Array } => {
  const count = CHAIN_STATIONS - 1
  const eigenvalue = 4 * Math.sin(Math.PI / (4 * count + 2)) ** 2
  const stiffness = frequency * frequency / eigenvalue
  const drag = 2 * damping * frequency
  const force = 2 * stiffness / (count * (count + 1))
  const diagonalR = new Float64Array(count)
  const diagonalI = new Float64Array(count)
  const forceR = new Float64Array(count).fill(force)
  const forceI = new Float64Array(count)
  for (let node = 0; node < count; node += 1) {
    diagonalR[node] = (node === count - 1 ? stiffness : 2 * stiffness) - omega * omega
    diagonalI[node] = drag * omega
    if (node === 0) continue
    const previous = node - 1
    const denominator = diagonalR[previous]! ** 2 + diagonalI[previous]! ** 2
    const ratioR = -stiffness * diagonalR[previous]! / denominator
    const ratioI = stiffness * diagonalI[previous]! / denominator
    diagonalR[node] = diagonalR[node]! + stiffness * ratioR
    diagonalI[node] = diagonalI[node]! + stiffness * ratioI
    forceR[node] = forceR[node]! - ratioR * forceR[previous]! + ratioI * forceI[previous]!
    forceI[node] = forceI[node]! - ratioR * forceI[previous]! - ratioI * forceR[previous]!
  }
  const real = new Float64Array(CHAIN_STATIONS)
  const imaginary = new Float64Array(CHAIN_STATIONS)
  for (let node = count - 1; node >= 0; node -= 1) {
    const rhsR = forceR[node]! + (node < count - 1 ? stiffness * real[node + 2]! : 0)
    const rhsI = forceI[node]! + (node < count - 1 ? stiffness * imaginary[node + 2]! : 0)
    const denominator = diagonalR[node]! ** 2 + diagonalI[node]! ** 2
    real[node + 1] = (rhsR * diagonalR[node]! + rhsI * diagonalI[node]!) / denominator
    imaginary[node + 1] = (rhsI * diagonalR[node]! - rhsR * diagonalI[node]!) / denominator
  }
  for (let node = 1; node <= count; node += 1) {
    const staticFlex = node * (2 * count + 1 - node) / (count * (count + 1))
    real[node] = real[node]! / staticFlex
    imaginary[node] = imaginary[node]! / staticFlex
  }
  // Root displacement is supplied by the fixed artwork field; the ratio has
  // a finite root limit. There is no free root pixel in the renderer.
  real[0] = real[1]!
  imaginary[0] = imaginary[1]!
  return { real, imaginary }
}

/** Small harmonic coefficients replace per-frame delayed spring/curve solves. */
export class StrandDynamics {
  private readonly cosX = new Float64Array(HAIR_CHANNELS * CHAIN_STATIONS * HARMONICS)
  private readonly sinX = new Float64Array(this.cosX.length)
  private readonly cosY = new Float64Array(this.cosX.length)
  private readonly sinY = new Float64Array(this.cosX.length)
  private readonly cosines = new Float64Array(HARMONICS)
  private readonly sines = new Float64Array(HARMONICS)
  readonly boundsX = new Float64Array(HAIR_CHANNELS)
  readonly boundsY = new Float64Array(HAIR_CHANNELS)

  constructor(table: readonly Float32Array[]) {
    // All wind channels contain only these three harmonics. Orthogonal samples
    // recover their coefficients once, including direction and debug settings.
    const samples = 32
    for (let group = 0; group < HAIR_CHANNELS; group += 1) {
      for (let harmonic = 0; harmonic < HARMONICS; harmonic += 1) {
        const order = harmonic + 1
        let windCos = 0, windSin = 0
        for (let sample = 0; sample < samples; sample += 1) {
          const phase = TAU * order * sample / samples
          const value = sampleMotion(table, LOOP_MS * sample / samples, group)
          windCos += value * Math.cos(phase) * 2 / samples
          windSin += value * Math.sin(phase) * 2 / samples
        }
        const response = solveStrandResponse(TAU * order / (LOOP_MS / 1000), FREQUENCY[group]!, DAMPING[group]!)
        let maximum = 1
        for (let station = 0; station < CHAIN_STATIONS; station += 1) {
          maximum = Math.max(maximum, Math.hypot(response.real[station]!, response.imaginary[station]!))
        }
        // Preserve the bounded pixel-art silhouette at extreme debug settings;
        // scale the complete harmonic, retaining its coupled shape and phase.
        const limit = Math.min(1, 1.2 / maximum)
        for (let station = 0; station < CHAIN_STATIONS; station += 1) {
          const index = (group * CHAIN_STATIONS + station) * HARMONICS + harmonic
          const real = response.real[station]! * limit, imaginary = response.imaginary[station]! * limit
          // The visible face-side and shoulder locks receive slightly more
          // wind load, preserving their established motion inside the circle.
          const load = group >= 4 ? 1.1 : 1
          const cosX = (windCos * real + windSin * imaginary) * load
          const sinX = (windSin * real - windCos * imaginary) * load
          const u = station / (CHAIN_STATIONS - 1)
          const bend = Math.sin(Math.PI * u) * (group >= 6 ? 0.9 : 0.6)
          this.cosX[index] = cosX
          this.sinX[index] = sinX
          this.cosY[index] = -cosX * LIFT[group]! + (cosX - windCos) * bend
          this.sinY[index] = -sinX * LIFT[group]! + (sinX - windSin) * bend
        }
      }
      for (let station = 0; station < CHAIN_STATIONS; station += 1) {
        let boundX = 0, boundY = 0
        for (let harmonic = 0; harmonic < HARMONICS; harmonic += 1) {
          const index = (group * CHAIN_STATIONS + station) * HARMONICS + harmonic
          boundX += Math.hypot(this.cosX[index]!, this.sinX[index]!)
          boundY += Math.hypot(this.cosY[index]!, this.sinY[index]!)
        }
        // Catmull-Rom/Hermite interpolation can overshoot node extrema by at
        // most 25%; include it in the conservative raster candidate bounds.
        this.boundsX[group] = Math.max(this.boundsX[group]!, boundX * 1.25)
        this.boundsY[group] = Math.max(this.boundsY[group]!, boundY * 1.25)
      }
    }
  }

  write(timeMs: number, scale: number, offsetsX: Float32Array, offsetsY: Float32Array): void {
    const phase = TAU * (((timeMs % LOOP_MS) + LOOP_MS) % LOOP_MS) / LOOP_MS
    for (let harmonic = 0; harmonic < HARMONICS; harmonic += 1) {
      this.cosines[harmonic] = Math.cos(phase * (harmonic + 1))
      this.sines[harmonic] = Math.sin(phase * (harmonic + 1))
    }
    for (let node = 0; node < HAIR_CHANNELS * CHAIN_STATIONS; node += 1) {
      let x = 0, y = 0
      for (let harmonic = 0; harmonic < HARMONICS; harmonic += 1) {
        const index = node * HARMONICS + harmonic
        x += this.cosX[index]! * this.cosines[harmonic]! + this.sinX[index]! * this.sines[harmonic]!
        y += this.cosY[index]! * this.cosines[harmonic]! + this.sinY[index]! * this.sines[harmonic]!
      }
      offsetsX[node] = x * scale
      offsetsY[node] = y * scale
    }
  }
}
