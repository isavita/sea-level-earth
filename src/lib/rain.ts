import { lift } from './mapColor'
import type { CountryFeature } from './countries'
import { countryCentroid } from './warming'
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

/**
 * Measured annual precipitation for places the World Bank series does not cover,
 * mm/yr — a hand-entered observational table, the same kind of prescribed input
 * as `SEA_PATCHES` in `humidHeat.ts` and `OBSERVED_BURNED_AREA_KM2` in `fire.ts`.
 *
 * It exists because the latitude fallback below is a *zonal land* climatology,
 * and the places that fall through to it are mostly the two cases that
 * climatology describes worst: maritime islands, which it treats as continental
 * interiors, and desert coasts at tropical latitudes, which it treats as wet
 * tropics. Both errors were large enough to be visible downstream, because the
 * water balance, the fire model and the humid-heat layer all read this number:
 *
 *   - Somaliland was handed 2,200 mm — the wet-tropics value for anything inside
 *     10° of the equator — against an observed 250. Modelled as a rainforest, it
 *     grew 10,300 km²/yr of burned area out of the Horn of Africa.
 *   - Western Sahara was handed 450 mm against an observed 45, and burned
 *     13,100 km²/yr of hyper-arid desert.
 *   - Taiwan, Hong Kong and Macao all sit in the 20–35° band the fallback treats
 *     as subtropical desert at 450 mm. They receive 2,450 to 2,500.
 *
 * Only the entries that carry real area or real prominence are listed. Between
 * them they cover 99.6% of the land that was falling through; what is left is
 * small islands under 12,000 km², which keep the fallback and are noted in the
 * layer's limits rather than filled in with numbers that would be guesses.
 */
const OBSERVED_PRECIP_MM: Record<string, number> = {
  // Verified against national meteorological services this pass.
  Somaliland: 250, // Hargeisa ~250; the northern coast 50–150
  'W. Sahara': 45, // hyper-arid; most of the territory under 50
  Taiwan: 2500, // Water Resources Agency national mean 2,502
  'Hong Kong': 2450, // Hong Kong Observatory 1995–2014, 2,456
  Macao: 1900, // 1,818–2,058 depending on period
  'New Caledonia': 1020, // territory mean; Nouméa ~1,070, the east coast far wetter
  Montenegro: 1700, // one of the wettest countries in Europe
  'Faeroe Is.': 1400,
  Tonga: 1900, // Tongatapu 1,600, Vava'u 2,210
  'Cook Is.': 2000,
  Aruba: 550, // the ABC islands are arid, not the wet Caribbean
  'Curaçao': 550,
  'Saint Helena': 500, // Jamestown 154, the interior highlands far wetter
  // Large area, standard figures, and both already flagged as frozen ground —
  // listed so the global totals are not carried by a latitude guess.
  Greenland: 340,
  Antarctica: 170,
}

/** Rough global-mean annual precip by absolute latitude when WB data is missing. */
export function precipFallbackMm(feature: CountryFeature): number {
  const measured = OBSERVED_PRECIP_MM[feature.properties.name]
  if (measured != null) return measured
  const absLat = Math.abs(countryCentroid(feature).lat)
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
export function precipSensitivityPerC(feature: CountryFeature): number {
  const { lat, lng } = countryCentroid(feature)
  return zonalSensPerC(Math.abs(lat)) + regionalSensAdjust(lat, lng)
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
  const { lat, lng } = countryCentroid(feature)
  const circulation = amocRainfallShift(lat, lng, physics.amocWeakening)
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
  return lift(r, g, b, hovered)
}

export const RAIN_LEGEND = [
  { label: '−25% drier', color: 'rgb(160, 96, 52)' },
  { label: 'Little change', color: 'rgb(196, 206, 192)' },
  { label: '+25% wetter', color: 'rgb(76, 186, 232)' },
] as const
