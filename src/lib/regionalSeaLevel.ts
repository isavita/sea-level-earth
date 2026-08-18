import { geoCentroid } from 'd3-geo'
import type { CountryFeature } from './countries'

/**
 * Sea level does not rise by the same amount everywhere, and the differences
 * are large enough to change who loses land.
 *
 * The app previously applied one global mean number to every coastline. Three
 * effects break that assumption, all of them well established:
 *
 *  1. **Gravitational fingerprints.** An ice sheet pulls the ocean toward
 *     itself. When it loses mass that pull weakens and the water migrates
 *     away, so relative sea level *falls* within ~2,000 km of a shrinking ice
 *     sheet and rises 10–30% *more* than the global mean in the far field.
 *     Greenland melt therefore hurts the tropics far more than it hurts
 *     Greenland, which is the opposite of most people's intuition.
 *
 *  2. **Ocean dynamics.** A weakening Atlantic overturning circulation piles
 *     water against north-east North America.
 *
 *  3. **Vertical land motion.** Scandinavia and Hudson Bay are still rebounding
 *     from the last ice age and are rising faster than the sea. Deltas where
 *     groundwater and hydrocarbons are pumped out are sinking several times
 *     faster than the ocean is rising.
 *
 * Country-level averages of a field that really varies within a coastline —
 * indicative, not a local planning number.
 */

const EARTH_R_KM = 6371

function greatCircleKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const rad = Math.PI / 180
  const dLat = (lat2 - lat1) * rad
  const dLng = (lng2 - lng1) * rad
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_R_KM * Math.asin(Math.min(1, Math.sqrt(a)))
}

/**
 * Sea-level fingerprint of a melting ice mass, normalised so the global mean
 * contribution is 1. Negative near the source (water flows away), above 1 in
 * the far field. Distance is measured from the edge of the ice, not its centre.
 */
const FINGERPRINT: { km: number; f: number }[] = [
  { km: 0, f: -1.5 },
  { km: 1000, f: -0.8 },
  { km: 2000, f: 0.0 },
  { km: 3000, f: 0.55 },
  { km: 5000, f: 0.95 },
  { km: 7000, f: 1.12 },
  { km: 10000, f: 1.25 },
  { km: 20100, f: 1.3 },
]

function fingerprintAt(distanceKm: number): number {
  const d = Math.max(0, distanceKm)
  for (let i = 0; i < FINGERPRINT.length - 1; i++) {
    const a = FINGERPRINT[i]
    const b = FINGERPRINT[i + 1]
    if (d >= a.km && d <= b.km) {
      const t = (d - a.km) / (b.km - a.km)
      return a.f + t * (b.f - a.f)
    }
  }
  return FINGERPRINT[FINGERPRINT.length - 1].f
}

/** Source regions, with a radius so distance is taken from the ice margin. */
const GREENLAND = { lat: 72, lng: -40, radiusKm: 800 }
const ANTARCTICA = { lat: -90, lng: 0, radiusKm: 2200 }

/**
 * Mountain glaciers are scattered — Alaska, Arctic Canada, Svalbard, the Andes,
 * High Mountain Asia, the Alps — so their combined fingerprint is much flatter
 * than any single ice sheet's: a modest deficit near the big northern clusters,
 * slightly above average everywhere else. Treating them as one point source
 * dropped the whole of north-west Europe into a near-field hole that does not
 * exist (it put the Netherlands at half the global mean).
 */
function glacierFingerprint(lat: number): number {
  if (lat <= 35) return 1.08
  if (lat >= 70) return 0.5
  return 1.08 - (0.58 * (lat - 35)) / 35
}

function sourceFingerprint(
  lat: number,
  lng: number,
  src: { lat: number; lng: number; radiusKm: number },
): number {
  return fingerprintAt(
    greatCircleKm(lat, lng, src.lat, src.lng) - src.radiusKm,
  )
}

/**
 * How the total rise splits between contributors, which sets the pattern.
 * Roughly AR6 SSP2-4.5 at 2100: thermal expansion ~0.21 m, glaciers ~0.12 m,
 * Greenland ~0.10 m, Antarctica ~0.11 m of ~0.56 m total.
 *
 * When marine ice-cliff instability is in play, Antarctica dominates the budget
 * and the *pattern* shifts with it — more far-field enhancement in the northern
 * hemisphere, a deeper drop in the Southern Ocean.
 */
interface Budget {
  thermosteric: number
  glaciers: number
  greenland: number
  antarctica: number
}

const BUDGET_STANDARD: Budget = {
  thermosteric: 0.4,
  glaciers: 0.22,
  greenland: 0.18,
  antarctica: 0.2,
}

const BUDGET_ICE_INSTABILITY: Budget = {
  thermosteric: 0.25,
  glaciers: 0.13,
  greenland: 0.2,
  antarctica: 0.42,
}

/**
 * Combined multiplier on the global mean rise. Thermal expansion is treated as
 * spatially uniform; the three mass terms carry their own fingerprints.
 */
export function fingerprintFactor(
  lat: number,
  lng: number,
  iceSheetInstability: boolean,
): number {
  const b = iceSheetInstability ? BUDGET_ICE_INSTABILITY : BUDGET_STANDARD
  return (
    b.thermosteric * 1 +
    b.glaciers * glacierFingerprint(lat) +
    b.greenland * sourceFingerprint(lat, lng, GREENLAND) +
    b.antarctica * sourceFingerprint(lat, lng, ANTARCTICA)
  )
}

/**
 * Dynamic sea level from a slowing Atlantic overturning circulation, which
 * banks water against the US north-east and Atlantic Canada. Expressed as a
 * share of the global mean rise.
 */
export function dynamicFactor(lat: number, lng: number): number {
  const d = greatCircleKm(lat, lng, 42, -68)
  return 0.2 * Math.exp(-((d / 1200) ** 2))
}

/**
 * Vertical land motion in mm/yr — **positive means the land is sinking**, which
 * adds to relative sea-level rise.
 *
 * Two very different processes are folded together here: glacial isostatic
 * adjustment (slow, well constrained, still lifting Fennoscandia and the
 * Hudson Bay shore) and delta subsidence driven mostly by groundwater
 * extraction (fast, local, and in places larger than the climate signal).
 * Country-wide averages of something that varies hugely within a country —
 * Jakarta sinks an order of magnitude faster than Indonesia's average here.
 */
const VERTICAL_LAND_MOTION_MM_YR: Record<string, number> = {
  // Post-glacial rebound — land rising, relative sea level falling
  SWE: -6.5,
  FIN: -6.0,
  NOR: -3.0,
  EST: -2.0,
  LVA: -1.2,
  LTU: -0.8,
  DNK: -0.3,
  CAN: -2.0,
  ISL: -2.5,
  GRL: -3.5,
  RUS: -0.5,
  // Forebulge collapse — land sinking around the old ice margin
  GBR: 0.6,
  DEU: 0.5,
  POL: 0.4,
  USA: 1.5,
  // Deltas: groundwater and hydrocarbon extraction dominate
  BGD: 4.0,
  VNM: 4.5,
  IDN: 5.0,
  THA: 4.0,
  MMR: 3.0,
  PHL: 2.0,
  EGY: 2.5,
  IRQ: 3.0,
  NGA: 2.5,
  PAK: 2.0,
  IND: 1.2,
  CHN: 2.0,
  NLD: 1.0,
  ITA: 1.0,
  MEX: 1.5,
  GUY: 2.0,
  SUR: 1.5,
  JPN: 0.8,
  KOR: 0.5,
  ARG: 0.6,
  AUS: 0.3,
}

/** Global mean rise is quoted against 1995–2014, whose midpoint is 2005. */
const SLR_BASELINE_YEAR = 2005

export interface LocalSeaLevel {
  /** Relative sea-level rise at this country's coast, in metres. */
  riseM: number
  /** Local rise ÷ global mean rise. */
  ratio: number
  /** Gravitational + dynamic multiplier, before land motion. */
  factor: number
  /** Vertical land motion, mm/yr; positive = sinking. */
  vlmMmPerYr: number
}

interface Centroid {
  lat: number
  lng: number
}

const centroidCache = new WeakMap<CountryFeature, Centroid>()

function centroidOf(feature: CountryFeature): Centroid {
  const cached = centroidCache.get(feature)
  if (cached) return cached
  const [lng, lat] = geoCentroid(feature)
  const c = {
    lat: Number.isFinite(lat) ? lat : 0,
    lng: Number.isFinite(lng) ? lng : 0,
  }
  centroidCache.set(feature, c)
  return c
}

export function localSeaLevel(
  feature: CountryFeature,
  globalMeanM: number,
  year: number,
  iceSheetInstability: boolean,
): LocalSeaLevel {
  const { lat, lng } = centroidOf(feature)
  const iso3 = feature.__risk?.iso3 ?? null
  const vlmMmPerYr = (iso3 && VERTICAL_LAND_MOTION_MM_YR[iso3]) || 0

  const factor =
    fingerprintFactor(lat, lng, iceSheetInstability) + dynamicFactor(lat, lng)
  const landMotionM =
    (vlmMmPerYr / 1000) * Math.max(0, year - SLR_BASELINE_YEAR)
  const riseM = globalMeanM * factor + landMotionM

  return {
    riseM,
    ratio: globalMeanM > 0 ? riseM / globalMeanM : 1,
    factor,
    vlmMmPerYr,
  }
}

/** Short human note on why a coast departs from the global mean. */
export function seaLevelNote(local: LocalSeaLevel): string | null {
  if (local.vlmMmPerYr <= -2) {
    return 'Land is still rebounding from the last ice age faster than the sea is rising.'
  }
  if (local.vlmMmPerYr >= 3) {
    return 'Delta subsidence — mostly groundwater extraction — adds more than the climate signal here.'
  }
  if (local.factor >= 1.15) {
    return 'Far from the melting ice sheets, so it gets more than its share of their meltwater.'
  }
  if (local.factor <= 0.7) {
    return 'Close to a shrinking ice sheet, whose weakening gravity pulls water away from this coast.'
  }
  return null
}
