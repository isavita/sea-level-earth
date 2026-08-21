import { lift } from './mapColor'
import type { CountryFeature } from './countries'
import { NEUTRAL_PHYSICS, type ScenarioPhysics } from './earthSystem'
import { estimateCountryRain, type CountryRain } from './rain'
import {
  continentality,
  countryCentroid,
  estimateCountryTemp,
  type CountryTemp,
} from './warming'

/**
 * Water balance and drought.
 *
 * The rainfall layer answers "does more water arrive?". That is only half the
 * question, and on its own it is misleading: the atmosphere's demand for water
 * rises with temperature far faster than rainfall does, so a place can gain
 * rain every year and still lose ground. Boreal Canada and Siberia are the
 * textbook case — projected wetter in every model, and burning more anyway.
 *
 * So this layer computes the other half — potential evapotranspiration, the
 * depth of water the atmosphere would evaporate if it were available — and
 * subtracts it. Three things then fall out that rainfall alone cannot give:
 *
 *  1. **P − PET**, the water balance in mm/yr, which is what a river, a soil
 *     and a crop actually respond to.
 *  2. **P / PET**, the UNEP aridity index, which is how drylands are formally
 *     defined and is the reason "the drylands are expanding" is a statement
 *     about PET as much as about rain.
 *  3. A **standardised anomaly**, because the same 50 mm means nothing in
 *     Ireland and is most of the year's water in Libya.
 *
 * PET is Hargreaves–Samani, run month by month. It needs extraterrestrial
 * radiation from latitude and day of year, mean temperature, and the daily
 * temperature range — the range is what stands in for cloud and humidity, and
 * is why the formulation is not simply linear in temperature. Monthly matters:
 * a Mediterranean climate gets its rain in the months when demand is lowest and
 * none at all when demand peaks, and an annual mean erases exactly the part
 * that hurts.
 *
 * The seasonal climatology (zonal mean temperature, seasonal amplitude, daily
 * temperature range) lives here rather than in `fire.ts` because this is the
 * layer that needs it at monthly resolution. The fire model reads all of it
 * back from here, together with the three things the balance produces that
 * rainfall cannot: the surface humidity, the aridity index it takes its fuel
 * from, and whether the land has any dry season at all.
 */

/* -------------------------------------------------------------------------- */
/* Absolute temperature climatology                                            */
/* -------------------------------------------------------------------------- */

/**
 * Mean annual near-surface temperature by latitude, °C, present day.
 *
 * The rest of the app only ever carries a warming *anomaly*; PET needs an
 * absolute temperature. This is a coarse zonal climatology — enough to place a
 * country in the right thermal regime, not a substitute for one.
 */
const ZONAL_MEAN_TEMP_C: { lat: number; t: number }[] = [
  { lat: 90, t: -18 },
  { lat: 75, t: -12 },
  { lat: 60, t: -1 },
  { lat: 50, t: 6 },
  { lat: 40, t: 13 },
  { lat: 30, t: 20 },
  { lat: 20, t: 25 },
  { lat: 10, t: 26 },
  { lat: 0, t: 26 },
  { lat: -10, t: 25 },
  { lat: -20, t: 22 },
  { lat: -30, t: 18 },
  { lat: -40, t: 12 },
  { lat: -50, t: 5 },
  { lat: -60, t: -3 },
  { lat: -75, t: -20 },
  { lat: -90, t: -35 },
]

export function zonalMeanTempC(lat: number): number {
  const t = Math.max(-90, Math.min(90, lat))
  for (let i = 0; i < ZONAL_MEAN_TEMP_C.length - 1; i++) {
    const a = ZONAL_MEAN_TEMP_C[i]
    const b = ZONAL_MEAN_TEMP_C[i + 1]
    if (t <= a.lat && t >= b.lat) {
      const u = (a.lat - t) / (a.lat - b.lat)
      return a.t + u * (b.t - a.t)
    }
  }
  return 10
}

/**
 * Mean annual temperature with maritime moderation, °C.
 *
 * A zonal mean is an average over everything at that latitude, and past the
 * subtropics the spread within a latitude band is enormous: Ireland and central
 * Siberia both sit near 53°N and differ by roughly 13 °C in the annual mean,
 * because the ocean keeps one of them from ever getting properly cold. Reading
 * Ireland off the zonal table alone put it at about 4 °C and understated its
 * evaporative demand by nearly a third, which matters here in a way it did not
 * when only the seasonal swing was wanted.
 *
 * The correction is one-sided on purpose — the zonal table already sits close
 * to the continental value at these latitudes — and fades out in the tropics,
 * where the land–sea contrast in the annual mean is small.
 */
export function annualMeanTempC(lat: number, continental: number): number {
  const poleward = Math.max(0, Math.min(1, (Math.abs(lat) - 25) / 40))
  return zonalMeanTempC(lat) + 6 * poleward * (1 - continental)
}

/**
 * Half the annual temperature range, °C.
 *
 * The swing is small over ocean-influenced land and enormous over high-latitude
 * continental interiors, which is why `continentality` — already used for the
 * land–sea warming contrast — carries most of the signal. Both the water
 * balance and the fire model depend on it: PET is driven by the warm months,
 * and an annual mean hides them completely.
 */
export function seasonalAmplitudeC(lat: number, continental: number): number {
  const polarward = Math.min(1, Math.abs(lat) / 65)
  const maritime = 2 + 9 * polarward
  const continentalSwing = 3 + 24 * polarward
  return maritime + (continentalSwing - maritime) * continental
}

/* -------------------------------------------------------------------------- */
/* Extraterrestrial radiation                                                  */
/* -------------------------------------------------------------------------- */

/** Day of year at the middle of each month (FAO-56 Table 2.5). */
const MID_MONTH_DOY = [15, 46, 74, 105, 135, 166, 196, 227, 258, 288, 319, 349]
/** Exported because the fire model counts season length in days, not months. */
export const MONTH_DAYS = [31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

const SOLAR_CONSTANT = 0.082 // MJ m⁻² min⁻¹
/** 1 MJ m⁻² of latent heat evaporates 0.408 mm of water. */
const MJ_TO_MM = 0.408

/**
 * Extraterrestrial radiation Ra at the top of the atmosphere, expressed as the
 * depth of water it could evaporate (mm/day). FAO-56 equations 21–25.
 *
 * This is the term that makes PET a function of *where* and *when* rather than
 * only of temperature: it is why a June day at 60°N delivers more energy to the
 * surface than one at the equator, and why polar winter delivers none at all.
 */
function extraterrestrialRadiationMm(lat: number, doy: number): number {
  // Clamped short of the pole: tan(φ) diverges at exactly 90°.
  const phi = (Math.PI / 180) * Math.max(-89.5, Math.min(89.5, lat))
  const dayAngle = (2 * Math.PI * doy) / 365
  const dr = 1 + 0.033 * Math.cos(dayAngle)
  const dec = 0.409 * Math.sin(dayAngle - 1.39)
  // Sunset hour angle; the clamp is polar day (+1) and polar night (−1).
  const ws = Math.acos(Math.max(-1, Math.min(1, -Math.tan(phi) * Math.tan(dec))))
  const ra =
    ((24 * 60) / Math.PI) *
    SOLAR_CONSTANT *
    dr *
    (ws * Math.sin(phi) * Math.sin(dec) +
      Math.cos(phi) * Math.cos(dec) * Math.sin(ws))
  return Math.max(0, ra * MJ_TO_MM)
}

/* -------------------------------------------------------------------------- */
/* Seasonal shape of the rainfall                                              */
/* -------------------------------------------------------------------------- */

/** Fraction of the year at the middle of month m (0 = January). */
const monthPhase = (m: number) => (m + 0.5) / 12

/** Mid-July in the north, mid-January in the south. */
const summerPhase = (lat: number) => (lat >= 0 ? 0.553 : 0.053)

/**
 * How the year's rain is distributed across the months.
 *
 * One harmonic — a peak month and a concentration — which is coarse but carries
 * the distinction that actually matters for drought: whether the rain arrives
 * when the atmosphere is thirsty or when it is not. A Mediterranean climate and
 * a monsoon climate can have identical annual totals and opposite summers.
 *
 * The regional windows mirror the ones the rainfall model already uses, for the
 * same reason: latitude alone cannot tell the Asian monsoon from the Sahara.
 */
function rainSeasonality(
  lat: number,
  lng: number,
  continental: number,
): { strength: number; phase: number } {
  const absLat = Math.abs(lat)
  const summer = summerPhase(lat)
  const winter = (summer + 0.5) % 1

  // South and East Asian monsoon: rain concentrated into the warm half-year.
  if (lat > 8 && lat < 35 && lng > 65 && lng < 95) return { strength: 0.85, phase: summer }
  if (lat > 20 && lat < 45 && lng > 100 && lng < 145) return { strength: 0.6, phase: summer }

  // Mediterranean-type climates: the west sides of the continents in the
  // subtropics, where the storm track only reaches in winter and the summer is
  // rainless. This is the regime an annual mean hides most badly.
  const mediterranean =
    (lat > 28 && lat < 46 && lng > -10 && lng < 45) || // Mediterranean basin, Near East
    (lat > 30 && lat < 43 && lng > -125 && lng < -115) || // California
    (lat < -27 && lat > -38 && lng > -75 && lng < -69) || // central Chile
    (lat < -29 && lat > -36 && lng > 16 && lng < 26) || // Western Cape
    (lat < -28 && lat > -36 && lng > 112 && lng < 122) // south-west Australia
  if (mediterranean) return { strength: 0.75, phase: winter }

  // Deep tropics: the rain belt crosses twice a year, so a single harmonic
  // largely cancels and the year is comparatively even.
  if (absLat < 8) return { strength: 0.18, phase: summer }
  // Tropical wet-and-dry: one rainy season, in the local summer.
  if (absLat < 25) return { strength: 0.75, phase: summer }
  // Subtropics to mid-latitudes: continental interiors take their rain from
  // summer convection, maritime margins from the winter storm track.
  if (absLat < 55) {
    return {
      strength: 0.15 + 0.2 * continental,
      phase: continental > 0.5 ? summer : winter,
    }
  }
  // High latitudes: a modest summer maximum.
  return { strength: 0.25, phase: summer }
}

/* -------------------------------------------------------------------------- */
/* Cached per-country geometry                                                 */
/* -------------------------------------------------------------------------- */

export interface ClimateGeo {
  lat: number
  continental: number
  amplitudeC: number
  /** Ra for each month, mm/day. Depends only on latitude. */
  raMm: number[]
  /** Share of annual rainfall falling in each month; sums to 1. */
  rainShare: number[]
}

/**
 * The parts of a country's climatology that depend only on where it is.
 *
 * Keyed on a position rather than on a feature because the fire model needs the
 * same balance run at several latitudes across one country: a country-mean
 * climate is a fair description of Ireland and a badly misleading one of DR
 * Congo, whose middle is rainforest and whose fires are all on its savanna
 * fringes. Nothing here changes with the pathway, so callers are expected to
 * build it once and keep it.
 */
export function climateGeoAt(
  lat: number,
  lng: number,
  continental: number,
): ClimateGeo {
  const { strength, phase } = rainSeasonality(lat, lng, continental)
  const raMm: number[] = []
  const rainShare: number[] = []
  for (let m = 0; m < 12; m++) {
    raMm.push(extraterrestrialRadiationMm(lat, MID_MONTH_DOY[m]))
    rainShare.push(
      (1 + strength * Math.cos(2 * Math.PI * (monthPhase(m) - phase))) / 12,
    )
  }
  return {
    lat,
    continental,
    amplitudeC: seasonalAmplitudeC(lat, continental),
    raMm,
    rainShare,
  }
}

// Everything here is a function of the polygon alone, and `geoCentroid` over a
// 50m outline is far too costly to redo for ~240 countries on every timeline
// commit. Same pattern as `shapeCache` in warming.ts.
const geoCache = new WeakMap<CountryFeature, ClimateGeo>()

function climateGeo(feature: CountryFeature): ClimateGeo {
  const cached = geoCache.get(feature)
  if (cached) return cached
  const { lat, lng } = countryCentroid(feature)
  const geo = climateGeoAt(lat, lng, continentality(feature))
  geoCache.set(feature, geo)
  return geo
}

/* -------------------------------------------------------------------------- */
/* The monthly water balance                                                   */
/* -------------------------------------------------------------------------- */

/** Plant-available water a deep soil can hold, mm. Thornthwaite–Mather value. */
const SOIL_CAPACITY_MM = 150

export interface Balance {
  petMm: number
  /**
   * Actual evapotranspiration summed over the year, mm. The water the land
   * genuinely returned to the air rather than the water it was asked for — and
   * so, since photosynthesis and transpiration run through the same stomata,
   * the standard first-order predictor of how much plant matter a place grows.
   * The fire model reads it as fuel load.
   */
  aetMm: number
  /** Deficit summed over the three consecutive months with the worst shortfall. */
  dryQuarterDeficitMm: number
  /** First month of that quarter, 0 = January. */
  dryQuarterStart: number
  /** AET ÷ PET across that same quarter, 0–1. */
  dryQuarterEvaporativeFraction: number
  /** Warmest monthly mean, °C — the Köppen polar test reads this. */
  warmestMonthC: number
}

/**
 * Optional month-by-month output from the balance.
 *
 * A fire season is a run of months, not an annual total, so the fire model
 * needs the shape of the year rather than the year's sums. Written into
 * caller-owned arrays instead of returned in a fresh object because the fire
 * model runs the balance ten times per country per commit, and this is the one
 * part of the app where that allocation would be felt.
 */
export interface MonthlyTrace {
  /** Mean temperature in each month, °C. */
  tempC: Float64Array
  /** Water the surface actually returned to the air that month, mm. */
  aetMm: Float64Array
  /** AET ÷ PET in each month, 0–1. Below 1 the surface is running dry. */
  evaporativeFraction: Float64Array
  /** Snow lying at the end of each month, mm of water. Land under it cannot burn. */
  snowPackMm: Float64Array
  /**
   * The atmosphere's demand in each month, mm — PET before the surface's
   * ability to meet it. Optional because only the humid-heat layer reads it,
   * and it reads it as a weight rather than as a quantity: the evaporative
   * fraction below is a ratio, and in a month with no demand the ratio is
   * meaningless and pinned to 1. Without a demand weight a frozen January
   * counts for as much as a July in any annual average taken over it.
   */
  petMm?: Float64Array
}

/**
 * Twelve months of Hargreaves PET against a snow-and-soil bucket.
 *
 * The bookkeeping is Thornthwaite–Mather: rain first meets demand, the surplus
 * recharges the soil up to its capacity and then runs off, and once rain falls
 * short the soil gives up water at a rate proportional to what is left — which
 * is why a dry season deepens rather than switching on. Snow is held out of the
 * accounting until it melts, without which every seasonally frozen country
 * would appear to receive its winter precipitation in winter, when the ground
 * cannot use it, rather than in the spring melt, when it can.
 *
 * The loop runs twice: the first pass is a spin-up, so the soil enters January
 * holding whatever the previous December left it rather than an arbitrary
 * guess. Only the second pass is counted.
 */
export function monthlyBalance(
  geo: ClimateGeo,
  meanTempC: number,
  annualPrecipMm: number,
  dtrBaseC: number,
  trace?: MonthlyTrace,
): Balance {
  const pet = new Array<number>(12)
  const aet = new Array<number>(12)
  const rainMm = new Array<number>(12)
  const snowFrac = new Array<number>(12)
  const tempsC = new Array<number>(12)

  const summer = summerPhase(geo.lat)
  for (let m = 0; m < 12; m++) {
    const tempC =
      meanTempC +
      geo.amplitudeC * Math.cos(2 * Math.PI * (monthPhase(m) - summer))
    tempsC[m] = tempC
    // A wet month is a cloudy, humid month, and both compress the daily
    // temperature range — which is the term Hargreaves reads as a proxy for how
    // much of the incoming radiation reaches the ground.
    const share = Math.max(0.3, Math.min(1.8, geo.rainShare[m] * 12))
    const dtr = Math.max(3, dtrBaseC * (1 + 0.18 * (1 - share)))
    // Frozen ground evaporates almost nothing; the ramp rather than a hard cut
    // keeps PET continuous as a country warms across the threshold.
    const thaw = Math.max(0, Math.min(1, tempC / 3))
    pet[m] =
      thaw *
      MONTH_DAYS[m] *
      Math.max(
        0,
        0.0023 * geo.raMm[m] * (tempC + 17.8) * Math.sqrt(dtr),
      )
    rainMm[m] = annualPrecipMm * geo.rainShare[m]
    // Below −1 °C precipitation falls as snow and waits; above +2 °C it is all
    // rain. The band between is the shoulder season.
    snowFrac[m] = Math.max(0, Math.min(1, (2 - tempC) / 3))
  }

  let soil = SOIL_CAPACITY_MM * 0.5
  let pack = 0
  for (let pass = 0; pass < 2; pass++) {
    for (let m = 0; m < 12; m++) {
      pack += rainMm[m] * snowFrac[m]
      const melt = pack * Math.max(0, Math.min(1, (tempsC[m] + 1) / 6))
      pack -= melt
      const supply = rainMm[m] * (1 - snowFrac[m]) + melt

      if (supply >= pet[m]) {
        aet[m] = pet[m]
        soil = Math.min(SOIL_CAPACITY_MM, soil + supply - pet[m])
      } else {
        const demand = pet[m] - supply
        // Exponential drawdown: the drier the soil, the harder it holds on.
        const withdrawn = soil * (1 - Math.exp(-demand / SOIL_CAPACITY_MM))
        soil -= withdrawn
        aet[m] = supply + withdrawn
      }
      // Only the counted pass, so the trace describes a soil that has already
      // spun up rather than one still forgetting its arbitrary start.
      if (trace && pass === 1) trace.snowPackMm[m] = pack
    }
  }

  let petMm = 0
  let aetMm = 0
  let warmestMonthC = -Infinity
  for (let m = 0; m < 12; m++) {
    petMm += pet[m]
    aetMm += aet[m]
    if (tempsC[m] > warmestMonthC) warmestMonthC = tempsC[m]
    if (trace) {
      trace.tempC[m] = tempsC[m]
      trace.aetMm[m] = aet[m]
      // A month with no demand at all is not a month the surface failed to
      // meet: frozen ground reads as fully supplied rather than as a drought.
      // That convention is safe only where the fraction is read alongside the
      // demand behind it, which is why `petMm` travels with it.
      trace.evaporativeFraction[m] = pet[m] > 0.5 ? aet[m] / pet[m] : 1
      if (trace.petMm) trace.petMm[m] = pet[m]
    }
  }

  // The three consecutive months where the land is furthest from meeting the
  // atmosphere's demand — the dry season, wherever in the calendar it lands.
  // This is the window fire cares about, and it is not the same as the hottest
  // quarter: India's is the pre-monsoon spring, and a quarter picked on
  // temperature alone would average that away against the monsoon that follows.
  let best = -Infinity
  let dryQuarterDeficitMm = 0
  let dryQuarterStart = 0
  let dryPet = 0
  let dryAet = 0
  for (let start = 0; start < 12; start++) {
    let quarterPet = 0
    let quarterAet = 0
    for (let k = 0; k < 3; k++) {
      const m = (start + k) % 12
      quarterPet += pet[m]
      quarterAet += aet[m]
    }
    // Where the land meets demand all year — the wet tropics — every window
    // scores zero, so a whisker of PET breaks the tie toward the thirstiest.
    const score = quarterPet - quarterAet + 0.001 * quarterPet
    if (score > best) {
      best = score
      dryQuarterDeficitMm = quarterPet - quarterAet
      dryQuarterStart = start
      dryPet = quarterPet
      dryAet = quarterAet
    }
  }

  return {
    petMm,
    aetMm,
    dryQuarterDeficitMm,
    dryQuarterStart,
    dryQuarterEvaporativeFraction: dryPet > 0.5 ? dryAet / dryPet : 1,
    warmestMonthC,
  }
}

/**
 * Mean daily temperature range, °C.
 *
 * Hargreaves uses the range as a stand-in for how much of the sun's energy
 * actually reaches the ground: clear, dry air swings hard between day and
 * night, cloudy humid air barely moves. Rainfall is the available proxy for
 * cloud, and continentality for the absence of a moderating ocean. Calibrated
 * against the observed spread — around 16 °C in the Sahara, 10 °C over
 * Amazonia, 7 °C in Ireland.
 *
 * Exported because the fire model needs the same number for a different reason:
 * fire weather is read at the afternoon maximum, which is half this range above
 * the daily mean.
 */
export function dailyTempRangeC(
  annualPrecipMm: number,
  continental: number,
): number {
  const wetness = Math.max(
    0,
    Math.min(1, Math.log10(Math.max(50, annualPrecipMm) / 50) / Math.log10(60)),
  )
  return 5.5 + 9.5 * (1 - wetness) + 3 * continental
}

/**
 * Near-surface relative humidity implied by the water balance, 0–1.
 *
 * The air over land is moistened by the land: where the surface can meet the
 * atmosphere's demand, evaporation keeps humidity high; where it cannot, the
 * boundary layer dries out. So the evaporative fraction — how much of the
 * demand the surface actually supplies — is a far better handle on humidity
 * than annual rainfall, which was the previous proxy and could not respond to
 * warming at all.
 *
 * The end points are the observed ones: about 25% over the Sahara, about 80%
 * over rainforest and the wet maritime mid-latitudes.
 */
export function surfaceHumidity(evaporativeFraction: number): number {
  const ef = Math.max(0, Math.min(1, evaporativeFraction))
  return 0.22 + 0.56 * ef ** 0.5
}

/* -------------------------------------------------------------------------- */
/* Public model                                                                */
/* -------------------------------------------------------------------------- */

export type AridityClass =
  | 'hyper-arid'
  | 'arid'
  | 'semi-arid'
  | 'dry sub-humid'
  | 'humid'

export type DroughtBand =
  | 'wetter'
  | 'stable'
  | 'mild'
  | 'moderate'
  | 'severe'
  | 'extreme'

/** UNEP / UNCCD aridity classes, the boundaries used to define the drylands. */
export function aridityClass(index: number): AridityClass {
  if (index < 0.05) return 'hyper-arid'
  if (index < 0.2) return 'arid'
  if (index < 0.5) return 'semi-arid'
  if (index < 0.65) return 'dry sub-humid'
  return 'humid'
}

/**
 * Bands for a shift in the mean, in standard deviations.
 *
 * Not SPI/SPEI's −1/−1.5/−2 event categories, which describe how bad one
 * particular season was. This number is something different and much harder to
 * move: a permanent shift of the whole distribution. A −0.5σ shift in the mean
 * roughly doubles how often a country meets what is currently its one-year-in-
 * six drought, and that is a large statement — but on the event scale it would
 * read as "not even mild", which is why the event boundaries cannot be reused
 * here. At the app's default pathway the world spans about −0.9σ to +0.4σ, so
 * boundaries set at −1 and −2 would have sorted every country on Earth into two
 * of six bands and told the reader nothing.
 */
export function droughtBand(anomaly: number): DroughtBand {
  if (!Number.isFinite(anomaly)) return 'stable'
  if (anomaly >= 0.25) return 'wetter'
  if (anomaly > -0.15) return 'stable'
  if (anomaly > -0.3) return 'mild'
  if (anomaly > -0.45) return 'moderate'
  if (anomaly > -0.85) return 'severe'
  return 'extreme'
}

export interface CountryDrought {
  /** Annual potential evapotranspiration, mm/yr — today and projected. */
  baselinePetMm: number
  petMm: number
  /** Annual precipitation the balance was run against, mm/yr. */
  baselinePrecipMm: number
  precipMm: number
  /** Water balance P − PET, mm/yr. Negative means demand exceeds supply. */
  baselineBalanceMm: number
  balanceMm: number
  deltaBalanceMm: number
  /**
   * Aridity index P/PET. Capped at 3, above which it stops discriminating
   * between wet climates and starts reporting a vanishing denominator.
   */
  baselineAridity: number
  aridity: number
  baselineClass: AridityClass
  aridityClass: AridityClass
  /**
   * SPEI-like standardised anomaly: the change in the water balance divided by
   * the interannual spread of that balance, in standard deviations. Negative is
   * drier.
   */
  anomaly: number
  /** The yardstick behind `anomaly` — one standard deviation, in mm. */
  variabilityMm: number
  band: DroughtBand
  /** Shortfall over the three consecutive driest months, mm. */
  baselineDryQuarterDeficitMm: number
  dryQuarterDeficitMm: number
  /** First month of that quarter, 0 = January — where the dry season sits. */
  dryQuarterStartMonth: number
  /** Relative humidity implied by the balance across that driest quarter. */
  baselineDrySeasonHumidity: number
  drySeasonHumidity: number
  /**
   * Share of the atmosphere's demand the surface actually supplies across that
   * driest quarter, 0–1. The fire model reads it directly: a landscape that
   * still meets demand when it is least able to never dries its fuel below the
   * moisture of extinction, however much biomass it carries.
   */
  baselineDryQuarterEvaporativeFraction: number
  dryQuarterEvaporativeFraction: number
  /** The signature case: more rain arrives, and the balance still worsens. */
  wetterButDrier: boolean
  /** True over polar ground, where a soil column is the wrong model entirely. */
  frozenGround: boolean
}

/**
 * Interannual standard deviation of the annual water balance, mm.
 *
 * Rainfall variability dominates and rises steeply as the mean falls — a wet
 * maritime climate varies by 10–15% from year to year, a desert by 60–100%.
 * PET varies far less — reported coefficients of variation for annual reference
 * evapotranspiration sit around 3–6% — but it is not independent: dry years are
 * hot years, so the two anomalies reinforce rather than cancel, and the cross
 * term is added rather than dropped.
 */
function balanceVariabilityMm(precipMm: number, petMm: number): number {
  const cvPrecip = 0.14 + 0.6 * Math.exp(-precipMm / 450)
  const sdPrecip = cvPrecip * precipMm
  const sdPet = 0.05 * petMm
  return Math.sqrt(
    sdPrecip * sdPrecip + sdPet * sdPet + 0.9 * sdPrecip * sdPet,
  )
}

/**
 * The water balance for one country, given its climate change already resolved.
 *
 * Split out from `estimateCountryDrought` so the fire model, which needs the
 * same temperature and rainfall anyway, can pass them in rather than making the
 * app compute them twice per country per frame.
 */
export function droughtFromClimate(
  feature: CountryFeature,
  temp: CountryTemp,
  rain: CountryRain,
): CountryDrought {
  const geo = climateGeo(feature)
  const baseMeanC = annualMeanTempC(geo.lat, geo.continental)
  // The pathway's local warming — including any Atlantic-circulation cooling,
  // which is the one mechanism that can *lower* a region's evaporative demand.
  const futureMeanC = baseMeanC + temp.deltaSince2020C

  const now = monthlyBalance(
    geo,
    baseMeanC,
    rain.baselineMm,
    dailyTempRangeC(rain.baselineMm, geo.continental),
  )
  const future = monthlyBalance(
    geo,
    futureMeanC,
    rain.futureMm,
    dailyTempRangeC(rain.futureMm, geo.continental),
  )

  const baselineBalanceMm = rain.baselineMm - now.petMm
  const balanceMm = rain.futureMm - future.petMm
  const deltaBalanceMm = balanceMm - baselineBalanceMm

  // A floor on the denominator: over permanently frozen ground PET goes to
  // zero and the ratio diverges, which says nothing useful about Antarctica.
  const baselineAridity = Math.min(3, rain.baselineMm / Math.max(25, now.petMm))
  const aridity = Math.min(3, rain.futureMm / Math.max(25, future.petMm))

  const variabilityMm = balanceVariabilityMm(rain.baselineMm, now.petMm)
  const anomaly = deltaBalanceMm / variabilityMm

  const baselineClass = aridityClass(baselineAridity)
  const futureClass = aridityClass(aridity)

  return {
    baselinePetMm: now.petMm,
    petMm: future.petMm,
    baselinePrecipMm: rain.baselineMm,
    precipMm: rain.futureMm,
    baselineBalanceMm,
    balanceMm,
    deltaBalanceMm,
    baselineAridity,
    aridity,
    baselineClass,
    aridityClass: futureClass,
    anomaly,
    variabilityMm,
    band: droughtBand(anomaly),
    baselineDryQuarterDeficitMm: now.dryQuarterDeficitMm,
    dryQuarterDeficitMm: future.dryQuarterDeficitMm,
    dryQuarterStartMonth: future.dryQuarterStart,
    baselineDrySeasonHumidity: surfaceHumidity(
      now.dryQuarterEvaporativeFraction,
    ),
    drySeasonHumidity: surfaceHumidity(future.dryQuarterEvaporativeFraction),
    baselineDryQuarterEvaporativeFraction: now.dryQuarterEvaporativeFraction,
    dryQuarterEvaporativeFraction: future.dryQuarterEvaporativeFraction,
    wetterButDrier: rain.deltaMm > 0 && deltaBalanceMm < 0,
    // Köppen's polar boundary: where the warmest month stays below 10 °C there
    // is no tree line and, on the two ice sheets, no soil at all — so the
    // bucket above is describing something that is not there, and P/PET stops
    // being a statement about dryness. Read off today's climate rather than the
    // projected one, because it is a property of the place: the old test was
    // annual PET below 120 mm, which caught Antarctica and let Greenland
    // through to rank as an ordinary sub-humid country. It still cannot see
    // altitude, so it flags the ice sheets and the high Arctic and nothing
    // else — the Andean and Himalayan plateaux are described in the caveats.
    frozenGround: now.warmestMonthC < 10 || future.petMm < 120,
  }
}

export function estimateCountryDrought(
  feature: CountryFeature,
  globalWarmingC: number,
  physics: ScenarioPhysics = NEUTRAL_PHYSICS,
  baselineGlobalC = 1.15,
): CountryDrought {
  return droughtFromClimate(
    feature,
    estimateCountryTemp(feature, globalWarmingC, physics, baselineGlobalC),
    estimateCountryRain(feature, globalWarmingC, physics, baselineGlobalC),
  )
}

/* -------------------------------------------------------------------------- */
/* Presentation                                                                */
/* -------------------------------------------------------------------------- */

// The three formatters below are the last thing between a bad number and the
// screen, and "+NaNσ" in a country card is worse than an em dash.
export function formatAridity(index: number): string {
  if (!Number.isFinite(index)) return '—'
  return index >= 3 ? '3.0+' : index.toFixed(2)
}

export function formatAnomaly(anomaly: number, digits = 1): string {
  if (!Number.isFinite(anomaly)) return '—'
  const rounded = Number(anomaly.toFixed(digits))
  if (rounded === 0) return `0.0σ`
  return `${rounded < 0 ? '−' : '+'}${Math.abs(rounded).toFixed(digits)}σ`
}

export function formatBalanceMm(mm: number): string {
  if (!Number.isFinite(mm)) return '—'
  const rounded = Math.round(mm)
  return `${rounded < 0 ? '−' : '+'}${Math.abs(rounded)} mm`
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

/** The driest quarter as a plain span, e.g. "June to August". */
export function dryQuarterLabel(startMonth: number): string {
  const a = ((startMonth % 12) + 12) % 12
  return `${MONTH_NAMES[a]} to ${MONTH_NAMES[(a + 2) % 12]}`
}

// Worded as a shift in the long-term balance rather than as an SPEI event
// class, because that is what the number is — see `droughtBand`.
const DROUGHT_BAND_LABEL: Record<DroughtBand, string> = {
  wetter: 'wetter',
  stable: 'little change',
  mild: 'slight drying',
  moderate: 'clear drying',
  severe: 'strong drying',
  extreme: 'severe drying',
}

export function droughtBandLabel(band: DroughtBand): string {
  return DROUGHT_BAND_LABEL[band]
}

/**
 * Map fill by standardised water-balance anomaly: rust where the balance falls
 * against its own variability, through neutral, to blue where it climbs.
 *
 * Keyed to σ rather than to millimetres, because a millimetre scale would paint
 * the whole Sahara neutral — it has almost no water to lose — and wash out the
 * one place where a small absolute change is the entire story.
 *
 * Most of the resolution sits inside the first σ. The stops used to run to
 * −2.5σ, which is honest about the physics and useless as a key: a shift of the
 * long-term mean by a whole standard deviation takes roughly 4 °C, so at the
 * app's default pathway every country on Earth fell into the palest sixth of
 * the ramp and the map read as blank. The deep end is still there for the high
 * pathways, where the subtropics do reach it.
 */
const DROUGHT_STOPS = [
  { z: -2, r: 92, g: 34, b: 26 },
  { z: -1.2, r: 148, g: 58, b: 34 },
  { z: -0.8, r: 186, g: 96, b: 48 },
  { z: -0.5, r: 210, g: 136, b: 72 },
  { z: -0.25, r: 226, g: 180, b: 126 },
  { z: 0, r: 196, g: 206, b: 192 },
  { z: 0.3, r: 118, g: 184, b: 186 },
  { z: 0.9, r: 46, g: 118, b: 178 },
] as const

export function droughtColor(anomaly: number, hovered: boolean): string {
  // NaN survives Math.max/Math.min, and an `rgb(NaN, NaN, NaN)` fill silently
  // paints a country black. Nothing upstream should produce one, so treat it as
  // no change rather than hiding it behind a guard at every call site.
  const finite = Number.isFinite(anomaly) ? anomaly : 0
  const z = Math.max(
    DROUGHT_STOPS[0].z,
    Math.min(DROUGHT_STOPS[DROUGHT_STOPS.length - 1].z, finite),
  )
  let i = 0
  while (i < DROUGHT_STOPS.length - 2 && z > DROUGHT_STOPS[i + 1].z) i += 1
  const a = DROUGHT_STOPS[i]
  const b = DROUGHT_STOPS[i + 1]
  const u = (z - a.z) / (b.z - a.z || 1)
  return lift(
    Math.round(a.r + u * (b.r - a.r)),
    Math.round(a.g + u * (b.g - a.g)),
    Math.round(a.b + u * (b.b - a.b)),
    hovered,
  )
}

// Every swatch is `droughtColor` evaluated at the σ it names, so the key is the
// ramp itself rather than an approximation of it, and the stops are chosen to
// be values countries actually reach on the app's default pathway. The old key
// advertised −2σ and −1σ, neither of which anything on screen came close to:
// its "−1σ drier" chip was darker than the darkest fill the map ever painted,
// so three of its four swatches corresponded to nothing.
export const DROUGHT_LEGEND = [
  { label: '−0.8σ or drier', color: droughtColor(-0.8, false) },
  { label: '−0.5σ', color: droughtColor(-0.5, false) },
  { label: '−0.25σ', color: droughtColor(-0.25, false) },
  { label: 'Little change', color: droughtColor(0, false) },
  { label: '+0.3σ wetter', color: droughtColor(0.3, false) },
] as const
