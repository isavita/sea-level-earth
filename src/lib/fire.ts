import { geoCentroid } from 'd3-geo'
import type { CountryFeature } from './countries'
import { lift } from './mapColor'
import { estimateCountryRain } from './rain'
import { continentality, estimateCountryTemp } from './warming'
import { NEUTRAL_PHYSICS, type ScenarioPhysics } from './earthSystem'

/**
 * Fire weather, built from the two models the app already has.
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
 * That non-linearity is a large part of why observed fire extremes have
 * outrun what the older, temperature-linear fire indices projected.
 */

/**
 * Mean annual near-surface temperature by latitude, °C, for the present day.
 *
 * VPD needs an absolute temperature, and the rest of the app only ever carries
 * an anomaly. This is a coarse zonal climatology — enough to place a country in
 * the right thermal regime, not a substitute for one.
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

function zonalMeanTempC(lat: number): number {
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
 * Saturation vapour pressure in kPa (Tetens). This is the Clausius–Clapeyron
 * curve in the form the agronomy and fire literature uses, and the reason a
 * degree of warming buys more drying power in a hot place than a cold one.
 */
function saturationVapourPressureKPa(tempC: number): number {
  return 0.6108 * Math.exp((17.27 * tempC) / (tempC + 237.3))
}

/**
 * Relative humidity is not modelled, so it is inferred from how wet the climate
 * is. Land relative humidity has stayed roughly flat as the world warms — the
 * air holds more moisture but is supplied with proportionally more — which is
 * exactly why VPD, not humidity, is what climbs.
 */
function inferredRelativeHumidity(annualPrecipMm: number): number {
  const wetness = Math.max(0, Math.min(1, Math.log10(Math.max(50, annualPrecipMm) / 50) / Math.log10(60)))
  return 0.32 + 0.45 * wetness
}

function vpdKPa(tempC: number, annualPrecipMm: number): number {
  const es = saturationVapourPressureKPa(tempC)
  return Math.max(0, es * (1 - inferredRelativeHumidity(annualPrecipMm)))
}

/**
 * How much there is to burn, 0–1, from annual rainfall.
 *
 * Rises steeply out of true desert, saturates once there is a closed canopy.
 * Without this term the model would rank the Sahara and the Arabian peninsula
 * as the most fire-prone land on the planet, which is the classic failure of a
 * pure fire-weather index used as a fire-activity index.
 */
export function fuelAvailability(annualPrecipMm: number): number {
  if (annualPrecipMm <= 120) return 0
  if (annualPrecipMm >= 900) return 1
  return Math.min(1, (annualPrecipMm - 120) / 780) ** 0.55
}

/**
 * Wet-forest damping: rainforest carries enormous fuel but is normally too wet
 * to carry fire, and only becomes flammable when a drought dries it out. Very
 * wet climates are therefore held back unless the pathway is drying them.
 */
function perpetuallyWetDamping(annualPrecipMm: number, dryingFrac: number): number {
  if (annualPrecipMm < 1800) return 1
  const wetness = Math.min(1, (annualPrecipMm - 1800) / 1600)
  // Drying pushes it back toward flammable — this is the Amazon dieback path.
  const drought = Math.max(0, -dryingFrac) * 4
  return Math.max(0.25, 1 - wetness * 0.7 * Math.max(0, 1 - drought))
}

/**
 * Half the annual temperature range, °C.
 *
 * Fire is a summer event, and an annual mean hides that completely: Siberia
 * averages about −5 °C and still burns millions of hectares, because its
 * summers reach the high teens. Modelling the annual mean alone ranked Russia
 * and Canada as the two least flammable large countries on Earth, which is the
 * opposite of the truth — boreal fire is where the fastest growth in burned
 * area has actually been observed.
 *
 * The swing is small over tropical ocean-influenced land and enormous over
 * high-latitude continental interiors, which is why `continentality` — already
 * used for land–sea warming contrast — carries most of the signal here.
 */
function seasonalAmplitudeC(lat: number, continentality: number): number {
  const polarward = Math.min(1, Math.abs(lat) / 65)
  const maritime = 2 + 9 * polarward
  const continental = 3 + 24 * polarward
  return maritime + (continental - maritime) * continentality
}

/**
 * Fraction of the year warm enough to carry fire.
 *
 * Treats the annual cycle as a sinusoid about the mean and asks how much of it
 * sits above a threshold — so a short, hot boreal summer is short but real,
 * while a permanently frozen climate returns zero.
 */
function fireSeasonFraction(meanTempC: number, amplitudeC: number): number {
  const THRESHOLD_C = 5
  if (amplitudeC <= 0.01) return meanTempC > THRESHOLD_C ? 1 : 0
  const x = Math.max(-1, Math.min(1, (THRESHOLD_C - meanTempC) / amplitudeC))
  return Math.acos(x) / Math.PI
}

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
}

function bandFor(index: number): FireRisk['band'] {
  if (index < 8) return 'minimal'
  if (index < 22) return 'low'
  if (index < 42) return 'moderate'
  if (index < 62) return 'high'
  return 'extreme'
}

function indexAt(
  meanTempC: number,
  amplitudeC: number,
  annualPrecipMm: number,
  dryingFrac: number,
): { index: number; vpd: number; fuel: number; seasonFrac: number } {
  // VPD is evaluated at the height of the warm season, not at the annual mean —
  // that is when fuel dries and fires run.
  const seasonTempC = meanTempC + amplitudeC
  const vpd = vpdKPa(seasonTempC, annualPrecipMm)
  const fuel = fuelAvailability(annualPrecipMm)
  const seasonFrac = fireSeasonFraction(meanTempC, amplitudeC)
  // VPD around 1.5 kPa is where fire danger becomes serious; normalise there
  // and let it keep climbing rather than clipping, since the tail is the point.
  const drynessDrive = Math.min(2.2, vpd / 1.5)
  // Square-rooted: a three-month boreal season is short but ferocious, and
  // scaling linearly on season length erased it.
  const raw =
    48 *
    drynessDrive *
    fuel *
    Math.sqrt(seasonFrac) *
    perpetuallyWetDamping(annualPrecipMm, dryingFrac)
  return { index: Math.max(0, Math.min(100, raw)), vpd, fuel, seasonFrac }
}

export function estimateCountryFire(
  feature: CountryFeature,
  globalWarmingC: number,
  physics: ScenarioPhysics = NEUTRAL_PHYSICS,
  baselineGlobalC = 1.15,
): FireRisk {
  const [lng, lat] = geoCentroid(feature)
  const safeLat = Number.isFinite(lat) ? lat : 0
  void lng

  const temp = estimateCountryTemp(feature, globalWarmingC, physics, baselineGlobalC)
  const rain = estimateCountryRain(feature, globalWarmingC, physics, baselineGlobalC)

  // Today's absolute mean, and the future one with this pathway's local warming
  // laid on top of it.
  const baseTempC = zonalMeanTempC(safeLat)
  const futureTempC = baseTempC + temp.deltaSince2020C
  const amplitudeC = seasonalAmplitudeC(safeLat, continentality(feature))

  const now = indexAt(baseTempC, amplitudeC, rain.baselineMm, 0)
  const future = indexAt(futureTempC, amplitudeC, rain.futureMm, rain.deltaFrac)

  return {
    index: future.index,
    baselineIndex: now.index,
    deltaIndex: future.index - now.index,
    deltaFrac: now.index > 0.5 ? future.index / now.index - 1 : 0,
    vpdKPa: future.vpd,
    fuelLimited: future.fuel < 0.25,
    seasonFraction: future.seasonFrac,
    band: bandFor(future.index),
  }
}

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
