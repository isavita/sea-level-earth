import type { Position } from 'geojson'
import type { CountryFeature } from './countries'
import { lift } from './mapColor'
import { estimateCountryRain } from './rain'
import {
  annualMeanTempC,
  climateGeoAt,
  dailyTempRangeC,
  droughtFromClimate,
  monthlyBalance,
  MONTH_DAYS,
  seasonalAmplitudeC,
  surfaceHumidity,
  type ClimateGeo,
  type MonthlyTrace,
} from './drought'
import {
  continentality,
  countryCentroid,
  estimateCountryTemp,
} from './warming'
import { NEUTRAL_PHYSICS, type ScenarioPhysics } from './earthSystem'

/**
 * Fire: how long the season is, and how much of the country burns.
 *
 * Fire is the clearest case in this app of a risk that is *not* a straight
 * scaling of warming, and modelling it that way gets it badly wrong — it would
 * make the Sahara the most flammable place on Earth. Three things have to be
 * true at once for landscape fire: something to burn, that fuel has to be dry,
 * and the atmosphere has to be thirsty enough to keep it dry. Deserts fail the
 * first test, rainforests normally fail the second, and the places that burn
 * are the ones that swing between the two.
 *
 * The atmospheric term is **vapour pressure deficit** — the gap between how
 * much moisture the air could hold and how much it does. VPD is the variable
 * that has come to dominate the fire literature over the last decade, because
 * it is the one that responds super-linearly to warming: saturation vapour
 * pressure follows the Clausius–Clapeyron relation and climbs about 7% per °C,
 * so the drying power of the air accelerates even where rainfall holds steady.
 *
 * That gives a fire-weather index, which is where this layer used to stop. An
 * index has one fatal property: nobody can check it. "Fire weather 46" cannot
 * be wrong, because it is not a claim about anything. So the model now carries
 * on to two quantities that can be:
 *
 *  1. **Fire season length in days.** Counted month by month over the annual
 *     cycle — how much of the year has both cured fuel and thirsty enough air.
 *  2. **Burned area in km²/yr.** Calibrated against the satellite record (see
 *     `OBSERVED_BURNED_AREA_KM2`), which is what makes the rest falsifiable.
 *
 * Getting burned area right needs two things the index never did.
 *
 * The first is that **fuel load and fuel dryness are different quantities**
 * that move in opposite directions with rainfall, and a single "dryness" term
 * cannot carry both. Fuel load follows productivity, which follows the water
 * the land actually evaporates; dryness follows the season when it cannot. So
 * the wet season grows the grass that the dry season burns, and the global
 * peak of burned area sits at neither end of the rainfall range but in the
 * middle of it — the savannas, at roughly 700–1,200 mm.
 *
 * The second is that **grass and forest are not the same fire**. Grass cures in
 * weeks, regrows in one season, and carries fast, low-intensity fire that can
 * re-burn the same hectare every year or two. Forest needs years of drought to
 * dry its heavy fuels, burns at a fire-return interval of decades to centuries,
 * and is worth fighting. They differ by more than an order of magnitude in
 * annual burned fraction and must not share one curve.
 *
 * And a country is not a point. The single hardest failure this model had was
 * DR Congo, whose centroid sits in rainforest and which nonetheless burns more
 * than almost any country on Earth, because its fires are all on the savanna
 * fringes north and south of the forest. That is not fixable with a per-country
 * correction; it is fixed by stopping the pretence that one climate describes a
 * country 2,000 km across. See `latitudeSpread`.
 */

/* -------------------------------------------------------------------------- */
/* Observed burned area — the calibration reference                            */
/* -------------------------------------------------------------------------- */

/**
 * Mean annual burned area, km²/yr, from the MODIS burned-area record.
 *
 * Rounded from the MCD64A1 / GFED4s-era national means over roughly 2001–2020
 * as reported in the global fire literature (Giglio et al. 2018 for MCD64A1;
 * van der Werf et al. 2017 for GFED4s), accessed as published figures rather
 * than recomputed here. Two properties of that record matter for how these
 * numbers are used: interannual variability is enormous — Australia's own range
 * spans roughly 200,000 to 1,200,000 km² between years, and Canada's 2023 alone
 * burned six times its long-run mean — and the satellite product misses small
 * fires, so agricultural and Mediterranean landscapes are understated in it.
 *
 * These are NOT a lookup. No code path returns one of these numbers as the
 * model's answer, and every value the model reports responds to warming and to
 * the pathway's Earth-system physics. They do two jobs:
 *
 *  1. Offline, they set `BURNED_AREA_SCALE` — one global constant, fitted so
 *     that the modelled global total and Africa's share of it land on the
 *     observed ones. That is the whole of the tuning; nothing per-country.
 *  2. In the app, they are shown next to the model's own figure for the
 *     countries listed, so a reader can see immediately where it is close and
 *     where it is not. An estimate nobody can check is not worth showing.
 */
const OBSERVED_BURNED_AREA_KM2: Record<string, number> = {
  AGO: 300000, // Angola
  COD: 280000, // DR Congo
  AUS: 450000, // Australia
  SDN: 190000, // Sudan
  SSD: 150000, // South Sudan
  CAF: 165000, // Central African Republic
  ZMB: 155000, // Zambia
  TZA: 155000, // Tanzania
  MOZ: 145000, // Mozambique
  BRA: 200000, // Brazil
  NGA: 120000, // Nigeria
  TCD: 120000, // Chad
  RUS: 120000, // Russia
  CMR: 75000, // Cameroon
  BWA: 75000, // Botswana
  MLI: 80000, // Mali
  GIN: 60000, // Guinea
  ETH: 55000, // Ethiopia
  KAZ: 55000, // Kazakhstan
  ZWE: 50000, // Zimbabwe
  NAM: 50000, // Namibia
  BOL: 50000, // Bolivia
  VEN: 50000, // Venezuela
  MDG: 45000, // Madagascar
  COG: 38000, // Congo
  ARG: 38000, // Argentina
  ZAF: 38000, // South Africa
  USA: 35000, // United States
  CIV: 35000, // Cote d'Ivoire
  UGA: 32000, // Uganda
  KEN: 30000, // Kenya
  GHA: 30000, // Ghana
  IND: 30000, // India
  IDN: 28000, // Indonesia
  CAN: 26000, // Canada
  MMR: 22000, // Myanmar
  CHN: 20000, // China
  MEX: 20000, // Mexico
  COL: 18000, // Colombia
  MNG: 15000, // Mongolia
  PRY: 15000, // Paraguay
  SEN: 14000, // Senegal
  UKR: 9000, // Ukraine
  ESP: 1200, // Spain
  PRT: 1700, // Portugal
  GRC: 700, // Greece
  ITA: 700, // Italy
  FRA: 400, // France
  TUR: 300, // Turkey
  JPN: 90, // Japan
  DEU: 30, // Germany
  GBR: 90, // United Kingdom
  IRL: 60, // Ireland
  NZL: 60, // New Zealand
  BGD: 30, // Bangladesh
  EGY: 30, // Egypt
  SAU: 10, // Saudi Arabia
  LBY: 10, // Libya
}

/** The satellite figure for a country, where the record carries one. */
export function observedBurnedAreaKm2(feature: CountryFeature): number | null {
  const iso3 = feature.__risk?.iso3
  if (!iso3) return null
  return OBSERVED_BURNED_AREA_KM2[iso3] ?? null
}

/* -------------------------------------------------------------------------- */
/* People                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Population in millions, rounded, roughly 2023 (UN World Population Prospects).
 *
 * The one socio-economic input in this app, and it is here because burned area
 * cannot be modelled without it. The largest single finding of the satellite
 * fire record is that global burned area *fell* by roughly a quarter between
 * 1998 and 2015 while the climate warmed, and the cause was people: cropland
 * expansion, livestock, roads and settlement cutting the savannas into pieces
 * too small to carry a landscape fire (Andela et al. 2017). A model that omits
 * this gets the sign of the last two decades wrong, and puts the Ganges plain
 * and the North China plain among the world's great fire regions.
 *
 * Used here only through `humanModulation`, as a density, never as a country
 * correction. Countries missing from the table fall back to the world's mean
 * land population density.
 *
 * Exported because the humid-heat layer needs the same table as a headcount:
 * that layer's whole point is how many people live where heat stops being
 * survivable, and a second copy of these numbers would drift out of step with
 * this one the first time either was revised.
 */
export const POPULATION_M: Record<string, number> = {
  AFG: 42, AGO: 36, ALB: 2.8, ARE: 9.5, ARG: 46, ARM: 2.8, AUS: 26, AUT: 9.1,
  AZE: 10, BDI: 13, BEL: 11.7, BEN: 14, BFA: 23, BGD: 173, BGR: 6.5, BIH: 3.2,
  BLR: 9.2, BLZ: 0.4, BOL: 12, BRA: 216, BRN: 0.45, BTN: 0.79, BWA: 2.6,
  CAF: 5.7, CAN: 39, CHE: 8.8, CHL: 19.6, CHN: 1425, CIV: 29, CMR: 28,
  COD: 102, COG: 6.1, COL: 52, CRI: 5.2, CUB: 11, CYP: 1.3, CZE: 10.5,
  DEU: 83, DJI: 1.1, DNK: 5.9, DOM: 11.3, DZA: 45, ECU: 18, EGY: 113,
  ERI: 3.7, ESH: 0.6, ESP: 48, EST: 1.3, ETH: 127, FIN: 5.5, FJI: 0.94,
  FRA: 68, GAB: 2.4, GBR: 68, GEO: 3.7, GHA: 34, GIN: 14, GMB: 2.8,
  GNB: 2.2, GNQ: 1.7, GRC: 10.3, GRL: 0.06, GTM: 18, GUF: 0.3, GUY: 0.81,
  HND: 10.6, HRV: 4, HTI: 11.7, HUN: 9.6, IDN: 278, IND: 1429, IRL: 5.1,
  IRN: 89, IRQ: 45, ISL: 0.38, ISR: 9.2, ITA: 59, JAM: 2.8, JOR: 11.3,
  JPN: 123, KAZ: 20, KEN: 55, KGZ: 6.7, KHM: 17, KOR: 52, KWT: 4.3,
  LAO: 7.6, LBN: 5.4, LBR: 5.4, LBY: 6.9, LKA: 22, LSO: 2.3, LTU: 2.7,
  LVA: 1.8, MAR: 37, MDA: 3.4, MDG: 30, MEX: 128, MKD: 2.1, MLI: 23,
  MMR: 54, MNE: 0.63, MNG: 3.4, MOZ: 33, MRT: 4.9, MWI: 21, MYS: 34,
  NAM: 2.6, NCL: 0.29, NER: 27, NGA: 224, NIC: 7, NLD: 17.6, NOR: 5.5,
  NPL: 31, NZL: 5.2, OMN: 4.6, PAK: 240, PAN: 4.5, PER: 34, PHL: 117,
  PNG: 10.3, POL: 41, PRK: 26, PRT: 10.3, PRY: 6.9, PSE: 5.4, QAT: 2.7,
  ROU: 19, RUS: 144, RWA: 14, SAU: 37, SDN: 48, SEN: 18, SLB: 0.74,
  SLE: 8.8, SLV: 6.4, SOM: 18, SRB: 7.1, SSD: 11, SUR: 0.62, SVK: 5.8,
  SVN: 2.1, SWE: 10.6, SWZ: 1.2, SYR: 23, TCD: 18, TGO: 9.1, THA: 72,
  TJK: 10.1, TKM: 6.5, TLS: 1.4, TTO: 1.5, TUN: 12.5, TUR: 86, TWN: 23,
  TZA: 67, UGA: 49, UKR: 37, URY: 3.4, USA: 340, UZB: 35, VEN: 28,
  VNM: 99, VUT: 0.33, YEM: 34, ZAF: 60, ZMB: 20, ZWE: 16,
}

/** World mean land population density, people/km², for countries not listed. */
const DEFAULT_DENSITY = 55

function populationDensity(feature: CountryFeature): number {
  const iso3 = feature.__risk?.iso3
  const millions = iso3 ? POPULATION_M[iso3] : undefined
  const areaKm2 = feature.__areaKm2 ?? 0
  if (millions === undefined || areaKm2 <= 0) return DEFAULT_DENSITY
  return (millions * 1e6) / areaKm2
}

/* -------------------------------------------------------------------------- */
/* A country is not a point                                                    */
/* -------------------------------------------------------------------------- */

const EARTH_KM2 = 510_072_000
const SR_TO_KM2 = EARTH_KM2 / (4 * Math.PI)
const RAD = Math.PI / 180

/**
 * Area-weighted mean latitude and latitudinal spread of a country.
 *
 * Every other layer in this app evaluates a country at its centroid, which is
 * fine when the quantity is roughly linear across the country and catastrophic
 * when it is not. Burned area is the second case, and by a wide margin: it
 * peaks sharply at intermediate aridity, so a country that straddles the peak
 * has its fires averaged out of existence at its middle. DR Congo is the worst
 * of them — centroid in closed rainforest, and in reality among the two or
 * three largest burned areas on Earth, entirely on the savanna fringes north
 * and south. Cote d'Ivoire and Ghana fail the same way at the Guinea-savanna
 * boundary, and Sudan and Chad at the Sahel one.
 *
 * The fix is to integrate the fire model across the country's own latitude
 * range instead of evaluating it at the middle, because in the tropics the
 * gradient that matters — distance from the rain belt — is almost purely
 * meridional. That needs the *distribution* of a country's land in latitude,
 * not its bounding box: a bounding box would hand France the climate of French
 * Guiana and Norway that of Svalbard, both at full weight.
 *
 * So the mean and variance are integrated over the polygon itself, by the
 * spherical form of Green's theorem: for any f, ∫∫ f(φ) dΩ = ∮ G(φ) dλ where
 * G′(φ) = f(φ) cos φ. Taking f = 1, φ and φ² gives area, first and second
 * moment from one pass over the outline — the same trick d3's `geoArea` uses
 * for the area term alone. Overseas territory then enters weighted by its area,
 * which is what it should be.
 */
interface LatitudeSpread {
  /** Area-weighted mean latitude, degrees. */
  meanLat: number
  /** Area-weighted standard deviation of latitude, degrees. */
  sdLat: number
  /** Latitudes of equal-area strips of the country's land, or null. */
  bandLats: number[] | null
}

// One accumulator, zeroed per country rather than allocated per country. The
// walk is synchronous and its result is read out before the next call starts.
const MOMENT_ACC = { a: 0, m1: 0, m2: 0 }

/**
 * How much of the country's land sits at each latitude, as well as where its
 * middle is and how far it spreads.
 *
 * A mean and a variance describe a blob, and most countries are one. France is
 * not: metropolitan France runs from 42° to 51°N and French Guiana sits on the
 * equator, and a single mean and variance turn that into a smooth smear from
 * 22°N to 58°N. Three of France's seven bands then landed in the subtropics,
 * where the model — correctly — burns a great deal of savanna, and France came
 * out burning 2.8% of itself every year against an observed 0.07%. The United
 * States with Alaska, Chile end to end, and every country with an overseas
 * department fail the same way.
 *
 * The same contour integral that gives the moments gives the whole profile, for
 * one extra addition per vertex. ∫∫ over the part of the polygon below latitude
 * φ is ∮ min(sin φ', sin φ) dλ, whose derivative in sin φ is just the sum of the
 * longitude steps at vertices above it — so bucketing each vertex by its own
 * sine and running one suffix sum afterwards gives area per unit sin φ across
 * the globe. The bands are then the equal-area quantiles of what is actually
 * there, which for a compact country is exactly the uniform spread this used to
 * assume, and for France is one band on the equator and six over Europe.
 */
const LAT_BINS = 180
const SIN_STEP = 2 / LAT_BINS
const LAT_HIST = new Float64Array(LAT_BINS)
const LAT_AREA = new Float64Array(LAT_BINS)

function accumulateRing(ring: Position[]): void {
  for (let i = 1; i < ring.length; i++) {
    const prev = ring[i - 1]
    const cur = ring[i]
    let dLng = cur[0] - prev[0]
    // A step of more than half the globe can only be the antimeridian seam.
    if (dLng > 180) dLng -= 360
    else if (dLng < -180) dLng += 360
    if (dLng === 0) continue
    const p0 = prev[1] * RAD
    const p1 = cur[1] * RAD
    const s0 = Math.sin(p0)
    const c0 = Math.cos(p0)
    const s1 = Math.sin(p1)
    const c1 = Math.cos(p1)
    const d = dLng * RAD * 0.5
    MOMENT_ACC.a += (s0 + s1) * d
    LAT_HIST[binOfSin(s0)] += d
    LAT_HIST[binOfSin(s1)] += d
    MOMENT_ACC.m1 += (p0 * s0 + c0 + (p1 * s1 + c1)) * d
    MOMENT_ACC.m2 +=
      (p0 * p0 * s0 +
        2 * p0 * c0 -
        2 * s0 +
        (p1 * p1 * s1 + 2 * p1 * c1 - 2 * s1)) *
      d
  }
}

/** A compact country's latitudes are near-uniform across it; σ of that. */
function blobSpreadDeg(areaKm2: number): number {
  return Math.sqrt(Math.max(1, areaKm2)) / 111 / Math.sqrt(12)
}

function binOfSin(s: number): number {
  const k = ((s + 1) / SIN_STEP) | 0
  return k < 0 ? 0 : k >= LAT_BINS ? LAT_BINS - 1 : k
}

/**
 * Latitudes of `BANDS` equal-area strips of the country's land, south to north.
 * Reads the histogram the ring walk has just filled, so it is only valid
 * immediately after one. Returns null if the profile came out degenerate.
 */
function bandLatitudes(sign: number, area: number): number[] | null {
  // Area per unit sin φ, from the suffix sum described above. A vertex sitting
  // inside a bin is on average halfway through it.
  let above = 0
  let total = 0
  for (let k = LAT_BINS - 1; k >= 0; k--) {
    const here = LAT_HIST[k]
    const density = sign * (above + 0.5 * here)
    LAT_AREA[k] = density > 0 ? density * SIN_STEP : 0
    total += LAT_AREA[k]
    above += here
  }
  // The profile is the same integral as the area, so it should agree with it;
  // where it does not, the polygon is doing something the walk cannot follow.
  if (!(total > 0) || total < area * 0.8 || total > area * 1.25) return null

  const lats: number[] = []
  let cumulative = 0
  let k = 0
  for (let i = 0; i < BANDS; i++) {
    const target = (total * (i + 0.5)) / BANDS
    while (k < LAT_BINS - 1 && cumulative + LAT_AREA[k] < target) {
      cumulative += LAT_AREA[k]
      k += 1
    }
    const within = LAT_AREA[k] > 0 ? (target - cumulative) / LAT_AREA[k] : 0.5
    const sinLat = -1 + (k + Math.max(0, Math.min(1, within))) * SIN_STEP
    lats.push((Math.asin(Math.max(-1, Math.min(1, sinLat))) / RAD))
  }
  return lats
}

function latitudeSpread(feature: CountryFeature): LatitudeSpread {
  const centroid = countryCentroid(feature)
  const areaKm2 = feature.__areaKm2 ?? 0
  const fallback: LatitudeSpread = {
    meanLat: centroid.lat,
    sdLat: blobSpreadDeg(areaKm2),
    bandLats: null,
  }

  const geometry = feature.geometry
  MOMENT_ACC.a = 0
  MOMENT_ACC.m1 = 0
  MOMENT_ACC.m2 = 0
  LAT_HIST.fill(0)
  if (geometry.type === 'Polygon') {
    for (const ring of geometry.coordinates) accumulateRing(ring)
  } else if (geometry.type === 'MultiPolygon') {
    for (const poly of geometry.coordinates) {
      for (const ring of poly) accumulateRing(ring)
    }
  } else {
    return fallback
  }

  // Ring winding decides the sign of all three moments together, so one flip
  // fixes a whole feature.
  const sign = MOMENT_ACC.a < 0 ? -1 : 1
  const area = sign * MOMENT_ACC.a
  // A ring that encircles a pole misses the polar cap term and comes out wrong
  // by a whole hemisphere — Antarctica is the one case, and it burns nothing.
  // Rather than special-case it, distrust any answer that does not reproduce
  // the country's known area.
  const impliedKm2 = area * SR_TO_KM2
  if (
    !(area > 0) ||
    areaKm2 <= 0 ||
    impliedKm2 < areaKm2 * 0.5 ||
    impliedKm2 > areaKm2 * 2
  ) {
    return fallback
  }

  const meanRad = (sign * MOMENT_ACC.m1) / area
  const varRad = (sign * MOMENT_ACC.m2) / area - meanRad * meanRad
  const sdDeg = Math.sqrt(Math.max(0, varRad)) / RAD
  return {
    meanLat: meanRad / RAD,
    // Still reported, and still the fallback when the profile is unusable:
    // a country in two hemispheres of climate would otherwise be handed a
    // spread wide enough that the bands stop describing anywhere real.
    sdLat: Math.min(12, Math.max(blobSpreadDeg(areaKm2), sdDeg)),
    bandLats: bandLatitudes(sign, area),
  }
}

/**
 * Zonal-mean annual precipitation over land, mm/yr.
 *
 * Read as a *shape*, never as a value. Each country keeps the rainfall the
 * rainfall layer gives it — World Bank observations where they exist — and this
 * profile only says how to distribute that total across the country's latitude
 * bands, renormalised afterwards so the country's own mean is preserved
 * exactly and no water is invented or lost. Without it
 * the bands would differ only in day length and temperature, and Sudan would
 * spread its 250 mm evenly from the Sahara to the South Sudanese border instead
 * of putting almost all of it in the south, where its fires are.
 */
const ZONAL_PRECIP: { lat: number; mm: number }[] = [
  { lat: 90, mm: 150 },
  { lat: 75, mm: 250 },
  { lat: 65, mm: 400 },
  { lat: 55, mm: 560 },
  { lat: 45, mm: 640 },
  { lat: 35, mm: 480 },
  { lat: 25, mm: 330 },
  { lat: 15, mm: 900 },
  { lat: 5, mm: 1850 },
  { lat: 0, mm: 1950 },
  { lat: -5, mm: 1700 },
  { lat: -15, mm: 850 },
  { lat: -25, mm: 430 },
  { lat: -35, mm: 520 },
  { lat: -45, mm: 700 },
  { lat: -55, mm: 620 },
  { lat: -75, mm: 200 },
  { lat: -90, mm: 150 },
]

function zonalPrecipMm(lat: number): number {
  const t = Math.max(-90, Math.min(90, lat))
  for (let i = 0; i < ZONAL_PRECIP.length - 1; i++) {
    const a = ZONAL_PRECIP[i]
    const b = ZONAL_PRECIP[i + 1]
    if (t <= a.lat && t >= b.lat) {
      const u = (a.lat - t) / (a.lat - b.lat)
      return a.mm + u * (b.mm - a.mm)
    }
  }
  return 600
}

/**
 * Tropical rainfall seasonality, from the passage of the rain belt itself.
 *
 * The water-balance layer distributes a country's rain with a single harmonic,
 * which is the right level of detail for a water balance and the wrong shape
 * for fire. A harmonic has a floor: at the strongest seasonality that layer
 * uses, the driest month still receives a fifty-fifth of the year's rain, and
 * in a place taking two metres that is 40 mm falling in the month the model
 * calls its dry season. Nothing cures under 40 mm a month. That single property
 * is why monsoon Asia and the seasonal neotropics came out with fire seasons of
 * three to seven days — Indonesia at 0.5% of its satellite burned area, Myanmar
 * at 0.7%, Colombia at 0.9% — while the observed regime there is a pronounced
 * rainless season curing fuel grown in the wet one.
 *
 * The tropics do not have a sinusoidal year, because their rain does not come
 * from a smoothly varying process. It comes from a belt a few hundred kilometres
 * wide that migrates across them and is either overhead or is not. So the shape
 * is taken from the belt: its latitude swings sinusoidally with the sun, and the
 * rain a place receives falls off with its distance from the belt's core. Three
 * regimes drop out of that one statement rather than being asserted separately:
 *
 *  - On the equator the belt passes twice and retreats to either side, giving
 *    two wet seasons and two dry ones. That is the East African and equatorial
 *    Congo year, and it is why Kenya has a fire season at all — the old flat
 *    year gave it none, and then failed the other way by leaving every month
 *    equally cured, so the "season" ran 342 days.
 *  - Around the belt's own turning latitude the two passages merge into one
 *    long wet season: the Guinea savannas, the Sahel, northern Australia.
 *  - Beyond it the belt only brushes past, leaving the short, violent wet
 *    season and the long rainless one of the semi-arid tropics.
 *
 * It fades out through the subtropics, where the storm track rather than the
 * belt sets the season and the layer's own Mediterranean and monsoon regimes
 * are the better description.
 */
/** How far the rain belt swings either side of the equator, degrees. */
const BELT_SWING_DEG = 13
/** Distance from the belt's core at which its rain has fallen by 1/e, degrees. */
const BELT_HALF_WIDTH_DEG = 8
/** Northernmost belt position, as a fraction of the year. */
const BELT_NORTH_PHASE = 0.553
/** Inside this latitude the belt sets the season by itself. */
const BELT_REGIME_DEG = 20
/** Beyond this the water-balance layer's own regimes take over completely. */
const BELT_FADE_DEG = 28

// Filled per band inside `tropicalRainSeason`, which runs once per band and
// only on the cache-filling pass.
const BELT_SHARE = new Float64Array(12)

function tropicalRainSeason(geo: ClimateGeo): ClimateGeo {
  const absLat = Math.abs(geo.lat)
  if (absLat >= BELT_FADE_DEG) return geo
  const weight = Math.min(
    1,
    (BELT_FADE_DEG - absLat) / (BELT_FADE_DEG - BELT_REGIME_DEG),
  )
  let total = 0
  for (let m = 0; m < 12; m++) {
    const beltLat =
      BELT_SWING_DEG *
      Math.cos(2 * Math.PI * ((m + 0.5) / 12 - BELT_NORTH_PHASE))
    const reach = (geo.lat - beltLat) / BELT_HALF_WIDTH_DEG
    BELT_SHARE[m] = Math.exp(-reach * reach)
    total += BELT_SHARE[m]
  }
  for (let m = 0; m < 12; m++) {
    geo.rainShare[m] =
      (1 - weight) * geo.rainShare[m] + weight * (BELT_SHARE[m] / total)
  }
  return geo
}

/**
 * How many latitude bands a country is split into.
 *
 * Seven is where the answer stops moving: five leaves Ghana and Cote d'Ivoire
 * straddling the boundary between the model's "deep tropics" and "wet and dry"
 * rainfall regimes with nothing either side of it, and eleven changes the
 * global total by under 2% for twice the arithmetic.
 */
const PRECIP_GRADIENT = 1.0

const BANDS = 7

interface FireBand {
  /** Share of the country's area this band carries. Equal by construction. */
  weight: number
  /** Mean-preserving multiplier on the country's annual rainfall. */
  precipScale: number
  geo: ClimateGeo
  /** Today's annual mean temperature at this band's latitude, °C. */
  baseTempC: number
  amplitudeC: number
  /**
   * Share of this band that is peat or ice-rich permafrost, filled in from
   * today's climate on the first pass. A legacy of the climate that banked it
   * rather than of the one that will burn it, so it is not recomputed under a
   * hotter pathway — what warming changes is how much of it thaws.
   */
  organicShare: number
}

interface FireGeo {
  bands: FireBand[]
  continental: number
  areaKm2: number
  meanLat: number
  sdLat: number
  /**
   * Today's fire year, filled in on first use.
   *
   * Every input to it — the band's own climatology, the observed rainfall
   * baseline, the population density — is a property of the country rather than
   * of the pathway, so recomputing it on every timeline commit was doing the
   * band loop twice to get the same answer back.
   */
  baseline: { burnedFraction: number; seasonDays: number } | null
}

// The bands depend only on the polygon, and the moment integral walks every
// vertex of a 50m outline — far too costly to redo for ~240 countries on every
// timeline commit. Same pattern as `shapeCache` in warming.ts.
const fireGeoCache = new WeakMap<CountryFeature, FireGeo>()

function fireGeo(feature: CountryFeature): FireGeo {
  const cached = fireGeoCache.get(feature)
  if (cached) return cached

  const { lng } = countryCentroid(feature)
  const continental = continentality(feature)
  const { meanLat, sdLat, bandLats } = latitudeSpread(feature)

  // The equal-area strips of the country's own land where the outline gives
  // them, and where it does not, a uniform distribution matched to the mean and
  // variance instead. Uniform rather than normal because a country is a blob
  // rather than a bell: the tails of a normal would put weight at latitudes the
  // country does not reach, and the shoulders are exactly where the savanna
  // fringes are. For a compact country the two agree.
  const halfWidth = Math.sqrt(3) * sdLat
  const step = (2 * halfWidth) / BANDS
  const lats: number[] = []
  for (let i = 0; i < BANDS; i++) {
    lats.push(
      Math.max(
        -89,
        Math.min(89, bandLats?.[i] ?? meanLat - halfWidth + step * (i + 0.5)),
      ),
    )
  }

  let shapeMean = 0
  for (const lat of lats) shapeMean += zonalPrecipMm(lat)
  shapeMean /= BANDS

  // Damped and clamped before normalising. The zonal profile falls by a factor
  // of six across the margin of the rain belt, which is the real structure of
  // Africa and Australia and the wrong sign for the eastern seaboards, where
  // the monsoon puts the rain exactly where the zonal mean says the deserts
  // are. Two thirds of the gradient keeps most of the Sahel and the Congo fix
  // without handing southern Brazil and southern China a drought they do not
  // have.
  const rawScales = lats.map((lat) =>
    Math.max(
      0.35,
      Math.min(3, (zonalPrecipMm(lat) / Math.max(1, shapeMean)) ** PRECIP_GRADIENT),
    ),
  )
  // Renormalised so the bands still add back up to the rainfall the country was
  // measured to have. This layer decides where a country's water falls, never
  // how much of it there is.
  let scaleMean = 0
  for (const scale of rawScales) scaleMean += scale
  scaleMean /= BANDS

  const bands: FireBand[] = lats.map((lat, i) => ({
    weight: 1 / BANDS,
    precipScale: rawScales[i] / scaleMean,
    geo: tropicalRainSeason(climateGeoAt(lat, lng, continental)),
    baseTempC: annualMeanTempC(lat, continental),
    amplitudeC: seasonalAmplitudeC(lat, continental),
    organicShare: 0,
  }))

  const geo: FireGeo = {
    bands,
    continental,
    areaKm2: feature.__areaKm2 ?? 0,
    meanLat,
    sdLat,
    baseline: null,
  }
  fireGeoCache.set(feature, geo)
  return geo
}

/* -------------------------------------------------------------------------- */
/* Fire weather                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Saturation vapour pressure in kPa (Tetens). This is the Clausius–Clapeyron
 * curve in the form the agronomy and fire literature uses, and the reason a
 * degree of warming buys more drying power in a hot place than a cold one.
 */
function saturationVapourPressureKPa(tempC: number): number {
  return 0.6108 * Math.exp((17.27 * tempC) / (tempC + 237.3))
}

/**
 * Vapour pressure deficit on a fire-weather day, kPa.
 *
 * Humidity used to be guessed from annual rainfall alone, which had one fatal
 * property for a climate model: it could not respond to warming at all. The
 * water-balance layer replaced it with the evaporative fraction — how much of
 * the atmosphere's demand the surface can actually meet — so VPD now climbs
 * from both ends: warmer air holds more, and drier ground gives it less.
 *
 * That fixed the wrong half of the problem on its own. A *mean* humidity is the
 * wrong statistic for fire in the first place: burned area is dominated by a
 * handful of days, and in the boreal those days are blocking highs, when
 * subsiding air and a fortnight without rain take the fine fuels far below
 * anything a monthly mean can express. Read on the mean day, Russia and Canada
 * landed alongside maritime Ireland and Japan, which have next to no burned
 * area between them.
 *
 * So the deficit is evaluated on the fire day rather than the mean day, in the
 * form the fire literature uses. Vapour pressure, not relative humidity, is
 * what the air actually carries: it is set upwind and by evaporation and moves
 * over days, while temperature swings within the day. Holding it fixed at its
 * seasonal value and re-evaluating saturation warmer is what makes the step
 * discriminate — it costs a maritime climate little, because its air is wet to
 * begin with, and costs a continental one a great deal.
 *
 * Two steps from the mean day to the fire day. The afternoon peak is half the
 * diurnal range, which the water-balance layer already estimates. The hot spell
 * on top of it scales with the seasonal amplitude, because both measure the
 * same thing — how far a climate sits from an ocean's thermal buffer, which is
 * also what sets its day-to-day synoptic swing. A sixth of the amplitude is
 * roughly half a standard deviation of summer variability: deliberately modest,
 * since there is no weather in this model and the point of the term is the
 * contrast between climates, not the size of any one heatwave.
 */
function fireDayVpdKPa(
  seasonTempC: number,
  seasonHumidity: number,
  diurnalRangeC: number,
  amplitudeC: number,
): number {
  const ea = seasonHumidity * saturationVapourPressureKPa(seasonTempC)
  const fireDayC = seasonTempC + 0.5 * diurnalRangeC + 0.16 * amplitudeC
  return Math.max(0, saturationVapourPressureKPa(fireDayC) - ea)
}

/**
 * How much there is to burn, 0–1, from the water balance.
 *
 * Rainfall cannot answer this. Five hundred millimetres carries closed conifer
 * forest across Siberia and open thorn scrub across the Sahel, and what
 * separates them is evaporative demand, not rain — so the term reads the
 * aridity index P/PET on the same UNEP boundaries the drylands are defined by:
 * nothing below hyper-arid, saturating at the humid threshold, which is roughly
 * where a closed canopy becomes possible.
 *
 * Without a term of this kind at all the model would rank the Sahara and the
 * Arabian peninsula as the most fire-prone land on the planet, which is the
 * classic failure of a fire-weather index used as a fire-activity index.
 */
export function fuelAvailability(aridityIndex: number): number {
  if (aridityIndex <= 0.05) return 0
  if (aridityIndex >= 0.65) return 1
  return ((aridityIndex - 0.05) / 0.6) ** 0.55
}

/**
 * Damping for land that never dries out.
 *
 * Rainforest carries enormous fuel and rarely burns, and so does maritime
 * temperate country — Ireland, Japan, New Zealand, coastal Norway. The old test
 * was an annual rainfall total above 1,800 mm, which sees the first and misses
 * the second entirely, because 1,200 mm spread evenly through the year is a
 * different climate from 1,200 mm with a dry season and only the second one
 * burns. The water balance can tell them apart: what matters is whether the
 * land still meets the atmosphere's demand in its own driest quarter, because
 * where it does the fine fuels never reach the moisture of extinction.
 */
function perpetuallyWetDamping(
  dryQuarterEvaporativeFraction: number,
  dryingFrac: number,
): number {
  const wetness = Math.max(
    0,
    Math.min(1, (dryQuarterEvaporativeFraction - 0.72) / 0.28),
  )
  // Drying pushes it back toward flammable — this is the Amazon dieback path.
  const drought = Math.max(0, -dryingFrac) * 4
  return Math.max(0.25, 1 - wetness * 0.7 * Math.max(0, 1 - drought))
}

/**
 * Fraction of the year warm enough to carry fire.
 *
 * Treats the annual cycle as a sinusoid about the mean and asks how much of it
 * sits above a threshold — so a short, hot boreal summer is short but real,
 * while a permanently frozen climate returns zero. This feeds the index only;
 * the season length the panel reports is counted from the water balance month
 * by month, which is a stricter and more honest question.
 */
function fireSeasonFraction(meanTempC: number, amplitudeC: number): number {
  const THRESHOLD_C = 5
  if (amplitudeC <= 0.01) return meanTempC > THRESHOLD_C ? 1 : 0
  const x = Math.max(-1, Math.min(1, (THRESHOLD_C - meanTempC) / amplitudeC))
  return Math.acos(x) / Math.PI
}

/* -------------------------------------------------------------------------- */
/* Fuel, curing and the two fire regimes                                       */
/* -------------------------------------------------------------------------- */

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)

/**
 * Growth limited by warmth, 0–1 — the Miami model's temperature term.
 *
 * Water is not the only thing a plant needs, and reading fuel from the water
 * balance alone claims that a Kazakh steppe and a Sahelian savanna with the
 * same 280 mm grow the same fuel. They do not, by something like a factor of
 * four: the Sahel gets its rain hot, in a 12-month growing climate, and the
 * steppe gets it in a short cool spring either side of a frozen winter. That
 * one distinction is most of why the tropical savannas dominate global burned
 * area and the temperate grasslands, at identical rainfall, do not.
 *
 * The curve is Lieth's Miami model (1975), the standard first-order global
 * productivity relation, in its temperature half and normalised to its own
 * ceiling. Multiplied by the water term rather than taking the minimum of the
 * two as Miami does: for fire what matters is the fine fuel actually standing
 * at the end of the growing season, and both shortages bite at once.
 */
function warmthLimitedGrowth(meanTempC: number): number {
  return 1 / (1 + Math.exp(1.315 - 0.119 * meanTempC))
}

/**
 * Share of the fuel that is grass rather than wood, 0–1.
 *
 * The two regimes differ by more than an order of magnitude in how much of the
 * landscape burns in a year, so this is the most consequential single number in
 * the burned-area model.
 *
 * Two things have to be true for a closed woody canopy, and reading only the
 * first is what makes a fire model call West Africa a rainforest. The first is
 * water over the year: tree cover in the seasonal tropics is water-limited below
 * roughly 650 mm of rain and only closes well above it (Sankaran et al. 2005),
 * which in water-balance terms is an aridity index climbing through about 0.55
 * to 1.3. The second is that the year must not contain a dry season severe
 * enough to stop it — and above the water threshold that, not rainfall, is what
 * decides. Guinea and the Congo basin both take about 1,700 mm; Guinea spends
 * six months of it with no rain at all and is savanna woodland, the Congo does
 * not and is closed forest. An annual index cannot tell them apart, and gave
 * Guinea, Cote d'Ivoire, Cameroon and southern DR Congo a rainforest's fuel and
 * a rainforest's near-zero burned area.
 *
 * A dry season has to be both deep and long to hold a canopy open, and reading
 * only its depth is what put the western Amazon and the inner Congo basin in
 * the same class as the Guinea savannas. Amazonia takes 2,300 mm with two or
 * three months of shortfall and is closed forest; Guinea takes 1,700 mm with
 * five or six and is savanna woodland. The depth of the driest quarter is the
 * same in both. Four dry months is roughly where the tropical seasonal forests
 * give way to the woodlands on the ground, and it is the length that carries
 * that boundary.
 *
 * The desert end is handled separately: the fuel bed has already gone to zero
 * there, so the Sahara being "all grass" costs nothing.
 */
/** Rain in a month under which the dry season has begun, mm, and over which it
 * has not. */
const DRY_MONTH_MM = 100
const WET_MONTH_MM = 25

/** Months of drought a canopy absorbs, and the span over which it opens. */
const CANOPY_DRY_MONTHS = 4
const CANOPY_DRY_SPAN = 4

function grassShare(
  aridityIndex: number,
  dryQuarterEvaporativeFraction: number,
  dryMonths: number,
): number {
  const waterForCanopy = clamp01((aridityIndex - 0.55) / 0.75)
  // How far the driest quarter is from meeting demand: 0 where the land never
  // runs short, 1 where it is bone dry for a season.
  const seasonalityOpensIt =
    clamp01((0.75 - dryQuarterEvaporativeFraction) / 0.5) *
    clamp01((dryMonths - CANOPY_DRY_MONTHS) / CANOPY_DRY_SPAN)
  return clamp01(1 - waterForCanopy * (1 - seasonalityOpensIt))
}

/**
 * Share of the ground that is peat or ice-rich permafrost, 0–1.
 *
 * Read off today's climate rather than the projected one, because peat is a
 * legacy: it took the whole Holocene to bank and does not relocate because the
 * century is warmer. What warming changes is not where it is but how much of it
 * thaws and burns.
 *
 * Organic soil accumulates wherever decomposition is slower than production —
 * cold, and wet enough that the ground stays waterlogged. That is the West
 * Siberian Lowland, the Hudson Bay Lowlands, Fennoscandia and the Alaskan
 * interior, and it is why boreal fire is not simply a smaller version of
 * savanna fire: the flame front is only the visible part, and what carries the
 * carbon is smouldering combustion working down into ground that has been
 * banking it since the ice left.
 */
function organicSoilShare(meanTempC: number, aridityIndex: number): number {
  const cold = clamp01((5 - meanTempC) / 12)
  const wet = clamp01((aridityIndex - 0.45) / 0.35)
  return 0.8 * cold * wet
}

/**
 * Ignition and suppression, folded into one multiplier on burned area.
 *
 * Fire weather is not fire. Somebody has to light it, and somebody may fight
 * it, and both of those vary far more between landscapes than the weather does.
 *
 * Ignition is close to unlimited in grassy systems: deliberate dry-season
 * burning for pasture, hunting, land clearing and firebreaks is the single
 * largest ignition source on the planet, and it is overwhelmingly a savanna
 * practice. In closed forest ignition is sparser — lightning plus escaped
 * agricultural fire — which is one reason a boreal forest with excellent fire
 * weather still burns a small fraction of a savanna's area.
 *
 * Suppression is the mirror image. A crown fire in forest is a discrete,
 * high-intensity, expensive event near things people care about, so it is
 * fought, and initial attack succeeds on the large majority of starts. A
 * savanna fire is low-intensity, ubiquitous, often deliberate, and goes out at
 * the next rain: nobody fights it and nothing would be gained if they did. But
 * suppression capacity is finite and saturates — the seasons that produce the
 * burned area are exactly the ones that overrun it, which is why a lengthening
 * fire season raises burned area faster than the weather alone implies.
 *
 * And the largest human effect of all is neither: it is that a landscape cut
 * into fields, roads, grazing paddocks and villages cannot carry a fire across
 * itself, and its grass is eaten before it can cure. That fragmentation is what
 * drove global burned area *down* by roughly a quarter between 1998 and 2015
 * while the climate warmed (Andela et al. 2017), and without it a fire model
 * ranks the North China plain and the Ganges valley among the great fire
 * regions of the world. Population density is the available handle on it, and
 * the response is the observed one: fire rises slightly where the first people
 * arrive to light it, and falls hard and non-linearly above roughly twenty
 * people per square kilometre.
 *
 * The last piece is that grass fire is not one institution. In a frost-free
 * landscape it is a tool: dry-season burning for pasture and clearing is
 * deliberate, annual, and nobody fights it. In a settled temperate countryside
 * it is a hazard — a field fire is reported and attended within the hour, the
 * ground between the fields is ploughed rather than grazed, and the stubble
 * burning that used to carry fire across it has been banned for a generation.
 * A model that suppresses forest fire and not grass fire has no way to say that,
 * and it showed: France came out burning 2.8% of itself every year against an
 * observed 0.07%, Turkey twenty times its record and Germany eleven. So the
 * suppression that applied to forest extends to grass in proportion to how far
 * a landscape is from the tropics and how densely it is settled.
 *
 * The honest limit is unchanged: density is not wealth, and neither is latitude.
 * Between two countries at the same density and the same distance from the
 * equator this term cannot tell the one that can afford aerial suppression and
 * mechanised agriculture from the one that cannot.
 */
/** People per km² over which a landscape counts as fully settled. */
const SETTLED_DENSITY = 100
/** How much of a fire a fully settled, fully temperate landscape stops. */
const MECHANISED_SUPPRESSION = 0.85

function humanModulation(
  grass: number,
  seasonDays: number,
  densityPerKm2: number,
  /** 0 where the year has a frost, 1 where it never does. */
  tropical: number,
): number {
  const ignition = 0.4 + 0.6 * grass
  const capacity = clamp01(1 - seasonDays / 200)
  const suppression = 0.75 * (1 - grass) * capacity
  const fragmentation = 0.25 + 0.75 / (1 + (Math.max(0, densityPerKm2) / 120) ** 1.5)
  // Where almost nobody lives, ignitions rather than fuel are the limit.
  const ignitionSupply = 0.55 + 0.45 * clamp01(densityPerKm2 / 4)
  const worked = (1 - tropical) * clamp01(densityPerKm2 / SETTLED_DENSITY)
  return (
    ignition *
    (1 - suppression) *
    fragmentation *
    ignitionSupply *
    (1 - MECHANISED_SUPPRESSION * worked)
  )
}

/**
 * The global constant, and the only fitted number in the burned-area model.
 *
 * Set so the modelled global total lands on the observed 3–4 million km²/yr and
 * Africa's share of it on the observed 60–70%. Everything else in the chain is
 * either physics or a shape taken from the ecology literature; this converts
 * the product of those into an area.
 */
const BURNED_AREA_SCALE = 1.15

/**
 * Annual burned fraction a fully cured grassland can reach, on either side of
 * the frost line.
 *
 * This is the largest single number in the model and the one that decides where
 * global burned area is. The observed fire world is not "grassland burns a lot":
 * it is that *tropical* savanna burns a lot and temperate grassland does not, by
 * something like a factor of ten. The Zambian miombo and the Texas high plains
 * have similar rainfall, similar aridity and similar fire weather, and burn
 * roughly twenty per cent and half a per cent of themselves per year.
 *
 * The boundary is frost. A frost-free growing season carries C4 tall grasses
 * that reach two or three metres and put four to eight tonnes a hectare of fine
 * fuel on the ground every single year, which cures completely in the dry season
 * and carries fast, wide, low-intensity fire that people light deliberately for
 * pasture. A temperate grassland grows a fifth of that, in shorter turf, on a
 * landscape that has been ploughed, fenced, grazed and fire-suppressed for a
 * century. Modelling the two on one curve is what puts the North China plain
 * and the Argentine pampas among the world's great fire regions.
 */
const TROPICAL_GRASS_CEILING = 0.66
const TEMPERATE_GRASS_CEILING = 0.06
/** Coldest monthly mean, °C, over which grass counts as fully tropical. */
const FULLY_TROPICAL_C = 23
/** And under which it counts as fully temperate. */
const FULLY_TEMPERATE_C = 12
/** The same for closed forest, where the fire-return interval is decades. */
const FOREST_CEILING = 0.055
/**
 * Fire-season length at which burned fraction has reached ~63% of its ceiling.
 * A season cannot burn the same hectare twice, so the response saturates.
 */
const SEASON_TAU_DAYS = 130

/**
 * What a month leaves of last month's standing fine fuel.
 *
 * Grass litter does not wait indefinitely for a match: it is grazed, it is
 * trampled, termites take it, and it rots. About a seven-month e-folding time,
 * which is what turns "this place has a dry season" into "this place has a fire
 * season" — the Sahel grows its entire year's fuel in three months and has
 * little of it left by the following June, so its fire season ends even though
 * its fire *weather* never does.
 */
const FUEL_RETENTION = 0.87

/**
 * Monthly actual evapotranspiration, mm, over which a grass sward counts as
 * fully green, and the depth under which it counts as fully senesced.
 *
 * The same water that grows the fuel is what tells the model the fuel is
 * growing, so the two readings cannot disagree. The floor is roughly a
 * millimetre a day of real evapotranspiration — the point below which a sward
 * has stopped putting on new leaf and is standing dead.
 */
const GREEN_UP_FLOOR_MM = 35
const GREEN_UP_SPAN_MM = 45

/** Standing fuel below which the bed is too patchy to carry fire, mm of AET. */
const FUEL_FLOOR_MM = 55
/** Standing fuel at which the bed is continuous enough to carry a front. */
const FUEL_CONNECTED_MM = 175
/** Standing fuel at which the bed is as heavy as a fine-fuel bed gets. */
const FUEL_FULL_MM = 650
/**
 * Burned fraction rises faster than linearly with how much fuel is standing.
 *
 * A hectare cannot burn twice in a year, so a long season cannot make up for a
 * thin fuel bed — and multiplying the two, which is what a linear load term
 * does, let the Australian interior and the Sahel borrow the Zambian miombo's
 * burned fraction on the strength of having a longer dry season than it. What
 * actually limits an arid savanna is that there is only so much grass.
 */
const FUEL_LOAD_EXPONENT = 1.2

interface BandFire {
  burnedFraction: number
  seasonDays: number
  /** Peak fire-day vapour pressure deficit across the year, kPa. */
  peakVpdKPa: number
  /* The rest is diagnostic only — what the model believed on the way there. */
  aridity: number
  grass: number
  warmth: number
  load: number
  human: number
  dryMonths: number
}

// One scratch trace, reused across every band and every country. The band loop
// is synchronous and reads each trace before the next call overwrites it, and
// this runs once per band per country on every timeline commit — the one place
// in the app where a fresh Float64Array per call would show up.
const TRACE: MonthlyTrace = {
  tempC: new Float64Array(12),
  aetMm: new Float64Array(12),
  evaporativeFraction: new Float64Array(12),
  snowPackMm: new Float64Array(12),
}

const STANDING_FUEL_MM = new Float64Array(12)

const BAND_RESULT: BandFire = {
  burnedFraction: 0,
  seasonDays: 0,
  peakVpdKPa: 0,
  aridity: 0,
  grass: 0,
  warmth: 0,
  load: 0,
  human: 0,
  dryMonths: 0,
}

/**
 * One latitude band's fire year. Writes into `BAND_RESULT` rather than
 * returning a fresh object, for the reason above.
 */
function bandFire(
  band: FireBand,
  meanTempC: number,
  annualPrecipMm: number,
  continental: number,
  warmingSince2020C: number,
  carbonFeedback: number,
  densityPerKm2: number,
  /** Peat and permafrost share, measured on today's climate by the caller. */
  organicShare: number,
): BandFire {
  const dtr = dailyTempRangeC(annualPrecipMm, continental)
  const balance = monthlyBalance(
    band.geo,
    meanTempC,
    annualPrecipMm,
    dtr,
    TRACE,
  )
  const aridity = annualPrecipMm / Math.max(25, balance.petMm)
  // How many months of the year the rain effectively stops. Read off the rain
  // itself rather than off the water balance, because this is a question about
  // the climate a vegetation type grew up in rather than about one year's
  // demand: the hundred-millimetre month is the threshold the tropical
  // dry-forest literature has used for a century, and unlike an evaporative
  // one it does not move when the air above it is a few degrees cooler.
  let dryMonths = 0
  for (let m = 0; m < 12; m++) {
    const rainMm = annualPrecipMm * band.geo.rainShare[m]
    dryMonths += clamp01((DRY_MONTH_MM - rainMm) / (DRY_MONTH_MM - WET_MONTH_MM))
  }
  const grass = grassShare(
    aridity,
    balance.dryQuarterEvaporativeFraction,
    dryMonths,
  )
  const warmth = warmthLimitedGrowth(meanTempC)

  // Where the coldest month sits decides which grassland this is. A ramp rather
  // than a hard line, because the transition on the ground is a gradient across
  // the subtropics rather than a border; it crosses its own midpoint at about
  // 17.5 °C, which is where Köppen puts the boundary of the tropics.
  let coldestMonthC = Infinity
  for (let m = 0; m < 12; m++) {
    if (TRACE.tempC[m] < coldestMonthC) coldestMonthC = TRACE.tempC[m]
  }
  const tropical = clamp01(
    (coldestMonthC - FULLY_TEMPERATE_C) /
      (FULLY_TROPICAL_C - FULLY_TEMPERATE_C),
  )

  // Standing fine fuel, month by month. This is the mechanism the spec of the
  // problem demands and an annual total cannot express: the wet season grows
  // the fuel and the dry season burns it, so the two have to be resolved
  // separately and in order. Growth is that month's actual evapotranspiration —
  // a plant cannot fix carbon without losing water through the same stomata,
  // which is why AET has been the standard first-order predictor of primary
  // production since Rosenzweig (1968). Two passes so the fuel bed enters
  // January carrying what December left rather than an arbitrary guess.
  let standing = 0
  for (let pass = 0; pass < 2; pass++) {
    for (let m = 0; m < 12; m++) {
      standing = standing * FUEL_RETENTION + TRACE.aetMm[m]
      if (pass === 1) STANDING_FUEL_MM[m] = standing
    }
  }

  // Count the season month by month. Weighted rather than a hard threshold on
  // each month, because a threshold makes the answer jump by thirty days when a
  // country warms by a tenth of a degree, and the real transition is gradual:
  // the share of days in a month that carry fire rises smoothly as the fuel
  // cures and the air dries.
  let seasonDays = 0
  let peakVpd = 0
  let fuelWhenBurning = 0
  for (let m = 0; m < 12; m++) {
    const tempC = TRACE.tempC[m]
    const ef = TRACE.evaporativeFraction[m]
    const vpd = fireDayVpdKPa(
      tempC,
      surfaceHumidity(ef),
      dtr,
      band.amplitudeC,
    )
    if (vpd > peakVpd) peakVpd = vpd
    // Grass has to senesce before it will burn, and a green sward will not
    // carry fire however hot the day is — so the grass gate is strict and keyed
    // on the monthly water balance. Forest fine fuels are litter and duff:
    // dead already, and dried by the weather within days rather than by the
    // season. Giving them one shared curve is what used to leave the boreal
    // ranked below maritime Europe.
    //
    // The evaporative fraction cannot carry that gate on its own in a semi-arid
    // climate, because there the atmosphere's demand is so far beyond anything
    // the land can supply that even the month the year's whole fuel crop is
    // grown reads as a dry one. Left at that, Eritrea and Kenya came out with
    // fire seasons of 353 and 342 days — a season that is not a season. So the
    // month's own growth closes the gate as well: a sward greens within days of
    // rain, and the months that grow the fuel are not the months that burn it.
    //
    // Only where the year is frost-free, because that is where this year's crop
    // is the fuel. Past the frost line the growing season and the fire season
    // are the same short summer, and what carries the spring fires of the
    // steppe and the boreal is last year's grass standing dead under this
    // year's — so a growth gate there would erase Russia and Canada instead.
    const growing = clamp01(
      (TRACE.aetMm[m] - GREEN_UP_FLOOR_MM) / GREEN_UP_SPAN_MM,
    )
    const curedGrass =
      clamp01((0.85 - ef) / 0.45) * (1 - tropical * growing)
    const curedForest = clamp01((1.02 - ef) / 0.8)
    const cured = grass * curedGrass + (1 - grass) * curedForest
    const drying = clamp01((vpd - 0.9) / 1.9)
    // Lying snow ends the argument.
    const snowFree = clamp01(1 - TRACE.snowPackMm[m] / 12)
    // Fire spreads through a fuel bed or it stops. Below the floor the grass
    // bed is too patchy to carry a front, which is why the Sahara has perfect
    // fire weather every day of the year and no fire season at all, and why the
    // Sahel's ends in spring although its fire weather does not. Woody fuel is
    // exempt: a forest floor carries litter and duff whatever this year did.
    const grassCarries = clamp01(
      (STANDING_FUEL_MM[m] - FUEL_FLOOR_MM) / (FUEL_CONNECTED_MM - FUEL_FLOOR_MM),
    )
    const carries = grass * grassCarries + (1 - grass)
    const days = MONTH_DAYS[m] * cured * drying * snowFree * carries
    seasonDays += days
    fuelWhenBurning += days * STANDING_FUEL_MM[m]
  }
  // How much fuel is standing when the country is actually flammable, rather
  // than at the peak or in the annual mean. Continuity — whether the bed joins
  // up at all — and load — how much of it there is — are different questions
  // and the observed burned fraction needs both: the Sahel's bed connects and
  // still carries a fifth of the fuel a miombo woodland does, and burns roughly
  // a third as much of itself per year.
  const meanFuelMm = seasonDays > 0.5 ? fuelWhenBurning / seasonDays : 0
  const fuelLoad = clamp01(
    (meanFuelMm - FUEL_FLOOR_MM) / (FUEL_FULL_MM - FUEL_FLOOR_MM),
  )

  const grassCeiling =
    TROPICAL_GRASS_CEILING * tropical + TEMPERATE_GRASS_CEILING * (1 - tropical)
  const ceiling = grassCeiling * grass + FOREST_CEILING * (1 - grass)
  // Thaw is what makes the legacy carbon burnable: the seasonally thawed layer
  // deepens, drained peat and moss dry out, and fire works down into ground
  // that has not burned since the ice left. Warming alone does some of this;
  // a pathway whose carbon sinks are failing is a pathway where permafrost
  // carbon is already the reason they are failing, so it does considerably
  // more.
  const thaw =
    1 +
    organicShare *
      (0.3 * clamp01(warmingSince2020C / 4) + 0.9 * clamp01(carbonFeedback))

  const human = humanModulation(grass, seasonDays, densityPerKm2, tropical)
  BAND_RESULT.burnedFraction = Math.min(
    0.9,
    BURNED_AREA_SCALE *
      ceiling *
      warmth *
      fuelLoad ** FUEL_LOAD_EXPONENT *
      (1 - Math.exp(-seasonDays / SEASON_TAU_DAYS)) *
      human *
      thaw,
  )
  BAND_RESULT.aridity = aridity
  BAND_RESULT.grass = grass
  BAND_RESULT.warmth = warmth
  BAND_RESULT.load = fuelLoad
  BAND_RESULT.human = human
  BAND_RESULT.dryMonths = dryMonths
  BAND_RESULT.seasonDays = seasonDays
  BAND_RESULT.peakVpdKPa = peakVpd
  return BAND_RESULT
}

/* -------------------------------------------------------------------------- */
/* Public model                                                                */
/* -------------------------------------------------------------------------- */

export interface FireRisk {
  /** Composite fire-weather index, 0–100. */
  index: number
  /** Index under today's climate, for comparison. */
  baselineIndex: number
  /** Change in index points. */
  deltaIndex: number
  /** Relative change, e.g. 0.4 = 40% more fire weather. */
  deltaFrac: number
  /** Vapour pressure deficit, kPa — the atmosphere's drying power. */
  vpdKPa: number
  /** True where there is too little vegetation to carry fire. */
  fuelLimited: boolean
  /** Share of the year warm enough to burn. */
  seasonFraction: number
  band: 'minimal' | 'low' | 'moderate' | 'high' | 'extreme'
  /** Modelled burned area, km²/yr — today's climate and this pathway's. */
  baselineBurnedKm2: number
  burnedKm2: number
  /** Burned area as a share of the country's land area, per year. */
  burnedFraction: number
  /**
   * The part of the burned area sitting on peat or ice-rich permafrost, km²/yr.
   * Fire there releases carbon banked over millennia rather than carbon the
   * next growing season takes back, which is why the Earth-system pathways
   * reshape it.
   */
  peatBurnedKm2: number
  /** Days per year on which the fuel is cured and the air dry enough to burn. */
  baselineSeasonDays: number
  seasonDays: number
  /** The satellite record for this country, km²/yr, where it has one. */
  observedBurnedKm2: number | null
}

function bandFor(index: number): FireRisk['band'] {
  if (index < 8) return 'minimal'
  if (index < 22) return 'low'
  if (index < 42) return 'moderate'
  if (index < 62) return 'high'
  return 'extreme'
}

interface FireInputs {
  meanTempC: number
  amplitudeC: number
  continental: number
  annualPrecipMm: number
  aridityIndex: number
  drySeasonHumidity: number
  dryQuarterEvaporativeFraction: number
  /** Polar ground: no tree line, and on the ice sheets no ground either. */
  frozenGround: boolean
  dryingFrac: number
}

function indexAt(
  input: FireInputs,
): { index: number; vpd: number; fuel: number; seasonFrac: number } {
  const { meanTempC, amplitudeC } = input
  // VPD is evaluated at the height of the warm season, not at the annual mean —
  // that is when fuel dries and fires run.
  const seasonTempC = meanTempC + amplitudeC
  const vpd = fireDayVpdKPa(
    seasonTempC,
    input.drySeasonHumidity,
    dailyTempRangeC(input.annualPrecipMm, input.continental),
    amplitudeC,
  )
  const fuel = input.frozenGround ? 0 : fuelAvailability(input.aridityIndex)
  const seasonFrac = fireSeasonFraction(meanTempC, amplitudeC)
  // Around 3.4 kPa is where fire danger becomes serious on this scale;
  // normalise there and let it keep climbing rather than clipping, since the
  // tail is the point. The yardstick has moved twice, and both times only
  // because the thing being measured changed scale: 1.5 while humidity was a
  // rainfall proxy, 1.7 once it came from the country's own dry season, and now
  // roughly double that because the deficit is read on a fire day rather than
  // an average one. None of those moves changes any country's rank on its own.
  const drynessDrive = Math.min(2.2, vpd / 3.4)
  // Square-rooted: a three-month boreal season is short but ferocious, and
  // scaling linearly on season length erased it.
  const raw =
    48 *
    drynessDrive *
    fuel *
    Math.sqrt(seasonFrac) *
    perpetuallyWetDamping(
      input.dryQuarterEvaporativeFraction,
      input.dryingFrac,
    )
  return { index: Math.max(0, Math.min(100, raw)), vpd, fuel, seasonFrac }
}

/**
 * Diagnostics for one country's latitude bands. Not used by the app; exported
 * so the calibration script can see what the model believes about a country
 * rather than only what it concludes.
 */
export function fireBandDiagnostics(
  feature: CountryFeature,
  globalWarmingC: number,
  physics: ScenarioPhysics = NEUTRAL_PHYSICS,
  baselineGlobalC = 1.15,
) {
  // Warms the per-band caches, which is where the peat shares are filled in.
  estimateCountryFire(feature, globalWarmingC, physics, baselineGlobalC)
  const temp = estimateCountryTemp(feature, globalWarmingC, physics, baselineGlobalC)
  const rain = estimateCountryRain(feature, globalWarmingC, physics, baselineGlobalC)
  const geo = fireGeo(feature)
  const density = populationDensity(feature)
  const continental = continentality(feature)
  return {
    density,
    continental,
    meanLat: geo.meanLat,
    sdLat: geo.sdLat,
    areaKm2: geo.areaKm2,
    precipMm: rain.futureMm,
    bands: geo.bands.map((band) => {
      const r = bandFire(
        band,
        band.baseTempC + temp.deltaSince2020C,
        rain.futureMm * band.precipScale,
        continental,
        temp.deltaSince2020C,
        physics.carbonFeedback,
        density,
        band.organicShare,
      )
      return {
        lat: band.geo.lat,
        precip: rain.futureMm * band.precipScale,
        tempC: band.baseTempC + temp.deltaSince2020C,
        burnedFraction: r.burnedFraction,
        seasonDays: r.seasonDays,
        aridity: r.aridity,
        grass: r.grass,
        warmth: r.warmth,
        load: r.load,
        human: r.human,
        dryMonths: r.dryMonths,
      }
    }),
  }
}

export function estimateCountryFire(
  feature: CountryFeature,
  globalWarmingC: number,
  physics: ScenarioPhysics = NEUTRAL_PHYSICS,
  baselineGlobalC = 1.15,
): FireRisk {
  const { lat } = countryCentroid(feature)
  const continental = continentality(feature)

  const temp = estimateCountryTemp(feature, globalWarmingC, physics, baselineGlobalC)
  const rain = estimateCountryRain(feature, globalWarmingC, physics, baselineGlobalC)
  // The same temperature and rainfall the water balance would compute for
  // itself, handed over rather than recomputed — this runs for every country on
  // every timeline commit.
  const water = droughtFromClimate(feature, temp, rain)

  // Today's absolute mean, and the future one with this pathway's local warming
  // laid on top of it.
  const baseTempC = annualMeanTempC(lat, continental)
  const futureTempC = baseTempC + temp.deltaSince2020C
  const amplitudeC = seasonalAmplitudeC(lat, continental)

  const now = indexAt({
    meanTempC: baseTempC,
    amplitudeC,
    continental,
    annualPrecipMm: rain.baselineMm,
    aridityIndex: water.baselineAridity,
    drySeasonHumidity: water.baselineDrySeasonHumidity,
    dryQuarterEvaporativeFraction:
      water.baselineDryQuarterEvaporativeFraction,
    frozenGround: water.frozenGround,
    dryingFrac: 0,
  })
  const future = indexAt({
    meanTempC: futureTempC,
    amplitudeC,
    continental,
    annualPrecipMm: rain.futureMm,
    aridityIndex: water.aridity,
    drySeasonHumidity: water.drySeasonHumidity,
    dryQuarterEvaporativeFraction: water.dryQuarterEvaporativeFraction,
    frozenGround: water.frozenGround,
    dryingFrac: rain.deltaFrac,
  })

  // Burned area is integrated across the country's own latitude range rather
  // than evaluated at its middle. Skipped entirely on polar ground, where the
  // water balance is already describing a soil column that is not there.
  const geo = fireGeo(feature)
  const density = populationDensity(feature)
  let futureFraction = 0
  let futureDays = 0
  let organicWeighted = 0
  if (!water.frozenGround && geo.areaKm2 > 0) {
    if (!geo.baseline) {
      let fraction = 0
      let days = 0
      for (const band of geo.bands) {
        const past = bandFire(
          band,
          band.baseTempC,
          rain.baselineMm * band.precipScale,
          continental,
          0,
          0,
          density,
          0,
        )
        fraction += band.weight * past.burnedFraction
        days += band.weight * past.seasonDays
        band.organicShare = organicSoilShare(band.baseTempC, past.aridity)
      }
      geo.baseline = { burnedFraction: fraction, seasonDays: days }
    }
    for (const band of geo.bands) {
      const soon = bandFire(
        band,
        band.baseTempC + temp.deltaSince2020C,
        rain.futureMm * band.precipScale,
        continental,
        temp.deltaSince2020C,
        physics.carbonFeedback,
        density,
        band.organicShare,
      )
      futureFraction += band.weight * soon.burnedFraction
      futureDays += band.weight * soon.seasonDays
      organicWeighted += band.weight * soon.burnedFraction * band.organicShare
    }
  }

  const baseline = geo.baseline ?? { burnedFraction: 0, seasonDays: 0 }
  return {
    index: future.index,
    baselineIndex: now.index,
    deltaIndex: future.index - now.index,
    deltaFrac: now.index > 0.5 ? future.index / now.index - 1 : 0,
    vpdKPa: future.vpd,
    fuelLimited: future.fuel < 0.25,
    seasonFraction: future.seasonFrac,
    band: bandFor(future.index),
    baselineBurnedKm2: baseline.burnedFraction * geo.areaKm2,
    burnedKm2: futureFraction * geo.areaKm2,
    burnedFraction: futureFraction,
    peatBurnedKm2: organicWeighted * geo.areaKm2,
    baselineSeasonDays: baseline.seasonDays,
    seasonDays: futureDays,
    observedBurnedKm2: observedBurnedAreaKm2(feature),
  }
}

/* -------------------------------------------------------------------------- */
/* Presentation                                                                */
/* -------------------------------------------------------------------------- */

/** Map fill by fire-weather index: cool green → straw → ember → char. */
export function fireColor(index: number, hovered: boolean): string {
  const stops = [
    { v: 0, r: 150, g: 176, b: 152 },
    { v: 15, r: 206, g: 206, b: 158 },
    { v: 35, r: 232, g: 174, b: 92 },
    { v: 55, r: 214, g: 108, b: 48 },
    { v: 75, r: 158, g: 48, b: 34 },
    { v: 100, r: 92, g: 26, b: 30 },
  ]
  const v = Math.max(0, Math.min(100, index))
  let i = 0
  while (i < stops.length - 2 && v > stops[i + 1].v) i += 1
  const a = stops[i]
  const b = stops[i + 1]
  const u = (v - a.v) / (b.v - a.v || 1)
  return lift(
    Math.round(a.r + u * (b.r - a.r)),
    Math.round(a.g + u * (b.g - a.g)),
    Math.round(a.b + u * (b.b - a.b)),
    hovered,
  )
}

export const FIRE_LEGEND = [
  { label: 'Little fuel / too cold', color: 'rgb(150, 176, 152)' },
  { label: 'Low', color: 'rgb(206, 206, 158)' },
  { label: 'Moderate', color: 'rgb(232, 174, 92)' },
  { label: 'High', color: 'rgb(214, 108, 48)' },
  { label: 'Extreme', color: 'rgb(158, 48, 34)' },
] as const

export function formatFireIndex(index: number): string {
  return index.toFixed(0)
}

/**
 * Burned area for display. Rounded hard on purpose — the model claims an order
 * of magnitude, and printing "283,417 km²" would claim five significant figures
 * it does not have.
 */
export function formatBurnedArea(km2: number): string {
  if (!Number.isFinite(km2) || km2 < 5) return 'none'
  if (km2 < 1000) return `${Math.round(km2 / 10) * 10} km²/yr`
  if (km2 < 100_000) {
    return `${(Math.round(km2 / 100) / 10).toFixed(1)}k km²/yr`
  }
  return `${Math.round(km2 / 1000)}k km²/yr`
}

export function formatSeasonDays(days: number): string {
  if (!Number.isFinite(days) || days < 1) return 'no fire season'
  return `${Math.round(days)} days`
}
