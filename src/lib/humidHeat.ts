import { lift } from './mapColor'
import type { CountryFeature } from './countries'
import {
  amocCoolingC,
  NEUTRAL_PHYSICS,
  type ScenarioPhysics,
} from './earthSystem'
import { estimateCountryRain, type CountryRain } from './rain'
import {
  continentality,
  countryCentroid,
  estimateCountryTemp,
  type CountryTemp,
} from './warming'
import {
  annualMeanTempC,
  climateGeoAt,
  dailyTempRangeC,
  monthlyBalance,
  MONTH_DAYS,
  surfaceHumidity,
  type ClimateGeo,
  type MonthlyTrace,
} from './drought'
import { POPULATION_M } from './fire'

/**
 * Humid heat: where the air stops being survivable, and who lives there.
 *
 * Every other heat number in this app is a dry-bulb temperature, and dry-bulb
 * temperature is not what kills people. A human body sheds metabolic heat by
 * evaporating sweat, and evaporation is driven by the *gap* between the water
 * the air holds and the water it could hold. 45 °C in Death Valley shade is
 * survivable for a fit adult with water; 33 °C in the Persian Gulf in August is
 * not, because the air is already close to saturated and the sweat cannot go
 * anywhere. The variable that expresses this is the **wet-bulb temperature**:
 * the lowest temperature a wet surface can reach by evaporating into the air.
 * Skin at rest sits near 35 °C, so once the wet bulb passes 35 °C no amount of
 * sweating removes heat and core temperature climbs regardless of fitness,
 * hydration or shade. That is the theoretical survivability limit; the measured
 * one is lower, and both are in the bands below.
 *
 * Three consequences shape this file, and each of them is a place where a model
 * that simply reported temperature would get the answer backwards:
 *
 *  1. **The deserts are not the dangerous places.** The Sahara is the hottest
 *     land on Earth and its observed wet bulb peaks around 23–25 °C, because
 *     its air is bone-dry and sweat evaporates freely. The wet-bulb extremes
 *     are on the Persian Gulf, the Indus and Ganges plains, the Red Sea coast
 *     and the Gulf of Mexico — humid places that are also hot. If this layer
 *     ever ranks Libya above Qatar it is measuring temperature and has failed.
 *
 *     What it actually produces: Algeria, Libya and Egypt at 25.5–27 °C and the
 *     Sahel near 28 °C, one to two degrees high, because the temperature
 *     climatology it shares with the water-balance layer runs hot along the
 *     desert's southern margin and there is no altitude anywhere in this app.
 *     The ordering does hold — every Saharan and Sahel country ranks below
 *     Bangladesh and far below the Gulf — but it holds by a few tenths rather
 *     than by the margin the argument above implies, and it did not hold at all
 *     until the West African monsoon term was made to fade out over the Sahel
 *     instead of holding a floor of 0.35 all the way to 22°N.
 *
 *  2. **The moisture usually arrives from somewhere else.** The land under the
 *     Gulf's record wet bulbs is hyper-arid: it evaporates nothing. The vapour
 *     comes off a shallow, enclosed sea sitting at 34 °C, blows onshore, and is
 *     then heated by the desert without losing any of its water — a wet-bulb
 *     temperature is nearly conserved when air is warmed over hot dry ground.
 *     The same mechanism runs the monsoon: July dew points on the Ganges plain
 *     are set by the Bay of Bengal, not by a plain that has been dry since
 *     March. So the humidity here has two sources — what the land evaporates
 *     (from the water-balance layer) and what the sea sends inland — and the
 *     model takes whichever is wetter.
 *
 *     The part of that which is derived is the *transport*: how far the sea
 *     reaches inland, what a monsoon imports, and what happens to a wet bulb
 *     when the air is heated over dry ground. The part that is not derived is
 *     how warm the sea is in the first place. That comes from `SEA_PATCHES`
 *     below, a hand-entered table of observed sea surface temperature
 *     anomalies, and the Gulf's place at the top of this ranking comes from
 *     that table rather than from any of the physics here: delete the twelve
 *     rectangles and Qatar falls 4.4 °C, Bahrain 4.6, and the top of the
 *     ranking reverts to hot dry interiors. The psychrometrics do not discover
 *     that the Persian Gulf is 5.5 °C warmer than the Indian Ocean at the same
 *     latitude. They are told.
 *
 *  3. **The hottest month is not the most dangerous month.** India's dry-bulb
 *     peak is May and its wet-bulb peak is July, when the monsoon has arrived
 *     and the air is several degrees cooler and far wetter; the Gulf's wet-bulb
 *     peak is August, a month behind its temperature peak, because it follows
 *     the sea rather than the sun. Reading the annual mean, or even the hottest
 *     month, misses both — so every month gets its own wet bulb and the year is
 *     scored on the worst of them. The model catches the Gulf's lag cleanly and
 *     only part of the monsoon's, because the temperature climatology it reads
 *     is a solar sinusoid; the correction for that is `EVAPORATIVE_COOLING_C`
 *     below, and it is not large enough to move India's hottest month all the
 *     way back to May.
 *
 * The climatology is not re-derived here. Monthly temperature, the daily
 * temperature range and the surface humidity all come from `drought.ts`, which
 * already runs a month-by-month soil-water account; this layer adds the
 * psychrometrics, the marine moisture source, a daily maximum, a day-count
 * distribution and the population behind it.
 */

/* -------------------------------------------------------------------------- */
/* Psychrometrics                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Saturation vapour pressure over water, kPa. Tetens / August–Roche–Magnus.
 *
 * This is the Clausius–Clapeyron curve that makes humid heat accelerate: it
 * climbs about 7% per °C, so a degree of warming adds far more water to a hot
 * air mass than to a cold one, and the wet bulb rises fastest exactly where it
 * is already highest.
 */
export function saturationVapourKPa(tempC: number): number {
  return 0.6108 * Math.exp((17.27 * tempC) / (tempC + 237.3))
}

/**
 * Wet-bulb temperature from dry-bulb temperature and relative humidity, °C.
 * Stull (2011), J. Appl. Meteor. Climatol. 50, 2267–2269.
 *
 * The exact wet bulb is the root of a transcendental psychrometric equation and
 * has to be iterated. Stull fitted this closed form to that root over the range
 * that matters for weather, and it is the standard shortcut in the humid-heat
 * literature: RMS error about 0.3 °C, worst case around 1 °C at the dry, cold
 * corner. Iterating the psychrometric equation instead was considered and
 * rejected — it costs a Newton loop per country per month per pathway commit,
 * for a correction smaller than the uncertainty in the humidity feeding it.
 *
 * The fit is valid for RH between 5% and 99% at roughly sea-level pressure, so
 * the inputs are clamped rather than extrapolated. Both clamps are domain
 * guards on the fit and neither is a modelling choice: swept over every country
 * and every pathway the 5% floor is never reached — the driest air this layer
 * produces is around 11% — and the 99% ceiling now binds only where the air is
 * genuinely at saturation, because the vapour feeding it is capped at
 * saturation before the ratio is taken. Lifting the driest air would in any
 * case bias the Sahara *upward*, which is the anti-conservative direction for a
 * layer whose central claim is that the Sahara is not where humid heat is
 * dangerous; the floor is kept only so that a caller passing zero humidity gets
 * a number from inside the fitted range rather than an extrapolation.
 *
 * A guard afterwards, because a plausible-looking wet bulb that is physically
 * impossible would quietly corrupt every day-count downstream: the wet bulb can
 * never exceed the dry bulb. It binds only near saturation.
 *
 * One known artefact, checked rather than assumed: swept over the whole range,
 * the fit is very slightly non-monotone in humidity — a wetter air mass coming
 * out with a marginally *lower* wet bulb — but only between about −20 °C and
 * +3 °C at humidities under 20%, by at most 0.28 °C. That is the cold, dry
 * corner Stull himself reports as his worst case, and it is nowhere near
 * anything this layer reads: at 10 °C and above there are no violations at all,
 * and a humid-heat peak below 10 °C is not a number anyone needs.
 */
export function wetBulbC(dryBulbC: number, relativeHumidity: number): number {
  const rh = Math.max(5, Math.min(99, relativeHumidity * 100))
  // Pressure is not an input to Stull's fit, and altitude is not available in
  // this app anyway — every country is modelled at sea level here exactly as it
  // is in the water-balance layer.
  const t = Math.max(-30, Math.min(60, dryBulbC))
  const tw =
    t * Math.atan(0.151977 * Math.sqrt(rh + 8.313659)) +
    Math.atan(t + rh) -
    Math.atan(rh - 1.676331) +
    0.00391838 * rh ** 1.5 * Math.atan(0.023101 * rh) -
    4.686035
  return Math.min(dryBulbC, tw)
}

/**
 * Wet bulb from the vapour pressure the air is actually carrying.
 *
 * Enforces its own precondition rather than trusting the caller: air cannot
 * hold more water than saturation at its own temperature, so the ratio handed
 * to Stull's fit is a relative humidity and not something above 1. The vapour
 * is already capped where the air mass is assembled in `buildHeatYear`; this is
 * the same bound restated at the only place that converts a vapour pressure
 * into a humidity, so the invariant survives a future caller.
 */
function wetBulbFromVapour(dryBulbC: number, vapourKPa: number): number {
  const sat = saturationVapourKPa(dryBulbC)
  if (!(sat > 0)) return wetBulbC(dryBulbC, 0)
  return wetBulbC(dryBulbC, Math.min(vapourKPa, sat) / sat)
}

/* -------------------------------------------------------------------------- */
/* The sea as a moisture source                                                */
/* -------------------------------------------------------------------------- */

/**
 * Warm-season (peak month) sea surface temperature of the open ocean, °C, by
 * signed latitude.
 *
 * Signed rather than absolute because the two hemispheres are not mirror
 * images: the southern subtropics are cooler at the same latitude, and the
 * Southern Ocean is colder than anything in the north outside the Arctic.
 */
const OPEN_OCEAN_WARM_SST: { lat: number; t: number }[] = [
  { lat: 80, t: 1 },
  { lat: 70, t: 6 },
  { lat: 60, t: 11 },
  { lat: 50, t: 16 },
  { lat: 40, t: 22 },
  { lat: 30, t: 26.5 },
  { lat: 20, t: 28.5 },
  { lat: 10, t: 29 },
  { lat: 0, t: 28.5 },
  { lat: -10, t: 28 },
  { lat: -20, t: 27 },
  { lat: -30, t: 23 },
  { lat: -40, t: 18 },
  { lat: -50, t: 11 },
  { lat: -60, t: 4 },
  { lat: -80, t: -1 },
]

function openOceanWarmSstC(lat: number): number {
  const t = Math.max(-80, Math.min(80, lat))
  for (let i = 0; i < OPEN_OCEAN_WARM_SST.length - 1; i++) {
    const a = OPEN_OCEAN_WARM_SST[i]
    const b = OPEN_OCEAN_WARM_SST[i + 1]
    if (t <= a.lat && t >= b.lat) {
      const u = (a.lat - t) / (a.lat - b.lat)
      return a.t + u * (b.t - a.t)
    }
  }
  return 15
}

/**
 * Observed sea surface temperature anomalies — a hand-entered lookup table, not
 * a derivation.
 *
 * This is the single most consequential thing in the file, and it is important
 * to be exact about what it is. Nothing in this layer computes an ocean. These
 * twelve rectangles are the warm-season SST of twelve seas, read off the
 * observational record and written down as a departure from the zonal mean,
 * exactly as `VERTICAL_LAND_MOTION_MM_YR` in `regionalSeaLevel.ts` and
 * `OBSERVED_BURNED_AREA_KM2` in `fire.ts` are observations written down. A
 * prescribed input is a legitimate thing for this app to carry. Presenting its
 * output as something the psychrometrics discovered would not be.
 *
 * So, plainly: **the Persian Gulf sits at the top of this ranking because this
 * table says the Persian Gulf is 5.5 °C warmer than the open ocean at 26°N.**
 * Ablate the table and Qatar drops 4.44 °C, Bahrain 4.56, Kuwait 4.49, the
 * United Arab Emirates 4.28, and the top of the ranking reverts to big hot
 * countries whose centroids are inland — China, India, Mexico, Myanmar,
 * Australia, none of which is a marginal sea. The physics downstream is real
 * and does real work: it decides how far that vapour penetrates, what the wet
 * bulb of it is once the desert has heated it, which month it peaks in, and how
 * many days a year cross each threshold. But the fact that the Gulf is the
 * dangerous place, rather than the Sahara, enters this model as data.
 *
 * The reason so much rides on a few degrees of SST is arithmetic: saturation
 * vapour pressure rises 7% per °C, so a sea running 5 °C above its zonal value
 * carries about 40% more water. A zonal SST alone puts Qatar and central Saudi
 * Arabia in the same climate, which is wrong by roughly 8 °C of wet bulb — and
 * with no way to know otherwise, a model of this shape would be wrong in the
 * direction that matters most.
 *
 * The warm entries are shallow, enclosed or semi-enclosed basins that heat like
 * a bathtub. The cold entries are the four great eastern-boundary upwelling
 * systems plus the Somali jet — cold water pulled to the surface, which is why
 * Lima and Walvis Bay sit in the tropics and are neither hot nor humid, and why
 * a latitude-only model would badly overstate them.
 *
 * Boxes rather than a coastline distance field, matching how `rain.ts` and
 * `drought.ts` already carry their regional exceptions, and evaluated at the
 * country's centroid — so they describe the sea a country sits *in*, and a
 * country whose middle is far inland gets no marine correction at all. Ordered:
 * the first box containing the centroid wins.
 */
interface SeaPatch {
  lat0: number
  lat1: number
  lng0: number
  lng1: number
  /** Warm-season SST relative to the open ocean at the same latitude, °C. */
  anomalyC: number
  /** Enclosed basins swing much further between winter and summer. */
  enclosed: boolean
}

const SEA_PATCHES: SeaPatch[] = [
  // Persian Gulf and Gulf of Oman: shallow, enclosed, ringed by desert, and
  // the warmest large body of open water on the planet in August. Drawn wider
  // than the water itself — down to 20°N for Oman, out to 60°E for Musandam,
  // and north-west over Mesopotamia, which is a sea-level basin open to the
  // Gulf head at Basra and shares its air. Saudi Arabia and Iran fall inside
  // the box and are unaffected by it anyway, because their centroids are far
  // enough from any coast that no marine air reaches them.
  { lat0: 20, lat1: 34, lng0: 42, lng1: 60, anomalyC: 5.5, enclosed: true },
  // Red Sea: narrow, enclosed, no river input, and hypersaline for the same
  // reason it is hot — it evaporates continuously.
  { lat0: 12, lat1: 30, lng0: 32, lng1: 44, anomalyC: 4, enclosed: true },
  // Mediterranean and Black Sea.
  { lat0: 30, lat1: 47, lng0: -6, lng1: 42, anomalyC: 3, enclosed: true },
  // Bay of Bengal and the Andaman Sea — the monsoon's own moisture reservoir.
  { lat0: 4, lat1: 25, lng0: 78, lng1: 100, anomalyC: 1.5, enclosed: false },
  // Kuroshio and the East China Sea: a western boundary current dragging
  // tropical water up to 40°N, and the reason a Tokyo or Seoul August is more
  // oppressive than anywhere in Europe at the same latitude. Stops short of
  // 120°E so that China, whose centroid is 2,000 km inland, is not handed it.
  { lat0: 24, lat1: 41, lng0: 120, lng1: 146, anomalyC: 4.5, enclosed: false },
  // South China Sea, Gulf of Thailand and the Indonesian seas.
  { lat0: -10, lat1: 25, lng0: 99, lng1: 128, anomalyC: 1.5, enclosed: false },
  // Gulf of Mexico and the Caribbean.
  { lat0: 8, lat1: 31, lng0: -98, lng1: -58, anomalyC: 1.5, enclosed: false },
  // Somali upwelling: the south-west monsoon drags cold water up the Horn,
  // which is why the Somali coast is arid and, for the tropics, mild.
  { lat0: 3, lat1: 14, lng0: 45, lng1: 58, anomalyC: -2.5, enclosed: false },
  // Humboldt: the strongest of the four, and the reason coastal Peru is desert.
  { lat0: -42, lat1: 0, lng0: -84, lng1: -69, anomalyC: -6.5, enclosed: false },
  // Benguela.
  { lat0: -34, lat1: -8, lng0: 4, lng1: 17, anomalyC: -5.5, enclosed: false },
  // California Current.
  { lat0: 25, lat1: 46, lng0: -132, lng1: -114, anomalyC: -4.5, enclosed: false },
  // Canary Current, off north-west Africa. Stops at 20°N because south of that
  // the upwelling is a winter phenomenon: by September the Senegalese coast is
  // under a 28 °C sea and the monsoon, and Dakar is among the most humid places
  // in West Africa rather than one of the mildest.
  { lat0: 20, lat1: 34, lng0: -20, lng1: -7, anomalyC: -3.5, enclosed: false },
]

function seaPatchAt(lat: number, lng: number): SeaPatch | null {
  for (const p of SEA_PATCHES) {
    if (lat >= p.lat0 && lat <= p.lat1 && lng >= p.lng0 && lng <= p.lng1) {
      return p
    }
  }
  return null
}

/**
 * Regions where the warm season runs on a persistent onshore flow, and how
 * deeply that flow penetrates.
 *
 * A coastal decay alone cannot describe a monsoon. Distance from the sea is the
 * right control on moisture in a place where the wind blows from any direction
 * — but for four months a year the South Asian, West African and East Asian
 * monsoons import a maritime boundary layer a thousand kilometres inland and
 * hold it there. Without this the model has Pakistan's Indus valley evaporating
 * its own humidity out of a desert, which it does not: Jacobabad's July dew
 * point comes off the Arabian Sea.
 *
 * The windows mirror the ones the rainfall and water-balance layers already
 * use, for the same stated reason — latitude alone cannot tell the monsoon from
 * the Sahara at the same 25°N.
 */
function monsoonPenetration(lat: number, lng: number): number {
  // South Asia: the deepest continental penetration of maritime air anywhere,
  // and it does not weaken northward, because the Himalaya stops the moist
  // layer from escaping and ponds it against the plain. It does weaken
  // *westward*, and sharply, which is the one edge of this window that has a
  // country sitting on it: the Arabian Sea branch turns inland over Sindh, and
  // west of the Indus the moist layer is broken by the Sulaiman and Hindu Kush
  // ranges into the intermittent "monsoon break" incursions that give eastern
  // Afghanistan a little July rain and central Afghanistan none. A hard edge at
  // 60°E put Afghanistan's centroid, in the mountains at 33.8°N 65.9°E, under
  // the full Bay-of-Bengal boundary layer and added 3.3 °C of wet bulb to a
  // country whose real peak is nearer 24 °C. Zero by 67°E rather than by 68°E
  // so that Afghanistan's centroid sits a clear degree outside rather than a
  // tenth of one, and full only by 70°E, which leaves Pakistan's centroid — in
  // the Sulaiman foothills, not in Sindh — at about two thirds.
  if (lat > 5 && lat < 35 && lng > 60 && lng < 95) {
    return 0.85 * Math.max(0, Math.min(1, (lng - 67) / 3))
  }
  // South-East Asia and the maritime continent.
  if (lat > -10 && lat < 25 && lng > 92 && lng < 150) return 0.85
  // The East Asian monsoon, which reaches Beijing but stops well short of the
  // interior: China's own centroid sits in Gansu, on the arid side of that
  // boundary, and a window drawn out to 92°E handed the Gobi the dew point of
  // the South China Sea.
  if (lat >= 25 && lat < 45 && lng > 105 && lng < 150) return 0.8
  // West Africa and the Sahel. This one weakens northward, sharply, and it has
  // to reach zero rather than a floor: the monsoon here is a wedge of moist air
  // a couple of kilometres deep sliding under the Saharan air layer, and it
  // thins as it goes. What this term imports is not the presence of monsoon air
  // but the *excess* dew point it carries over what the land underneath already
  // evaporates, and that excess is gone well before the air is. At 16°N in
  // August the Sahel's observed dew point is around 20 °C, which is what the
  // water balance here supplies on its own; the ITD is still 4° further north,
  // but by then the wedge is too shallow to raise it. A term that bottomed out
  // at 0.35 all the way to 22°N instead added 1.5 to 3 °C of dew point across
  // Sudan, Chad, Niger and Mali, and put all four above Bangladesh in a ranking
  // whose entire premise is that they should not be.
  if (lat > 4 && lat < 22 && lng > -18 && lng < 30) {
    return 0.9 * (1 - Math.max(0, Math.min(1, (lat - 10) / 6)))
  }
  // Central America, the Caribbean rim and the North American monsoon.
  if (lat > 5 && lat < 33 && lng > -112 && lng < -58) return 0.7
  // Northern Australia.
  if (lat > -22 && lat < -8 && lng > 112 && lng < 150) return 0.7
  return 0
}

/**
 * Relative humidity of air that has just crossed warm water, at the sea's own
 * temperature.
 *
 * The marine boundary layer sits near 80% — not 100%, because the surface layer
 * is continuously mixed with drier air from above. At a 34 °C sea that puts the
 * dew point near 30 °C, which is what coastal Gulf stations actually record in
 * August.
 */
const MARINE_RH = 0.8

/**
 * How much vapour pressure a fully wet land surface can add on top of what the
 * ocean upstream delivers, kPa.
 *
 * Calibrated on the mid-continental case that makes the point: the North
 * Atlantic off Iowa's latitude sits near 20 °C in August, which is a dew point
 * of about 17 °C, and an Iowa July afternoon runs 21 °C — the difference is a
 * continent's worth of transpiring crops under a capped boundary layer.
 */
const RECYCLED_VAPOUR_KPA = 0.7

/** Peak-to-trough seasonal swing of open ocean at a given latitude, °C. */
function openOceanSwingC(lat: number): number {
  return 1.5 + 6.5 * Math.min(1, Math.abs(lat) / 40)
}

/**
 * How strongly the coastal air temperature is pulled toward the sea's.
 *
 * The water-balance layer already applies maritime moderation, but it assumes
 * the moderating sea is an ordinary one. Where the adjacent sea is 5 °C above
 * its zonal value, "moderation" moderates toward something hot, and the warm
 * season over the coast ends up warmer, not cooler. This term is therefore a
 * correction to an assumption already being made, and it is exactly zero
 * wherever the sea is normal — it is not a second temperature climatology.
 */
const SEA_TEMPERATURE_PULL = 0.75

/* -------------------------------------------------------------------------- */
/* From a monthly mean to a daily maximum, and from there to a day count        */
/* -------------------------------------------------------------------------- */

/**
 * Share of the daily temperature range that the wet bulb actually sees.
 *
 * The daily wet-bulb maximum is not at the temperature maximum. Vapour is
 * roughly conserved through the day, so the wet bulb tracks the dry bulb — but
 * the afternoon boundary layer deepens and entrains dry air from above, which
 * takes vapour back out just as the temperature peaks. Observed daily maximum
 * wet bulbs therefore fall in the late morning or with the sea breeze, not at
 * 3 pm. Using the full range put every tropical coast about 1.5 °C too high.
 */
const DIURNAL_WET_FRACTION = 0.75

/** Fraction of the daily range above the daily mean. */
const HALF_RANGE = 0.5

/**
 * How much the surface cools itself when it has water to evaporate, °C per unit
 * of evaporative fraction, in the month of peak evaporative demand.
 *
 * The temperature climatology this layer reads is a plain sinusoid peaking at
 * the solstice, which is right for a surface whose wetness does not change
 * through the year and wrong for every monsoon climate on Earth. When the rains
 * arrive, the energy arriving at the ground starts leaving as latent heat
 * instead of sensible heat and the air temperature drops several degrees — the
 * reason India's hottest month is May and its wettest is July, and the reason
 * the Sahel cools in August while the sun is still overhead.
 *
 * That distinction is the whole third premise of this layer, so it cannot be
 * left out: without it the model puts the monsoon's humidity on top of the
 * pre-monsoon's temperature and invents a month that does not exist.
 *
 * Both the reference it is measured against and its own strength are weighted
 * by evaporative demand, and that is not a refinement — it is what stops the
 * term inverting. The evaporative fraction is a ratio of supply to demand, and
 * the water-balance layer pins it to 1 in any month whose demand is
 * negligible, because a frozen or rain-soaked winter is not a drought. Averaged
 * flat over twelve months that convention makes the annual reference far wetter
 * than any month with real demand, and the term then *adds* heat to the warm
 * month instead of removing it: measured at the peak month it was handing
 * Serbia +3.6 °C, Kazakhstan +3.2, Mongolia +3.2 and the United States +2.0 —
 * a monsoon-cooling term acting as a summer heater across exactly the dry
 * interiors this layer already reads too hot. Weighting by PET fixes both ends
 * at once: a month with no demand cannot pull the reference up, and it cannot
 * be corrected either, because there is no latent heat flux there to move.
 *
 * Scaling the strength by PET/PET-max and referencing the PET-weighted mean
 * also keeps the property the flat version was written for, and keeps it
 * exactly: the twelve corrections still sum to zero, so the term only moves
 * heat between months and never changes the annual mean the water-balance layer
 * supplies.
 */
const EVAPORATIVE_COOLING_C = 7

/**
 * Day-to-day standard deviation of the daily maximum wet bulb within a month.
 *
 * Day-counts, not the peak, are what this layer is for, and a day-count is an
 * integral over a distribution — a model that only carried a monthly mean would
 * have to answer "how many days above 31 °C" with either zero or thirty.
 *
 * The control is baroclinicity, not temperature: in the deep tropics the free
 * troposphere is uniform and a week of afternoons repeats itself to within a
 * degree, while in the mid-latitude westerlies a single frontal passage moves
 * the wet bulb several degrees. Continental interiors swing hardest because
 * they see the largest air-mass contrasts, and maritime and monsoon air the
 * least because the sea underneath it holds it steady. A dryness term was tried
 * here and dropped: it is not clear which way it should point, since dry air
 * has a large dry-bulb swing but a small wet-bulb response to it.
 */
function wetBulbSpreadC(
  lat: number,
  continental: number,
  marineWeight: number,
): number {
  const baroclinic = Math.max(0, Math.min(1, (Math.abs(lat) - 10) / 40))
  const raw = 0.75 + (0.9 + 0.9 * continental) * baroclinic
  // The maritime damping is itself a tropical effect and fades with the same
  // ramp: an island in the trade winds sees one air mass all summer, while
  // Britain gets Atlantic air one day and Saharan air the next and has a
  // *larger* spread than its size suggests. Damping it by coastline alone put
  // the United Kingdom's yearly peak four degrees low.
  return Math.max(0.55, raw * (1 - 0.4 * marineWeight * (1 - baroclinic)))
}

/**
 * P(X > z) for a standard normal. Abramowitz & Stegun 7.1.26, |error| < 7.5e-8.
 *
 * Accuracy in the far tail is what matters here, not near the middle: today's
 * 35 °C day-counts are all deep-tail numbers, and they should come out as
 * essentially zero rather than as a rounding artefact.
 */
function normalTail(z: number): number {
  const a = Math.abs(z)
  const t = 1 / (1 + 0.2316419 * a)
  const d = 0.3989422804014327 * Math.exp((-a * a) / 2)
  const p =
    d *
    t *
    (0.31938153 +
      t *
        (-0.356563782 +
          t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))))
  return z >= 0 ? p : 1 - p
}

/* -------------------------------------------------------------------------- */
/* One year of humid heat                                                      */
/* -------------------------------------------------------------------------- */

/** Twelve months of daily-maximum wet bulb, with the spread around each. */
interface HeatYear {
  /** Mean daily-maximum wet bulb in each month, °C. */
  wetC: Float64Array
  /** Day-to-day spread of that maximum, °C. */
  spreadC: Float64Array
  /** Mean daily-maximum dry bulb in each month, °C. */
  dryC: Float64Array
  /** Vapour pressure the air carries that month, kPa. */
  vapourKPa: Float64Array
  /** True in months where the sea supplied more of the vapour than the land. */
  marineFed: Uint8Array
}

function makeHeatYear(): HeatYear {
  return {
    wetC: new Float64Array(12),
    spreadC: new Float64Array(12),
    dryC: new Float64Array(12),
    vapourKPa: new Float64Array(12),
    marineFed: new Uint8Array(12),
  }
}

/** Everything about a country's moisture supply that the pathway cannot move. */
interface MoistureGeo {
  lat: number
  lng: number
  continental: number
  /** 0 where the local sea never reaches the country's middle, 1 at the shore. */
  coastReach: number
  /** How much maritime air the monsoon imports, at the height of the wet season. */
  monsoonReach: number
  /** Warm-season SST anomaly of the adjacent sea vs its latitude, °C. */
  seaAnomalyC: number
  /** Peak-to-trough swing of that sea through the year, °C. */
  seaSwingC: number
}

/**
 * Vapour supply geometry for one country.
 *
 * `pctBelow5m` doubles as the test for whether a country has a coast at all: it
 * is the measured share of land below 5 m, and it is exactly zero for every
 * landlocked country in the dataset. That test is worth having because the
 * continentality estimate — area ÷ perimeter, shared with the warming layer —
 * describes compactness, not distance to the sea, so a small landlocked country
 * such as Switzerland or Rwanda otherwise reads as fully maritime and gets
 * handed a sea it does not have.
 */
function moistureGeo(feature: CountryFeature): MoistureGeo {
  const { lat, lng } = countryCentroid(feature)
  const continental = continentality(feature)
  const hasCoast = (feature.__risk?.pctBelow5m ?? 0) > 0
  const patch = seaPatchAt(lat, lng)
  return {
    lat,
    lng,
    continental,
    // Raised to a power so the decay inland is faster than linear: marine air
    // is mixed out over a few hundred kilometres unless something keeps
    // pushing it, which is what the monsoon term is for.
    coastReach: hasCoast ? (1 - continental) ** 1.4 : 0,
    monsoonReach: monsoonPenetration(lat, lng),
    seaAnomalyC: patch?.anomalyC ?? 0,
    // Enclosed basins have little water to buffer them and swing far harder
    // through the year: the Persian Gulf runs from about 20 °C in February to
    // 34 °C in August, which no stretch of open ocean at 26°N does.
    seaSwingC:
      (1.5 + 6.5 * Math.min(1, Math.abs(lat) / 40)) * (patch?.enclosed ? 1.8 : 1),
  }
}

/**
 * Fill one year of daily-maximum wet bulbs.
 *
 * `fullCoast` runs the same climate with the local sea reaching it completely,
 * which is the low coastal strip rather than the country. Running the year
 * twice is what lets this layer say something about where the people are and
 * not only about where the centroid is — and for a landlocked country the two
 * runs are identical, since there is no sea to reach it either way.
 */
function buildHeatYear(
  trace: MonthlyTrace,
  geo: MoistureGeo,
  dtrBaseC: number,
  rainShare: number[],
  hottestMonth: number,
  sstAnomalyC: number,
  fullCoast: boolean,
  out: HeatYear,
): void {
  const localCoast = fullCoast && geo.coastReach > 0 ? 1 : geo.coastReach
  // The sea lags the sun by about a month, so its peak sits after the land's.
  const seaPeakPhase = (hottestMonth + 0.5) / 12 + 1 / 12
  const zonalWarmSst = openOceanWarmSstC(geo.lat)
  const warmSst = zonalWarmSst + geo.seaAnomalyC + sstAnomalyC
  // The monsoon's moisture is picked up over the tropical ocean upstream, not
  // over whatever water happens to sit next to the country's centroid — the
  // Ganges plain is fed from the Bay of Bengal, and the Sahel from the Gulf of
  // Guinea, both well equatorward of the land they soak.
  const tropicalLat = geo.lat >= 0 ? Math.min(geo.lat, 12) : Math.max(geo.lat, -12)
  const warmTropicalSst =
    openOceanWarmSstC(tropicalLat) + Math.max(0, geo.seaAnomalyC) + sstAnomalyC

  // The evaporative-cooling reference, weighted by the demand behind each
  // month's evaporative fraction rather than by the calendar. See
  // `EVAPORATIVE_COOLING_C`: a flat twelve-month mean lets months with no
  // demand — where the fraction is pinned to 1 by convention — set the
  // reference for the ones that have it.
  let petTotal = 0
  let petMax = 0
  let efWeighted = 0
  // `petMm` is optional on the trace, since the fire model has no use for it.
  // Both traces in this file always carry it; the fallback to a flat weight is
  // there so a future caller that forgets gets the old behaviour rather than a
  // silent divide by an empty array.
  const pet = trace.petMm
  for (let m = 0; m < 12; m++) {
    const p = pet ? pet[m] : 1
    petTotal += p
    if (p > petMax) petMax = p
    efWeighted += p * trace.evaporativeFraction[m]
  }
  const efReference = petTotal > 0 ? efWeighted / petTotal : 0
  // Zero over ice, where there is no demand in any month and so nothing to
  // redistribute.
  const demandScale = petMax > 0 ? 1 / petMax : 0

  for (let m = 0; m < 12; m++) {
    const phase = (m + 0.5) / 12
    // 1 at the sea's warmest, 0 at its coldest.
    const season = (1 + Math.cos(2 * Math.PI * (phase - seaPeakPhase))) / 2
    const localSstC = warmSst - geo.seaSwingC * (1 - season)
    const tropicalSstC = warmTropicalSst - 2.5 * (1 - season)
    // The ordinary ocean at this latitude — the background the westerlies
    // deliver to every continent whether or not it has a coast of its own.
    // No enclosed-basin multiplier here: this is open water by definition.
    const zonalSstC =
      zonalWarmSst - openOceanSwingC(geo.lat) * (1 - season)

    // A wet, cloudy month has a compressed daily range — the same reasoning and
    // the same coefficient the water-balance layer uses for its PET term.
    const share = Math.max(0.3, Math.min(1.8, rainShare[m] * 12))
    const dtr = Math.max(3, dtrBaseC * (1 + 0.18 * (1 - share)))

    // Two corrections to the sinusoid, both of which move heat around the year
    // rather than adding any: the surface cools itself in the months it has
    // water to evaporate, and where the sea is anomalously warm or cold the
    // coastal warm season goes with it. The first is at full strength in the
    // month of peak evaporative demand and fades to nothing in a month with no
    // demand, which is what makes the twelve corrections sum to zero.
    const evapDemand = (pet ? pet[m] : 1) * demandScale
    const meanC =
      trace.tempC[m] -
      EVAPORATIVE_COOLING_C *
        evapDemand *
        (trace.evaporativeFraction[m] - efReference) +
      SEA_TEMPERATURE_PULL * localCoast * geo.seaAnomalyC * season
    const dryMaxC = meanC + HALF_RANGE * dtr * DIURNAL_WET_FRACTION

    // What the land itself puts into the air: the water-balance layer's own
    // humidity, which responds to whether the surface can still meet demand.
    const landVapour = surfaceHumidity(trace.evaporativeFraction[m]) *
      saturationVapourKPa(meanC)
    const localSeaVapour = MARINE_RH * saturationVapourKPa(localSstC)
    const tropicalSeaVapour = MARINE_RH * saturationVapourKPa(tropicalSstC)
    // A month is monsoonal in proportion to how far its rainfall runs above an
    // even twelfth of the year — which is exactly the seasonality the
    // water-balance layer already assigns by climate regime, read back rather
    // than re-invented.
    const monsoonNow =
      geo.monsoonReach *
      Math.max(0, Math.min(1, (rainShare[m] * 12 - 1) / 0.8))

    // Continental air, and the ceiling on it. Every gram of water over land
    // evaporated from a sea surface somewhere upstream — the westerlies deliver
    // it, the land recycles it, and recycling returns water without creating
    // any. So the continental boundary layer cannot carry more than the ocean
    // at its own latitude plus what the surface itself is currently putting
    // back. The mechanism it guards against is that the humidity read back from
    // the water balance is a fraction of saturation at the local air
    // temperature: wherever that temperature runs warm the implied vapour runs
    // warm too, and Clausius–Clapeyron turns a 4 °C error into a 30% one.
    //
    // Measured rather than assumed, because this cap has been described in this
    // file as rescuing places it does not touch. Removing it moves 61 of 241
    // countries, by 0.07 °C averaged over all of them. It does nothing at all
    // for the dry subtropics — Saudi Arabia, Afghanistan, Libya, Chad, Niger,
    // Sudan, Egypt, Mongolia and Ethiopia are bit-identical without it, and so
    // are all four Gulf states. Where it earns its place is the *wet* warm
    // interiors, where the water balance has plenty of water and the sinusoid
    // has the temperature a degree or two high: Russia 2.06 °C, Brazil 1.69,
    // China 1.32, the United States 1.08, India 0.37. Without it China outranks
    // India and Brazil joins the top ten.
    //
    // The recycling allowance is scaled by the same ramp out of the tropics
    // that the day-to-day spread uses, and for the same physical reason: in the
    // deep tropics convection ventilates the boundary layer as fast as the
    // surface can moisten it, so the dew point stays pinned to the ocean's and
    // the Amazon sits at the 24–25 °C actually observed. In the mid-latitudes
    // the boundary layer caps instead, the moisture accumulates under it, and
    // an Iowa July genuinely runs several degrees of dew point above the
    // ocean feeding it.
    const ventilated = Math.max(0, Math.min(1, (Math.abs(geo.lat) - 10) / 40))
    const zonalSeaVapour =
      MARINE_RH * saturationVapourKPa(zonalSstC + sstAnomalyC)
    const continentalVapour = Math.min(
      landVapour,
      zonalSeaVapour +
        RECYCLED_VAPOUR_KPA * trace.evaporativeFraction[m] * ventilated,
    )

    // Mixing, not replacement: marine air entrains continental air on the way
    // in, so the vapour lands between the two sources rather than switching.
    // Whichever marine source reaches furthest wins; they are alternatives, not
    // additions, since it is the same boundary layer either way.
    const marineWeight = Math.max(localCoast, monsoonNow)
    const marineVapour =
      localCoast >= monsoonNow ? localSeaVapour : tropicalSeaVapour
    const marineGain = marineWeight * Math.max(0, marineVapour - continentalVapour)
    // Capped at saturation for the air it is arriving into, because the two
    // sources are not both local: the marine terms carry the vapour pressure of
    // air that sat over a sea, and nothing above stops that number landing over
    // ground colder than the sea it came from. Uncapped, the winter months of
    // every maritime country assembled a supersaturated air mass — swept across
    // all eleven pathways the largest implied humidity was 695% — which is a
    // state that cannot exist and would have rained out on the way in.
    //
    // Worth being exact about what this fixes, since the point of the exercise
    // is not to claim more than the code does: it changes no output at all.
    // Every one of those states was already truncated by the 99% ceiling inside
    // Stull's fit, so the wet bulbs, the day-counts and the peaks are
    // bit-identical with the cap and without it — checked over 225,335 output
    // fields across every country, pathway and year. What it fixes is that
    // `vapourKPa` below is now a physical air mass rather than a number that
    // only looked sane after something downstream clamped it, which is what any
    // future reader of it will assume.
    const vapourKPa = Math.min(
      continentalVapour + marineGain,
      saturationVapourKPa(dryMaxC),
    )

    out.dryC[m] = dryMaxC
    out.vapourKPa[m] = vapourKPa
    out.wetC[m] = wetBulbFromVapour(dryMaxC, vapourKPa)
    out.spreadC[m] = wetBulbSpreadC(geo.lat, geo.continental, marineWeight)
    // "Marine-fed" is a claim about a specific and narrow case: a dry land
    // under a wet sea, where more than half the water in the air came off the
    // sea rather than out of the ground. A threshold of "any marine gain at
    // all" flagged Egypt's 23%-humidity July as sea-fed, which is true in
    // provenance and badly misleading as a sentence.
    //
    // Narrow is the word. Swept over every country this fires for eight of
    // them — the Gulf states, Jordan, Israel, Palestine and Tunisia — and it
    // does not fire for Oman, Iran, Saudi Arabia, Bangladesh or India, which
    // are the countries this file's own narrative is built on. Both halves of
    // that are the flag working as defined rather than failing. It is evaluated
    // at the country's centroid, so Oman's and Iran's centroids are too far
    // inland for the sea to reach them at all and it is their *coasts* that are
    // marine-fed — which is what `coastalPeakWetBulbC` is for, and it is 2.9 °C
    // above Oman's national figure and 5.4 °C above Iran's. Bangladesh and
    // India fail it for the opposite reason: their own ground is wet enough to
    // supply most of the vapour itself. Anything user-facing that reads this
    // flag has to say the narrow thing, not the general one.
    out.marineFed[m] = marineGain > continentalVapour ? 1 : 0
  }
}

/** Relative humidity of month `m` at its daily maximum temperature, 0–1. */
function monthHumidity(year: HeatYear, m: number): number {
  const sat = saturationVapourKPa(year.dryC[m])
  return sat > 0 ? Math.max(0.02, Math.min(1, year.vapourKPa[m] / sat)) : 0.02
}

/** Hottest dry bulb Stull's fit is defined over — the clamp inside `wetBulbC`. */
const DRY_BULB_FIT_MAX_C = 60

/**
 * The dry bulb that produces a given wet bulb at a given relative humidity.
 *
 * Stull's fit inverts only numerically, but it is monotone in temperature at
 * fixed humidity, so a bisection over the range the fit covers is exact enough
 * and costs one country one loop rather than one per month.
 *
 * "The range the fit covers" is the part that has to be respected rather than
 * assumed. `wetBulbC` clamps its dry bulb at 60 °C, so above that the fit is a
 * flat line and bisecting past it is bisecting on a constant: a bracket of
 * `target + 45` therefore never satisfied its own predicate at low humidity and
 * returned that upper bound as if it were a root, printing dry bulbs in the
 * eighties. Bracketing on the fit's own domain and testing the top end first
 * makes an unattainable pair say so — it returns the hottest dry bulb the fit
 * knows about, which is a lower bound on the answer rather than an invention.
 *
 * That branch is not unreachable, so it was worth checking rather than
 * assuming. Swept over all 241 countries, all eleven pathways and every year
 * they carry, it fires four times: Saudi Arabia, Libya, Algeria and Russia on
 * the runaway pathway at 2300. A wet bulb near 38 °C at 20% humidity is not a
 * state any air mass reaches, and what those four cases mean is that the
 * once-a-year peak and the peak month's mean humidity have stopped being a
 * consistent pair that far out. The guard keeps the country card from printing
 * an 84 °C afternoon; it does not make those two numbers agree.
 */
function dryBulbForWetBulb(targetWetC: number, humidity: number): number {
  if (wetBulbC(DRY_BULB_FIT_MAX_C, humidity) < targetWetC) {
    return DRY_BULB_FIT_MAX_C
  }
  let lo = Math.min(targetWetC, DRY_BULB_FIT_MAX_C)
  let hi = DRY_BULB_FIT_MAX_C
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2
    if (wetBulbC(mid, humidity) < targetWetC) lo = mid
    else hi = mid
  }
  return Math.max(targetWetC, (lo + hi) / 2)
}

/** Expected days per year on which the daily maximum wet bulb exceeds `thresholdC`. */
function daysAbove(year: HeatYear, thresholdC: number): number {
  let days = 0
  for (let m = 0; m < 12; m++) {
    days += MONTH_DAYS[m] * normalTail((thresholdC - year.wetC[m]) / year.spreadC[m])
  }
  return days
}

/**
 * The wet bulb reached on about one day a year.
 *
 * Defined through `daysAbove` rather than as "the worst month plus two sigma"
 * so that the headline number and the day-counts are the same statement about
 * the same distribution — a peak that disagreed with its own exceedance curve
 * would be worse than no peak at all. Bisection, because `daysAbove` is
 * monotone in the threshold and 22 halvings of a 30 °C bracket resolve it far
 * past the precision of anything feeding it.
 */
function onceAYearWetBulbC(year: HeatYear): number {
  let hottest = -Infinity
  let widest = 1
  for (let m = 0; m < 12; m++) {
    if (year.wetC[m] > hottest) hottest = year.wetC[m]
    if (year.spreadC[m] > widest) widest = year.spreadC[m]
  }
  let lo = hottest - 4 * widest
  let hi = hottest + 6 * widest
  for (let i = 0; i < 22; i++) {
    const mid = (lo + hi) / 2
    if (daysAbove(year, mid) > 1) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/* -------------------------------------------------------------------------- */
/* Habitability                                                                */
/* -------------------------------------------------------------------------- */

export type HabitabilityBand =
  | 'mild'
  | 'warm'
  | 'straining'
  | 'labour-limited'
  | 'rest-limited'
  | 'beyond-survivable'

export const HABITABILITY_ORDER: HabitabilityBand[] = [
  'mild',
  'warm',
  'straining',
  'labour-limited',
  'rest-limited',
  'beyond-survivable',
]

/**
 * Bands on the once-a-year wet bulb.
 *
 * The three upper boundaries are not invented: 28 °C is roughly where sustained
 * outdoor labour becomes unsafe even for an acclimatised worker, 31 °C is where
 * the danger no longer needs exertion and reaches the old, the ill and the very
 * young at rest, and 35 °C is the theoretical limit at which a resting human
 * cannot shed metabolic heat at all. The two lower ones separate the temperate
 * world, which would otherwise all land in one band and tell the reader nothing
 * about how far it has to move.
 *
 * Worth knowing about the 35 °C figure: it is a thermodynamic bound, not an
 * observed one. Chamber experiments on young healthy adults put the critical
 * environmental limit nearer 30–31 °C wet bulb in humid conditions, because a
 * real body generates heat, wears clothes and does not have a perfectly wetted
 * skin. So the `rest-limited` band is already past the measured limit, and
 * `beyond-survivable` is past the point where the physics leaves no route at
 * all.
 */
export function habitabilityBand(peakWetBulbC: number): HabitabilityBand {
  if (!Number.isFinite(peakWetBulbC)) return 'mild'
  if (peakWetBulbC < 22) return 'mild'
  if (peakWetBulbC < 26) return 'warm'
  if (peakWetBulbC < 28) return 'straining'
  if (peakWetBulbC < 31) return 'labour-limited'
  if (peakWetBulbC < 35) return 'rest-limited'
  return 'beyond-survivable'
}

const BAND_LABEL: Record<HabitabilityBand, string> = {
  mild: 'Humid heat is not the limit',
  warm: 'Hot, but sweat still works',
  straining: 'Heavy outdoor work strained',
  'labour-limited': 'Outdoor work unsafe at peak',
  'rest-limited': 'Dangerous even at rest',
  'beyond-survivable': 'Past survivable without cooling',
}

const BAND_BLURB: Record<HabitabilityBand, string> = {
  mild: 'The yearly wet-bulb peak stays below 22 °C. Heat waves here are a dry-bulb problem, not a humidity one.',
  warm: 'Peaks of 22 to 26 °C. Uncomfortable, and enough to matter for the elderly indoors, but evaporation still carries the heat away.',
  straining:
    'Peaks of 26 to 28 °C. Sustained heavy labour has to slow down or move out of the afternoon; this is where work-rest guidance starts to bite.',
  'labour-limited':
    'Peaks of 28 to 31 °C. Outdoor work at the height of the season is unsafe for anyone, however fit or acclimatised. Field labour, construction and fishing all lose hours.',
  'rest-limited':
    'Peaks of 31 to 35 °C. Past the limit measured in laboratory chambers, so a person at rest in the shade is no longer safe. Survival depends on cooling that runs on electricity.',
  'beyond-survivable':
    'Peaks at or above 35 °C. At skin temperature, sweat evaporates nothing and core temperature rises regardless of shade, water or fitness. Hours of exposure are fatal.',
}

export function habitabilityLabel(band: HabitabilityBand): string {
  return BAND_LABEL[band]
}

export function habitabilityBlurb(band: HabitabilityBand): string {
  return BAND_BLURB[band]
}

/* -------------------------------------------------------------------------- */
/* Public model                                                                */
/* -------------------------------------------------------------------------- */

export interface CountryHumidHeat {
  /** Wet bulb reached on about one day a year, °C — today's climate and this pathway's. */
  baselinePeakWetBulbC: number
  peakWetBulbC: number
  deltaPeakC: number
  /** Dry bulb and relative humidity in the month that peak falls in. */
  peakDryBulbC: number
  peakHumidity: number
  /** Month of the wet-bulb peak, and of the plain temperature peak. 0 = January. */
  peakMonth: number
  hottestMonth: number
  /** True where the most dangerous month is not the hottest month. */
  humidPeakOffHottest: boolean
  /**
   * True where the sea supplied more of the vapour than the land did, at the
   * peak month and at the country's centroid. A narrow test: it holds for eight
   * countries, all of them small and dry with a warm sea beside them. Not
   * holding is not evidence that a country is not sea-fed — see the note where
   * it is set.
   */
  marineFed: boolean
  /** Days per year above each wet-bulb threshold, today and under this pathway. */
  baselineDaysAbove28: number
  baselineDaysAbove31: number
  baselineDaysAbove35: number
  daysAbove28: number
  daysAbove31: number
  daysAbove35: number
  /**
   * The same peak evaluated for the low coastal strip, where marine air reaches
   * fully — and the population-weighted blend of the two, which is the figure
   * the exposure counts are banded on.
   *
   * The blend is a country-level number split two ways by one measured share,
   * not a sub-national model. It moves the peak by more than 0.05 °C for 66
   * countries, is worth saying out loud on 14 of them, and changes which
   * habitability band a country lands in for three: Oman, Iraq and Egypt —
   * centroids in the Rub al Khali, the Jazira and the Western Desert, people on
   * the Gulf, the Shatt al-Arab and the Nile. Those are the same countries the
   * layer misses hardest, and the gap is the whole story there: Iran 5.4 °C,
   * Iraq 4.8, Egypt 4.5, Oman 2.9. Kept for them; skipped entirely for the 142
   * countries where it cannot differ from the land run.
   */
  coastalPeakWetBulbC: number
  peoplePeakWetBulbC: number
  band: HabitabilityBand
  /** Band the country's own centroid climate falls in, before the coastal weighting. */
  landBand: HabitabilityBand
  /** Population in millions, and the share of it below 5 m. */
  populationM: number
  coastalPopShare: number
}

// Scratch space, reused across countries. The model is synchronous and each
// result is read out before the next call starts — the same trick the fire
// model uses, and for the same reason: this runs for ~240 countries on every
// timeline commit and the allocation would be the measurable part.
// `petMm` is asked for here and nowhere else in the app: this is the only layer
// that needs to know how much demand stood behind each month's evaporative
// fraction, and the water balance only fills the array when a caller supplies
// one.
const BASE_TRACE: MonthlyTrace = {
  tempC: new Float64Array(12),
  aetMm: new Float64Array(12),
  evaporativeFraction: new Float64Array(12),
  snowPackMm: new Float64Array(12),
  petMm: new Float64Array(12),
}
const FUTURE_TRACE: MonthlyTrace = {
  tempC: new Float64Array(12),
  aetMm: new Float64Array(12),
  evaporativeFraction: new Float64Array(12),
  snowPackMm: new Float64Array(12),
  petMm: new Float64Array(12),
}
const BASE_YEAR = makeHeatYear()
const FUTURE_YEAR = makeHeatYear()
const FUTURE_COAST_YEAR = makeHeatYear()

// Same reasoning as the drought layer's `geoCache`: none of this changes with
// the pathway, and `geoCentroid` over a 50m outline is far too costly to redo
// for every country on every commit.
const geoCache = new WeakMap<CountryFeature, MoistureGeo>()
const climateCache = new WeakMap<CountryFeature, ClimateGeo>()

function cachedMoistureGeo(feature: CountryFeature): MoistureGeo {
  const hit = geoCache.get(feature)
  if (hit) return hit
  const geo = moistureGeo(feature)
  geoCache.set(feature, geo)
  return geo
}

function cachedClimateGeo(feature: CountryFeature, geo: MoistureGeo): ClimateGeo {
  const hit = climateCache.get(feature)
  if (hit) return hit
  const climate = climateGeoAt(geo.lat, geo.lng, geo.continental)
  climateCache.set(feature, climate)
  return climate
}

/**
 * How much the sea warms under a pathway, °C.
 *
 * The ocean warms more slowly than the land — it mixes heat downward and it
 * evaporates — so scaling it by the country's own land warming would overstate
 * it badly. The global mean already includes the ocean, and the ocean runs a
 * little under it. A stalled Atlantic circulation then takes heat out of the
 * water directly, which is where that cooling originates, so it is subtracted
 * almost in full rather than damped.
 */
function seaWarmingC(
  lat: number,
  lng: number,
  globalWarmingC: number,
  baselineGlobalC: number,
  physics: ScenarioPhysics,
): number {
  const extra = globalWarmingC - baselineGlobalC
  return 0.85 * extra - 0.9 * amocCoolingC(lat, lng, physics.amocWeakening)
}

/**
 * Humid heat for one country, with its temperature and rainfall already
 * resolved. Split out for the same reason the water balance is: a caller that
 * has already paid for both should not pay again.
 */
export function humidHeatFromClimate(
  feature: CountryFeature,
  temp: CountryTemp,
  rain: CountryRain,
  globalWarmingC: number,
  physics: ScenarioPhysics,
  baselineGlobalC: number,
): CountryHumidHeat {
  const geo = cachedMoistureGeo(feature)
  const climate = cachedClimateGeo(feature, geo)
  const baseMeanC = annualMeanTempC(geo.lat, geo.continental)
  const futureMeanC = baseMeanC + temp.deltaSince2020C

  const baseDtr = dailyTempRangeC(rain.baselineMm, geo.continental)
  const futureDtr = dailyTempRangeC(rain.futureMm, geo.continental)
  // Run for the monthly trace, not for the balance totals: what this layer
  // needs from the water account is the month-by-month temperature and the
  // month-by-month evaporative fraction behind the surface humidity.
  monthlyBalance(climate, baseMeanC, rain.baselineMm, baseDtr, BASE_TRACE)
  monthlyBalance(climate, futureMeanC, rain.futureMm, futureDtr, FUTURE_TRACE)

  // The sea lags the sun, so its cycle is anchored to the solar peak rather
  // than to the month the surface actually ends up hottest — which, in a
  // monsoon climate, is a different month entirely.
  let solarPeakMonth = 0
  for (let m = 1; m < 12; m++) {
    if (BASE_TRACE.tempC[m] > BASE_TRACE.tempC[solarPeakMonth]) solarPeakMonth = m
  }

  const sstAnomalyC = seaWarmingC(
    geo.lat,
    geo.lng,
    globalWarmingC,
    baselineGlobalC,
    physics,
  )

  buildHeatYear(
    BASE_TRACE,
    geo,
    baseDtr,
    climate.rainShare,
    solarPeakMonth,
    0,
    false,
    BASE_YEAR,
  )
  buildHeatYear(
    FUTURE_TRACE,
    geo,
    futureDtr,
    climate.rainShare,
    solarPeakMonth,
    sstAnomalyC,
    false,
    FUTURE_YEAR,
  )
  // The coastal variant: the same climate with the local sea reaching it in
  // full. For Iran, Iraq, Egypt or Oman that is a different country entirely —
  // 4 to 5 °C of wet bulb between the centroid and the shore. For a country
  // with no coast, or one already fully reached by its own sea, the run is
  // arithmetically identical to the land run, and skipping it there is free:
  // 142 of 241 countries never needed it, and it was the most expensive single
  // thing this layer did.
  const coastalDiffers = geo.coastReach > 0 && geo.coastReach < 1
  if (coastalDiffers) {
    buildHeatYear(
      FUTURE_TRACE,
      geo,
      futureDtr,
      climate.rainShare,
      solarPeakMonth,
      sstAnomalyC,
      true,
      FUTURE_COAST_YEAR,
    )
  }

  // Read the hottest month off the corrected dry bulb, not off the sinusoid:
  // the whole point of the comparison the panel draws is that in a monsoon
  // climate the most dangerous month and the hottest month are not the same
  // one, and comparing against the solar peak would hide exactly that.
  let peakMonth = 0
  let hottestMonth = 0
  for (let m = 1; m < 12; m++) {
    if (FUTURE_YEAR.wetC[m] > FUTURE_YEAR.wetC[peakMonth]) peakMonth = m
    if (FUTURE_YEAR.dryC[m] > FUTURE_YEAR.dryC[hottestMonth]) hottestMonth = m
  }

  const baselinePeakWetBulbC = onceAYearWetBulbC(BASE_YEAR)
  const peakWetBulbC = onceAYearWetBulbC(FUTURE_YEAR)
  const coastalPeakWetBulbC = coastalDiffers
    ? onceAYearWetBulbC(FUTURE_COAST_YEAR)
    : peakWetBulbC

  const risk = feature.__risk
  const iso3 = risk?.iso3 ?? null
  // No fallback for a missing population. A density guess is fine for burned
  // area, which is an area; it is not fine for a headcount, where inventing
  // people would silently inflate the one total this layer exists to report.
  const populationM = iso3 ? (POPULATION_M[iso3] ?? 0) : 0
  const coastalPopShare = Math.max(
    0,
    Math.min(1, (risk?.popPctBelow5m ?? 0) / 100),
  )
  // The country average is a fiction for anyone in particular; the split
  // between the coastal lowland and the rest is at least the right kind of
  // fiction, because that measured population share is the one piece of
  // sub-national information this app has.
  const peoplePeakWetBulbC =
    peakWetBulbC + coastalPopShare * (coastalPeakWetBulbC - peakWetBulbC)

  // The dry bulb on the day the wet bulb peaks — not the month's mean daily
  // maximum, which is a different day and can be *below* the yearly extreme
  // wet bulb. Printing that pair would show a wet bulb above a dry bulb, which
  // is thermodynamically impossible and would rightly destroy a reader's trust
  // in the rest of the layer. Solved at the month's own relative humidity: an
  // extreme day is both hotter and wetter than the month's average one, so
  // holding the ratio and raising both is the honest reading of it.
  const peakHumidity = monthHumidity(FUTURE_YEAR, peakMonth)
  const peakDryBulbC = dryBulbForWetBulb(peakWetBulbC, peakHumidity)

  return {
    baselinePeakWetBulbC,
    peakWetBulbC,
    deltaPeakC: peakWetBulbC - baselinePeakWetBulbC,
    peakDryBulbC,
    peakHumidity,
    peakMonth,
    hottestMonth,
    humidPeakOffHottest: peakMonth !== hottestMonth,
    marineFed: FUTURE_YEAR.marineFed[peakMonth] === 1,
    baselineDaysAbove28: daysAbove(BASE_YEAR, 28),
    baselineDaysAbove31: daysAbove(BASE_YEAR, 31),
    baselineDaysAbove35: daysAbove(BASE_YEAR, 35),
    daysAbove28: daysAbove(FUTURE_YEAR, 28),
    daysAbove31: daysAbove(FUTURE_YEAR, 31),
    daysAbove35: daysAbove(FUTURE_YEAR, 35),
    coastalPeakWetBulbC,
    peoplePeakWetBulbC,
    band: habitabilityBand(peoplePeakWetBulbC),
    landBand: habitabilityBand(peakWetBulbC),
    populationM,
    coastalPopShare,
  }
}

export function estimateCountryHumidHeat(
  feature: CountryFeature,
  globalWarmingC: number,
  physics: ScenarioPhysics = NEUTRAL_PHYSICS,
  baselineGlobalC = 1.15,
): CountryHumidHeat {
  return humidHeatFromClimate(
    feature,
    estimateCountryTemp(feature, globalWarmingC, physics, baselineGlobalC),
    estimateCountryRain(feature, globalWarmingC, physics, baselineGlobalC),
    globalWarmingC,
    physics,
    baselineGlobalC,
  )
}

/* -------------------------------------------------------------------------- */
/* Presentation                                                                */
/* -------------------------------------------------------------------------- */

export function formatWetBulbC(c: number): string {
  if (!Number.isFinite(c)) return '—'
  return `${c.toFixed(1)}°C`
}

/**
 * Day-counts, rounded to what the model can actually claim.
 *
 * Below half a day a year the number is a Gaussian tail, not a count of
 * anything, and printing "0.3 days" would dress a tail probability up as an
 * observation.
 */
export function formatHeatDays(days: number): string {
  if (!Number.isFinite(days) || days < 0.5) return 'none'
  if (days < 10) return `${days.toFixed(0)} days`
  return `${Math.round(days)} days`
}

/** People, in millions or billions. */
export function formatPeopleM(millions: number): string {
  if (!Number.isFinite(millions) || millions <= 0) return 'none'
  if (millions >= 1000) return `${(millions / 1000).toFixed(2)} bn`
  if (millions >= 100) return `${Math.round(millions)} M`
  if (millions >= 10) return `${millions.toFixed(0)} M`
  return `${millions.toFixed(1)} M`
}

const MONTH_SHORT = [
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

export function monthName(month: number): string {
  return MONTH_SHORT[((month % 12) + 12) % 12]
}

/**
 * Map fill by the once-a-year wet bulb.
 *
 * Stops sit on the thresholds the bands use rather than at even intervals, so
 * the colour change a reader sees is a change in what the number means: straw
 * at 26 °C where heavy work starts to be limited, amber at 28 °C, red at 31 °C
 * where rest stops being safe, violet at 35 °C. Violet rather than the fire
 * layer's char deliberately — the two maps should not be mistaken for each
 * other at a glance, and this one is about water in the air, not fuel.
 */
const HUMID_HEAT_STOPS = [
  { c: 12, r: 158, g: 190, b: 198 },
  { c: 22, r: 198, g: 208, b: 174 },
  { c: 26, r: 238, g: 208, b: 122 },
  { c: 28, r: 236, g: 158, b: 74 },
  { c: 31, r: 206, g: 70, b: 60 },
  { c: 35, r: 126, g: 26, b: 96 },
  { c: 38, r: 58, g: 10, b: 56 },
] as const

export function humidHeatColor(peakWetBulbC: number, hovered: boolean): string {
  // NaN survives Math.max/Math.min and would paint a country black; treat a
  // non-finite peak as the cold end rather than guarding at every call site.
  const finite = Number.isFinite(peakWetBulbC) ? peakWetBulbC : HUMID_HEAT_STOPS[0].c
  const v = Math.max(
    HUMID_HEAT_STOPS[0].c,
    Math.min(HUMID_HEAT_STOPS[HUMID_HEAT_STOPS.length - 1].c, finite),
  )
  let i = 0
  while (i < HUMID_HEAT_STOPS.length - 2 && v > HUMID_HEAT_STOPS[i + 1].c) i += 1
  const a = HUMID_HEAT_STOPS[i]
  const b = HUMID_HEAT_STOPS[i + 1]
  const u = (v - a.c) / (b.c - a.c || 1)
  return lift(
    Math.round(a.r + u * (b.r - a.r)),
    Math.round(a.g + u * (b.g - a.g)),
    Math.round(a.b + u * (b.b - a.b)),
    hovered,
  )
}

/**
 * The ramp colour that stands for a whole band, for the population-exposure
 * key. Evaluated a little inside each band's lower edge rather than at its
 * midpoint, because the top band is open-ended and its midpoint does not exist.
 */
const BAND_ANCHOR_C: Record<HabitabilityBand, number> = {
  mild: 19,
  warm: 24,
  straining: 27,
  'labour-limited': 29.5,
  'rest-limited': 32.5,
  'beyond-survivable': 36,
}

export function habitabilityColor(band: HabitabilityBand): string {
  return humidHeatColor(BAND_ANCHOR_C[band], false)
}

// Every swatch is `humidHeatColor` evaluated at the wet bulb it names, so the
// key is the ramp itself rather than an approximation of it.
export const HUMID_HEAT_LEGEND = [
  { label: '22°C or below', color: humidHeatColor(22, false) },
  { label: '26°C work limited', color: humidHeatColor(26, false) },
  { label: '28°C work unsafe', color: humidHeatColor(28, false) },
  { label: '31°C unsafe at rest', color: humidHeatColor(31, false) },
  { label: '35°C survival limit', color: humidHeatColor(35, false) },
] as const
