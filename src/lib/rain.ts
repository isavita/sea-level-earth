import { geoCentroid } from 'd3-geo'
import type { CountryFeature } from './countries'

/**
 * Illustrative precipitation model:
 * - Baseline annual rainfall (mm/yr) from World Bank when available, else latitude heuristic
 * - Climate delta scales with extra warming and a latitude pattern (high latitudes / tropics
 *   tend wetter; subtropics ~20–35° tend drier) — IPCC AR6–shaped sketch, not a GCM downscale.
 */

export interface CountryRain {
  /** Baseline annual precipitation (mm/yr), ~recent climatology. */
  baselineMm: number
  /** Projected annual precipitation under the selected pathway/year (mm/yr). */
  futureMm: number
  /** Absolute change vs baseline (mm/yr). */
  deltaMm: number
  /** Relative change vs baseline (fraction, e.g. 0.12 = +12%). */
  deltaFrac: number
  /** True if baseline came from World Bank rather than a latitude fallback. */
  fromObservations: boolean
}

/** Rough global-mean annual precip by absolute latitude when WB data is missing. */
export function precipFallbackMm(feature: CountryFeature): number {
  const [, lat] = geoCentroid(feature)
  const absLat = Math.abs(lat || 0)
  // Crude climatology: wet tropics, dry subtropics, moderate mid-lats, drier polar
  if (absLat < 10) return 2200
  if (absLat < 20) return 1400
  if (absLat < 35) return 450
  if (absLat < 50) return 750
  if (absLat < 65) return 600
  return 280
}

/**
 * Fractional precip change per °C of *extra* warming above ~2020s (~1.15°C).
 * Positive = wetter. Pattern inspired by large-scale AR6 signals.
 */
export function precipSensitivityPerC(feature: CountryFeature): number {
  const [, lat] = geoCentroid(feature)
  const absLat = Math.abs(lat || 0)
  if (absLat >= 55) return 0.07 // high latitudes: wetter
  if (absLat >= 40) return 0.035
  if (absLat >= 35) return -0.01
  if (absLat >= 18) return -0.05 // subtropical drying belt
  if (absLat >= 8) return 0.04 // wetter tropics / monsoon-ish
  return 0.055
}

export function estimateCountryRain(
  feature: CountryFeature,
  globalWarmingC: number,
  baselineGlobalC = 1.15,
): CountryRain {
  const observed = feature.__risk?.precipMm
  const fromObservations = observed != null && observed > 0
  const baselineMm = fromObservations
    ? observed
    : precipFallbackMm(feature)

  const extraWarming = Math.max(0, globalWarmingC - baselineGlobalC)
  const sens = precipSensitivityPerC(feature)
  // Soften extreme relative swings for very dry countries
  const damp = baselineMm < 200 ? 0.6 : baselineMm < 400 ? 0.8 : 1
  const deltaFrac = sens * extraWarming * damp
  const futureMm = Math.max(5, baselineMm * (1 + deltaFrac))
  const deltaMm = futureMm - baselineMm

  return {
    baselineMm,
    futureMm,
    deltaMm,
    deltaFrac,
    fromObservations,
  }
}

export function formatMm(mm: number): string {
  if (mm >= 1000) return `${(mm / 1000).toFixed(2)} m/yr`
  if (mm >= 100) return `${mm.toFixed(0)} mm/yr`
  return `${mm.toFixed(1)} mm/yr`
}

export function formatDeltaMm(mm: number): string {
  const sign = mm >= 0 ? '+' : ''
  if (Math.abs(mm) >= 100) return `${sign}${mm.toFixed(0)} mm`
  if (Math.abs(mm) >= 10) return `${sign}${mm.toFixed(0)} mm`
  return `${sign}${mm.toFixed(1)} mm`
}

export function formatDeltaFrac(frac: number): string {
  const pct = frac * 100
  const sign = pct >= 0 ? '+' : ''
  if (Math.abs(pct) < 0.1) return '~0%'
  if (Math.abs(pct) < 10) return `${sign}${pct.toFixed(1)}%`
  return `${sign}${pct.toFixed(0)}%`
}

/** Map fill by relative precip change: brown (drier) → teal (wetter). */
export function rainDeltaColor(deltaFrac: number, hovered: boolean): string {
  // Map −25% … +25% onto a diverging scale
  const t = Math.max(-1, Math.min(1, deltaFrac / 0.25))
  let r: number, g: number, b: number
  if (t < 0) {
    const u = -t
    // neutral → dry amber/brown
    r = Math.round(196 + u * (160 - 196))
    g = Math.round(206 - u * 110)
    b = Math.round(192 - u * 140)
  } else {
    const u = t
    // neutral → wet teal/blue
    r = Math.round(196 - u * 120)
    g = Math.round(206 - u * 20)
    b = Math.round(192 + u * 40)
  }
  return `rgba(${r}, ${g}, ${b}, ${hovered ? 0.98 : 0.94})`
}

export const RAIN_LEGEND = [
  { label: '−25% drier', color: 'rgb(160, 96, 52)' },
  { label: 'Little change', color: 'rgb(196, 206, 192)' },
  { label: '+25% wetter', color: 'rgb(76, 186, 232)' },
] as const
