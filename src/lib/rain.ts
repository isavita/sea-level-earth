import { geoCentroid } from 'd3-geo'
import type { CountryFeature } from './countries'
import {
  amocRainfallShift,
  NEUTRAL_PHYSICS,
  type ScenarioPhysics,
} from './earthSystem'

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
 * Zonal precipitation sensitivity per °C of extra warming, by absolute
 * latitude. Smoothly interpolated rather than banded, so neighbouring
 * countries don't jump across a step (Spain vs Greece used to differ wildly
 * for no physical reason).
 *
 * Shape: wet ITCZ near the equator → dry subtropical descent around 20–30° →
 * wetter again through the mid-latitudes → strongly wetter in the Arctic.
 * Calibrated so end-of-century values land near AR6 ranges (e.g. Northern
 * Europe ≈ +15% at 4.4°C rather than the +23% a flat 0.07/°C produced).
 */
const ZONAL_SENS: { lat: number; s: number }[] = [
  { lat: 0, s: 0.05 },
  { lat: 10, s: 0.03 },
  { lat: 20, s: -0.03 },
  { lat: 30, s: -0.035 },
  { lat: 38, s: -0.015 },
  { lat: 45, s: 0.02 },
  { lat: 55, s: 0.035 },
  { lat: 65, s: 0.05 },
  { lat: 75, s: 0.07 },
  { lat: 90, s: 0.08 },
]

function zonalSensPerC(absLat: number): number {
  const pts = ZONAL_SENS
  if (absLat <= pts[0].lat) return pts[0].s
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]
    const b = pts[i + 1]
    if (absLat >= a.lat && absLat <= b.lat) {
      const t = (absLat - a.lat) / (b.lat - a.lat)
      return a.s + t * (b.s - a.s)
    }
  }
  return pts[pts.length - 1].s
}

/**
 * Regional corrections where the zonal pattern is simply wrong.
 *
 * A latitude-only model cannot tell the Asian monsoon from the Sahara — both
 * sit near 25°N, yet one is projected wetter and the other drier. These boxes
 * carry the well-established AR6 regional signals: monsoon Asia wetter, and
 * the Mediterranean, southwest North America, southern Africa, central Chile,
 * southern Australia and eastern Amazonia drier than their latitude implies.
 */
function regionalSensAdjust(lat: number, lng: number): number {
  // Monsoon Asia — wetter than the subtropical belt would suggest. Applied
  // only north of ~12°N: its job is to cancel the false subtropical drying,
  // and stacking it on the already-wet equatorial zone double-counts (it sent
  // Sri Lanka to +34%).
  if (lat > 12 && lat < 35 && lng > 65 && lng < 95) return 0.07 // South Asia
  if (lat > 20 && lat < 45 && lng > 100 && lng < 145) return 0.045 // East Asia
  // Mediterranean — one of the clearest drying signals anywhere
  if (lat > 30 && lat < 46 && lng > -10 && lng < 42) return -0.045
  // Southwest North America
  if (lat > 25 && lat < 40 && lng > -125 && lng < -100) return -0.02
  // Southern Africa
  if (lat > -35 && lat < -15 && lng > 10 && lng < 42) return -0.025
  // Central Chile / subtropical west South America
  if (lat > -45 && lat < -25 && lng > -78 && lng < -66) return -0.025
  // Southern Australia
  if (lat > -40 && lat < -22 && lng > 112 && lng < 150) return -0.02
  // Eastern Amazonia — drying under forest loss + circulation shifts
  if (lat > -15 && lat < 5 && lng > -75 && lng < -45) return -0.035
  return 0
}

/**
 * Fractional precip change per °C of *extra* warming above ~2020s (~1.15°C).
 * Positive = wetter. AR6-shaped sketch, not a GCM downscale.
 */
/** Centroid accessors, guarded against the degenerate geometries. */
function safeLat(feature: CountryFeature): number {
  const [, lat] = geoCentroid(feature)
  return Number.isFinite(lat) ? lat : 0
}

function safeLng(feature: CountryFeature): number {
  const [lng] = geoCentroid(feature)
  return Number.isFinite(lng) ? lng : 0
}

export function precipSensitivityPerC(feature: CountryFeature): number {
  const [lng, lat] = geoCentroid(feature)
  const safeLat = lat || 0
  const safeLng = lng || 0
  return (
    zonalSensPerC(Math.abs(safeLat)) + regionalSensAdjust(safeLat, safeLng)
  )
}

export function estimateCountryRain(
  feature: CountryFeature,
  globalWarmingC: number,
  physics: ScenarioPhysics = NEUTRAL_PHYSICS,
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
  // A stalling Atlantic circulation drags the tropical rain belt south, which
  // is a shift in *where* the rain falls rather than a response to warming — so
  // it is added on top rather than scaled by the temperature change.
  const circulation = amocRainfallShift(
    safeLat(feature),
    safeLng(feature),
    physics.amocWeakening,
  )
  const deltaFrac = sens * extraWarming * damp + circulation
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
