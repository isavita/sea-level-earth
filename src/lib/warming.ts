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
 *
 * The reach is 1,900 km rather than the 1,400 it was first given, because the
 * hole in CMIP6 is a broad feature spanning roughly 45–65°N and not a spot. At
 * the narrower radius it barely touched the places it exists to describe, and
 * the zonal table's Arctic amplification — which is a sea-ice and snow-albedo
 * signal — reached them instead. Iceland came out as the eighth fastest-warming
 * country on Earth at 1.52× the global mean, when it is an island in open water
 * in the middle of the hole and warms at roughly the global rate. That is the
 * same error, one step down, as the `|latitude|` model this file replaced, which
 * gave Antarctica the Arctic's amplification.
 *
 * Checked against the AR6 Atlas warming ratios for 54 countries, widening the
 * reach moves 37 into range to 39 and cuts the worst overestimate from +0.32 to
 * +0.22, without pushing anything below its range. The depth is unchanged at
 * 0.3: deepening it as well over-corrected, dragging Greenland, France and
 * Ireland under their assessed ranges.
 */
function warmingHoleFactor(lat: number, lng: number): number {
  const d = greatCircleKm(lat, lng, 55, -30)
  return 1 - 0.3 * Math.exp(-((d / 1900) ** 2))
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

/**
 * How far from a country's main landmass a piece of it can sit and still count
 * toward where that country *is*.
 *
 * Far enough to keep every real archipelago whole — from Borneo, the far ends of
 * Indonesia are about 1,800 km; Luzon to Mindanao is 1,000; mainland Norway to
 * Svalbard is 1,200 — and short enough to drop territory on the other side of an
 * ocean. That distinction matters because `geoCentroid` weights by area, so a
 * distant possession does not just nudge the result, it drags it off the
 * country: France came out at 43.0°N, 6.7°W, a point in the Bay of Biscay off
 * northern Spain, 825 km from anywhere in France, because Guiana, the Antilles,
 * Réunion and Mayotte pull the spherical mean south and west. Every layer in the
 * app reads this centroid, so France was being given the temperature, rainfall,
 * water balance, fire weather and humid heat of open ocean at Spain's latitude —
 * and it landed inside the Mediterranean drying box, which mainland France at
 * 46.6°N sits north of.
 *
 * The United States moves the same way, from South Dakota to Kansas, once Alaska
 * and Hawaii stop pulling on it.
 */
const MAIN_BODY_RANGE_KM = 3000

/**
 * The country minus any far-flung territory — or the country unchanged, which is
 * the answer for all but a handful.
 */
function mainBody(feature: CountryFeature): CountryFeature {
  const g = feature.geometry
  if (g.type !== 'MultiPolygon' || g.coordinates.length < 2) return feature
  // Largest part first: it is what "the country" means for this purpose.
  let main: number[][][] | null = null
  let mainArea = 0
  for (const poly of g.coordinates) {
    const area = geoArea({ type: 'Polygon', coordinates: poly })
    if (area > mainArea) {
      mainArea = area
      main = poly
    }
  }
  if (!main) return feature
  const [mLng, mLat] = geoCentroid({ type: 'Polygon', coordinates: main })
  if (!Number.isFinite(mLat)) return feature
  const kept = g.coordinates.filter((poly) => {
    const [pLng, pLat] = geoCentroid({ type: 'Polygon', coordinates: poly })
    if (!Number.isFinite(pLat)) return false
    return greatCircleKm(mLat, mLng, pLat, pLng) <= MAIN_BODY_RANGE_KM
  })
  if (kept.length === g.coordinates.length || kept.length === 0) return feature
  return {
    ...feature,
    geometry: { type: 'MultiPolygon', coordinates: kept },
  } as CountryFeature
}

function geoShape(feature: CountryFeature): GeoShape {
  const cached = shapeCache.get(feature)
  if (cached) return cached
  const body = mainBody(feature)
  const [lng, lat] = geoCentroid(body)
  // Area stays the country's own measured figure — the outlying parts are still
  // its territory, they just do not say where its climate is. Only the shape
  // terms are read off the main body.
  const areaKm2 = feature.__areaKm2 ?? geoArea(feature) * SR_TO_KM2
  const perimeterKm = geoLength(body) * EARTH_R_KM
  const shape: GeoShape = {
    lat: Number.isFinite(lat) ? lat : 0,
    lng: Number.isFinite(lng) ? lng : 0,
    halfWidthKm: perimeterKm > 0 ? areaKm2 / perimeterKm : 0,
  }
  shapeCache.set(feature, shape)
  return shape
}

/**
 * The country's centroid, off the same cache the warming model uses.
 *
 * Exported because every other model layer needs it too, and `geoCentroid` over
 * a 50m polygon is expensive enough that calling it fresh per layer per
 * timeline commit was measurable — the rainfall model alone did it three times
 * per call.
 */
export function countryCentroid(feature: CountryFeature): {
  lat: number
  lng: number
} {
  return geoShape(feature)
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
