import { geoArea, geoCentroid, geoLength } from 'd3-geo'
import { lift } from './mapColor'
import type { CountryFeature } from '../lib/countries'
import {
  aerosolUnmaskingBoost,
  albedoAmplification,
  amocCoolingC,
  NEUTRAL_PHYSICS,
  type ScenarioPhysics,
} from './earthSystem'

/**
 * Where a country's warming departs from the global mean.
 *
 * The previous model was `f(|latitude|)`, which had one serious consequence:
 * it gave Antarctica the same polar amplification as the Arctic and ranked it
 * the fastest-warming place on Earth. That is backwards. The Southern Ocean
 * takes up heat and overturns it downward, so it is the slowest-warming ocean
 * on the planet, and the Antarctic continent warms at roughly the global mean
 * while the Arctic runs 2–3× it.
 *
 * Three effects are modelled here, all robust across CMIP6:
 *   1. an asymmetric zonal profile (signed latitude, not |latitude|)
 *   2. land–sea contrast — continental interiors warm faster than maritime margins
 *   3. the North Atlantic warming hole south of Greenland
 *
 * Still a sketch of the pattern, not a downscaling of any specific model.
 */

const EARTH_R_KM = 6371
const EARTH_KM2 = 510_072_000
const SR_TO_KM2 = EARTH_KM2 / (4 * Math.PI)

/**
 * Zonal land warming relative to the global mean, by *signed* latitude.
 * Arctic amplification in the north; the Southern Ocean minimum near 50–60°S;
 * Antarctica back near the global mean because it is a high, dry plateau.
 */
const ZONAL_WARMING: { lat: number; ratio: number }[] = [
  { lat: 90, ratio: 2.55 },
  { lat: 80, ratio: 2.45 },
  { lat: 70, ratio: 2.2 },
  { lat: 60, ratio: 1.7 },
  { lat: 50, ratio: 1.4 },
  { lat: 40, ratio: 1.28 },
  { lat: 30, ratio: 1.2 },
  { lat: 20, ratio: 1.1 },
  { lat: 10, ratio: 1.0 },
  { lat: 0, ratio: 0.97 },
  { lat: -10, ratio: 0.95 },
  { lat: -20, ratio: 0.95 },
  { lat: -30, ratio: 0.92 },
  { lat: -40, ratio: 0.82 },
  { lat: -50, ratio: 0.72 },
  { lat: -60, ratio: 0.7 },
  { lat: -70, ratio: 0.85 },
  { lat: -80, ratio: 0.95 },
  { lat: -90, ratio: 1.0 },
]

function zonalRatio(lat: number): number {
  const t = Math.max(-90, Math.min(90, lat))
  // Table runs north → south.
  for (let i = 0; i < ZONAL_WARMING.length - 1; i++) {
    const a = ZONAL_WARMING[i]
    const b = ZONAL_WARMING[i + 1]
    if (t <= a.lat && t >= b.lat) {
      const u = (a.lat - t) / (a.lat - b.lat)
      return a.ratio + u * (b.ratio - a.ratio)
    }
  }
  return 1
}

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
 * The subpolar North Atlantic is the one place projected to warm markedly less
 * than its latitude implies — a slowing overturning circulation stops importing
 * as much heat. Centred on the subpolar gyre south of Greenland.
 */
function warmingHoleFactor(lat: number, lng: number): number {
  const d = greatCircleKm(lat, lng, 55, -30)
  return 1 - 0.3 * Math.exp(-((d / 1400) ** 2))
}

interface GeoShape {
  lat: number
  lng: number
  /**
   * Mean half-width in km (area ÷ perimeter): how far a typical point sits from
   * the country's edge. A stand-in for distance to the coast — cheap, and it
   * sorts sensibly (Bahamas 5 km, Netherlands 23, UK 33, Iceland 36, Chile 37,
   * versus Russia 242, Mongolia 222, Brazil 374).
   */
  halfWidthKm: number
}

// geoCentroid/geoLength over a 50m-resolution polygon is far too costly to redo
// for ~240 countries on every timeline commit.
const shapeCache = new WeakMap<CountryFeature, GeoShape>()

function geoShape(feature: CountryFeature): GeoShape {
  const cached = shapeCache.get(feature)
  if (cached) return cached
  const [lng, lat] = geoCentroid(feature)
  const areaKm2 = feature.__areaKm2 ?? geoArea(feature) * SR_TO_KM2
  const perimeterKm = geoLength(feature) * EARTH_R_KM
  const shape: GeoShape = {
    lat: Number.isFinite(lat) ? lat : 0,
    lng: Number.isFinite(lng) ? lng : 0,
    halfWidthKm: perimeterKm > 0 ? areaKm2 / perimeterKm : 0,
  }
  shapeCache.set(feature, shape)
  return shape
}

/** 0 = fully maritime, 1 = deep continental interior. */
export function continentality(feature: CountryFeature): number {
  const { halfWidthKm } = geoShape(feature)
  return Math.max(0, Math.min(1, (halfWidthKm - 20) / 230))
}

export function countryWarmingMultiplier(
  feature: CountryFeature,
  physics: ScenarioPhysics = NEUTRAL_PHYSICS,
): number {
  const { lat, lng } = geoShape(feature)
  // Land warms ~1.4× as fast as ocean, so a country's exposure to maritime air
  // damps it and a continental interior amplifies it.
  const landSea = 0.88 + 0.26 * continentality(feature)
  const base = zonalRatio(lat) * landSea * warmingHoleFactor(lat, lng)
  // Earth-system pathways add to the pattern rather than replacing it: a darker
  // surface and a thinning aerosol haze both amplify warming where they act.
  const extra =
    albedoAmplification(lat, physics.albedoFeedback) +
    aerosolUnmaskingBoost(lat, lng, physics.aerosolUnmasking)
  return Math.min(3.6, Math.max(0.6, base + extra))
}

export interface CountryTemp {
  absoluteC: number
  deltaSince2020C: number
  multiplier: number
  /** Absolute cooling from a stalled Atlantic circulation, °C (0 when none). */
  amocCoolingC: number
}

export function estimateCountryTemp(
  feature: CountryFeature,
  globalWarmingC: number,
  physics: ScenarioPhysics = NEUTRAL_PHYSICS,
  baselineGlobalC = 1.15,
): CountryTemp {
  const { lat, lng } = geoShape(feature)
  const multiplier = countryWarmingMultiplier(feature, physics)
  // Subtracted rather than scaled: a collapsing overturning circulation can push
  // a region below where it started while the planet as a whole keeps warming,
  // and no multiplier on a positive global mean can ever express that.
  const cooling = amocCoolingC(lat, lng, physics.amocWeakening)
  const absoluteC = globalWarmingC * multiplier - cooling
  // The 2020s reference keeps today's pattern, so the delta shows what this
  // pathway's mechanisms change rather than baking them into both ends.
  const around2020 = baselineGlobalC * countryWarmingMultiplier(feature)
  return {
    absoluteC,
    deltaSince2020C: absoluteC - around2020,
    multiplier,
    amocCoolingC: cooling,
  }
}

export function formatDeltaC(d: number): string {
  const sign = d >= 0 ? '+' : ''
  return `${sign}${d.toFixed(1)}°C`
}

/**
 * Absolute temperature vs pre-industrial, with its own sign.
 *
 * Call sites used to hard-code a leading `+`, which was safe while every
 * pathway only warmed. A stalled Atlantic circulation can put a region below
 * pre-industrial, and that shortcut then printed Iceland as "+-4.0".
 */
export function formatAbsoluteC(c: number, digits = 1): string {
  const rounded = Number(c.toFixed(digits))
  const sign = rounded < 0 ? '−' : '+'
  return `${sign}${Math.abs(rounded).toFixed(digits)}`
}

/**
 * Map fill by local temperature vs pre-industrial: blue where a region ends up
 * colder than it started, then pale cool → cream → amber → rust.
 *
 * Stops are keyed to °C rather than to a normalised position so the cold end
 * could be added without shifting any of the warm anchors — every pathway that
 * existed before still paints exactly as it did. The blues only ever appear
 * under a stalled Atlantic circulation, which is the point of having them.
 */
const TEMP_STOPS = [
  { c: -5, r: 46, g: 82, b: 145 },
  { c: -1, r: 82, g: 128, b: 180 },
  { c: 1, r: 168, g: 196, b: 188 },
  { c: 3.25, r: 214, g: 210, b: 160 },
  { c: 5.5, r: 232, g: 168, b: 92 },
  { c: 7.75, r: 196, g: 92, b: 48 },
  { c: 10, r: 140, g: 36, b: 28 },
] as const

export function tempColor(absoluteC: number, hovered: boolean): string {
  const c = Math.max(TEMP_STOPS[0].c, Math.min(TEMP_STOPS[TEMP_STOPS.length - 1].c, absoluteC))
  let i = 0
  while (i < TEMP_STOPS.length - 2 && c > TEMP_STOPS[i + 1].c) i += 1
  const a = TEMP_STOPS[i]
  const b = TEMP_STOPS[i + 1]
  const u = (c - a.c) / (b.c - a.c || 1)
  const r = Math.round(a.r + u * (b.r - a.r))
  const g = Math.round(a.g + u * (b.g - a.g))
  const bl = Math.round(a.b + u * (b.b - a.b))
  return lift(r, g, bl, hovered)
}

export const TEMP_LEGEND = [
  { label: '−3°C', color: 'rgb(64, 105, 162)' },
  { label: '+1°C', color: 'rgb(168, 196, 188)' },
  { label: '+3°C', color: 'rgb(214, 210, 160)' },
  { label: '+5°C', color: 'rgb(232, 168, 92)' },
  { label: '+8°C', color: 'rgb(196, 92, 48)' },
  { label: '+10°C+', color: 'rgb(140, 36, 28)' },
] as const
