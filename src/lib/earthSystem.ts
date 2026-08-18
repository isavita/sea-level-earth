/**
 * Earth-system responses that the emissions pathways alone do not capture.
 *
 * Every scenario in this app used to differ along one axis: how much we emit.
 * But the largest disagreements between models and the last decade of
 * observations are not about emissions — they are about how the planet responds
 * to them. Three of those show up strongly enough in the recent literature to be
 * worth simulating, and each changes *where* the warming lands, not just how
 * much of it there is:
 *
 *  1. **Reflected sunlight.** Earth's energy imbalance roughly doubled between
 *     2005 and 2019, and the larger share of that came from the planet
 *     reflecting *less* sunlight rather than trapping more heat. 2023 then set a
 *     record low planetary albedo, traced mainly to a retreat of low cloud. Less
 *     reflective ice, snow and cloud means the same greenhouse forcing buys more
 *     warming — concentrated where the bright surfaces used to be.
 *
 *  2. **Aerosol unmasking.** Burning fossil fuels emits sulphate aerosols that
 *     reflect sunlight and brighten marine cloud, masking part of the warming
 *     the CO₂ has already committed us to. Cleaning that up — the 2020 marine
 *     fuel sulphur cap, East Asian air-quality policy — removes the mask far
 *     faster than the CO₂ decays, over the industrial northern hemisphere and
 *     the shipping lanes in particular.
 *
 *  3. **Atlantic overturning.** The circulation that carries heat north into the
 *     Atlantic is the one part of the system that could make a region *colder*
 *     in a warming world. Coupled models keep it comparatively stable, but they
 *     share a freshwater-transport bias that pushes them that way, and
 *     observational early-warning analyses put a collapse inside this century.
 *
 * These are deliberately coarse shapes, tuned to reproduce the sign and rough
 * magnitude of the published patterns. They are a way to *think* about the risk,
 * not a downscaled projection of it.
 */

const EARTH_R_KM = 6371

export interface ScenarioPhysics {
  /**
   * Surface albedo feedback running hotter than the CMIP6 central estimate:
   * ice, snow and cloud giving back less sunlight. 0 = central, 1 = strong.
   */
  albedoFeedback: number
  /** Reflective pollution removed faster than the CO₂ behind it decays. 0–1. */
  aerosolUnmasking: number
  /** Atlantic overturning: 0 = holds, 1 = collapsed. */
  amocWeakening: number
  /**
   * Carbon-cycle feedbacks — permafrost, weakening land and ocean sinks. This
   * one acts on the global curve rather than the map, so it carries no pattern
   * of its own; it is recorded here so the panel can explain the pathway.
   */
  carbonFeedback: number
}

export const NEUTRAL_PHYSICS: ScenarioPhysics = {
  albedoFeedback: 0,
  aerosolUnmasking: 0,
  amocWeakening: 0,
  carbonFeedback: 0,
}

export function greatCircleKm(
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
 * Extra warming multiplier from a stronger-than-modelled albedo feedback.
 *
 * Weighted to where the bright surfaces actually are and are actually going:
 * the Arctic sea-ice margin and the northern snow line carry most of it, the
 * northern mid-latitudes pick up the observed low-cloud decline, and the
 * Antarctic sea-ice zone gets a smaller share because the Southern Ocean
 * exports the heat downward instead of banking it at the surface.
 */
export function albedoAmplification(lat: number, strength: number): number {
  if (strength <= 0) return 0
  // Arctic ice and snow: peaks over the sea-ice margin around 75°N.
  const arctic = 0.55 * Math.exp(-(((lat - 75) / 22) ** 2))
  // Northern mid-latitude cloud and seasonal snow.
  const midLat = 0.16 * Math.exp(-(((lat - 45) / 20) ** 2))
  // Southern sea ice, damped by the Southern Ocean's heat uptake.
  const antarctic = 0.12 * Math.exp(-(((lat + 68) / 14) ** 2))
  return strength * (arctic + midLat + antarctic)
}

/** Regions whose sulphate haze is being cleaned up, and how heavily. */
const AEROSOL_REGIONS: { lat: number; lng: number; radiusKm: number; weight: number }[] = [
  { lat: 35, lng: 115, radiusKm: 1800, weight: 1.0 }, // East China
  { lat: 25, lng: 80, radiusKm: 1600, weight: 0.85 }, // Indo-Gangetic plain
  { lat: 50, lng: 12, radiusKm: 1500, weight: 0.7 }, // Europe
  { lat: 40, lng: -82, radiusKm: 1500, weight: 0.6 }, // eastern North America
  { lat: 42, lng: -35, radiusKm: 1900, weight: 0.55 }, // N Atlantic shipping lane
  { lat: 33, lng: -160, radiusKm: 1900, weight: 0.45 }, // N Pacific shipping lane
  { lat: 12, lng: 62, radiusKm: 1500, weight: 0.4 }, // Arabian Sea route
]

/**
 * Extra warming multiplier where reflective pollution is disappearing. Almost
 * entirely a northern-hemisphere effect, because that is where the sulphur was.
 */
export function aerosolUnmaskingBoost(
  lat: number,
  lng: number,
  strength: number,
): number {
  if (strength <= 0) return 0
  let peak = 0
  for (const r of AEROSOL_REGIONS) {
    const d = greatCircleKm(lat, lng, r.lat, r.lng)
    peak = Math.max(peak, r.weight * Math.exp(-((d / r.radiusKm) ** 2)))
  }
  // A smaller hemispheric floor: the aerosol burden was northern overall.
  const hemisphere = lat > 0 ? 0.12 * Math.min(1, lat / 30) : 0.02
  return strength * 0.34 * Math.max(peak, hemisphere)
}

/** Where a stalled Atlantic circulation takes heat away, in °C. */
const AMOC_COOLING_CENTRE = { lat: 60, lng: -25 }

/**
 * Absolute cooling in °C from a weakening or collapsed overturning circulation.
 *
 * Absolute rather than a multiplier on purpose: this is the one mechanism that
 * can drive a region's temperature *below* where it started while the rest of
 * the planet keeps warming, and a multiplier can never express that. Magnitudes
 * follow the hosing and collapse literature — strongest over the Nordic seas and
 * Iceland, a few degrees over Britain, Ireland and Scandinavia, tapering across
 * western Europe and the north-east Atlantic seaboard.
 */
export function amocCoolingC(
  lat: number,
  lng: number,
  strength: number,
): number {
  if (strength <= 0) return 0
  const d = greatCircleKm(lat, lng, AMOC_COOLING_CENTRE.lat, AMOC_COOLING_CENTRE.lng)
  const core = 9.5 * Math.exp(-((d / 1500) ** 2))
  // A broad shoulder so continental Europe cools a little rather than not at all.
  const shoulder = 2.6 * Math.exp(-((d / 3200) ** 2))
  return strength * Math.max(core, shoulder)
}

/**
 * Rainfall response to a stalling Atlantic overturning, as a fraction of the
 * baseline.
 *
 * A weaker circulation leaves the northern tropical Atlantic cooler, and the
 * tropical rain belt follows the warm water southward. That is the mechanism
 * behind the drought record of the Sahel, and it is the most consequential part
 * of an AMOC collapse for the number of people affected: the Sahel, West Africa
 * and northern South America dry sharply, while north-east Brazil and the
 * southern tropics get the rain instead. Northern Europe dries too, as the
 * storm track loses the ocean heat that drives it.
 */
export function amocRainfallShift(
  lat: number,
  lng: number,
  strength: number,
): number {
  if (strength <= 0) return 0
  // The rain belt slides south: a dry band just north of the equator, a wet one
  // just south of it, centred on the Atlantic sector and fading around the globe.
  const atlantic = 0.45 + 0.55 * Math.exp(-(((lng + 25) / 65) ** 2))
  const dryBand = -0.34 * Math.exp(-(((lat - 12) / 9) ** 2))
  const wetBand = 0.2 * Math.exp(-(((lat + 8) / 9) ** 2))
  // Northern Europe loses storm-track moisture along with the heat.
  const nwEurope =
    -0.16 * Math.exp(-((greatCircleKm(lat, lng, 57, 2) / 1700) ** 2))
  return strength * ((dryBand + wetBand) * atlantic + nwEurope)
}

/** True when this pathway departs from a plain emissions story. */
export function hasEarthSystemForcing(p: ScenarioPhysics): boolean {
  return (
    p.albedoFeedback > 0 ||
    p.aerosolUnmasking > 0 ||
    p.amocWeakening > 0 ||
    p.carbonFeedback > 0
  )
}

/** Short human labels for whichever mechanisms this pathway switches on. */
export function forcingSummary(p: ScenarioPhysics): string[] {
  const out: string[] = []
  if (p.albedoFeedback >= 0.35) {
    out.push(
      p.albedoFeedback >= 0.75
        ? 'Sunlight reflection collapsing'
        : 'Weaker sunlight reflection',
    )
  }
  if (p.aerosolUnmasking >= 0.35) {
    out.push(
      p.aerosolUnmasking >= 0.75
        ? 'Aerosol shield fully removed'
        : 'Aerosol shield thinning',
    )
  }
  if (p.amocWeakening >= 0.35) {
    out.push(
      p.amocWeakening >= 0.75
        ? 'Atlantic overturning collapsed'
        : 'Atlantic overturning weakening',
    )
  }
  if (p.carbonFeedback >= 0.35) {
    out.push(
      p.carbonFeedback >= 0.75 ? 'Carbon sinks failing' : 'Carbon sinks weakening',
    )
  }
  return out
}
