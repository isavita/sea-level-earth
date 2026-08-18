import type { Scenario, ScenarioId } from './scenarios'
import { warmingAt } from './scenarios'

/**
 * Polar ice models (illustrative, IPCC AR6–shaped).
 *
 * Key science the UI should communicate:
 * - Arctic *summer sea ice*: roughly linear with global warming — NO classical tipping point.
 *   Practically ice-free September (<1 M km²) is likely before 2050 in all SSPs.
 * - Greenland & Antarctic *ice sheets*: can cross thresholds (~1.5–3°C sustained) that commit
 *   near-complete loss over centuries–millennia. Rate then stays high for a long time — not a
 *   5-year crash of everything, but also not a forever-flat line.
 */

/** Late-1970s September Arctic sea-ice area reference (million km²). */
export const ARCTIC_SIA_REF_M_KM2 = 7.0
/** “Practically ice-free” September threshold used by IPCC/CMIP6. */
export const ARCTIC_ICE_FREE_M_KM2 = 1.0
/** Rough 2020 September area. */
export const ARCTIC_SIA_2020_M_KM2 = 4.0

export interface IceState {
  /** September Arctic sea-ice area (million km²). */
  arcticSeaIceMkm2: number
  /** 0–1 vs late-1970s reference. */
  arcticFractionOf1979: number
  arcticIceFreeSummer: boolean
  /** Years since last ice-free-ish state under this path (0 if not yet). */
  arcticFirstIceFreeYear: number | null
  /** Remaining Greenland ice-sheet volume fraction (1 = present-day). */
  greenlandRemaining: number
  /** Remaining Antarctic ice-sheet volume fraction (1 = present-day). */
  antarcticRemaining: number
  /** Committed multi-millennial loss risk label. */
  sheetRisk: 'low' | 'elevated' | 'high' | 'extreme'
  /** Qualitative pace vs 1970–2020 observed melt. */
  paceNote: string
}

/**
 * Approximate first September ice-free year by scenario (ensemble-central
 * illustrative).
 *
 * The Earth-system pathways cluster earlier than their 2100 warming alone would
 * suggest, because the mechanisms that define them act on the ice first: a
 * darker surface, a thinner aerosol haze over the northern hemisphere and
 * thawing permafrost all land in the Arctic. The exception is a stalled Atlantic
 * circulation, which slows the northward heat transport that has been eroding
 * the ice from below, and so buys the sea ice a couple of decades.
 */
const FIRST_ICE_FREE: Record<ScenarioId, number | null> = {
  baseline: null,
  ssp126: 2048,
  ssp245: 2040,
  ssp585: 2035,
  hot6: 2032,
  runaway: 2030,
  unmasking: 2036,
  dimming: 2034,
  sinks: 2037,
  amoc: 2052,
  compound: 2033,
}

/**
 * Arctic September SIA: nearly linear in warming (IPCC: no tipping point).
 * Calibrated so ~1.7–2.0°C → approaching ice-free threshold.
 */
export function arcticSeaIceArea(warmingC: number, scenarioId: ScenarioId, year: number): number {
  // Baseline: hold near 2020 extent with mild noise-free decline from committed heat.
  if (scenarioId === 'baseline') {
    return Math.max(2.8, ARCTIC_SIA_2020_M_KM2 - (year - 2020) * 0.004)
  }

  // Linear sensitivity ~ −2.5 M km² per °C above ~0.7°C (shaped to hit ice-free ~1.7–2°C).
  const sia = ARCTIC_SIA_REF_M_KM2 - 3.1 * Math.max(0, warmingC - 0.55)
  // After first ice-free year, high-emission paths spend more summers near zero.
  const first = FIRST_ICE_FREE[scenarioId]
  let area = Math.max(0.05, sia)
  if (first && year >= first) {
    const yearsAfter = year - first
    const suppress =
      scenarioId === 'ssp126'
        ? Math.min(0.55, yearsAfter * 0.012)
        : scenarioId === 'ssp245'
          ? Math.min(0.85, yearsAfter * 0.02)
          : scenarioId === 'ssp585'
            ? Math.min(0.95, yearsAfter * 0.03)
            : Math.min(0.98, yearsAfter * 0.04)
    area = Math.max(0.05, area * (1 - suppress))
  }
  return area
}

/**
 * Ice-sheet remaining volume through 2300 — slow on human timescales until instability paths.
 * Full melt of Greenland ≈ millennia at high warming; Antarctica even slower overall,
 * but West Antarctic can run faster under instability assumptions.
 */
export function iceSheetRemaining(
  scenario: Scenario,
  year: number,
): { greenland: number; antarctic: number; risk: IceState['sheetRisk'] } {
  const w = warmingAt(scenario, year)
  const t = Math.max(0, (year - 2020) / (2300 - 2020))

  // Background slow loss (century scale is a few % even under high emissions).
  let gLoss = 0.01 * t + Math.max(0, w - 1.5) * 0.02 * t
  let aLoss = 0.008 * t + Math.max(0, w - 1.5) * 0.015 * t

  if (scenario.iceSheetInstability) {
    // Stress-test: faster grounded-ice loss after mid-century.
    const accel = year < 2050 ? 0 : Math.min(1, (year - 2050) / 150)
    gLoss += 0.12 * accel * accel
    aLoss += 0.08 * accel * accel
  }

  // Sustained high warming commits larger eventual loss (shown as deeper remaining drop by 2300).
  if (w >= 3) {
    gLoss += 0.05 * t
    aLoss += 0.04 * t
  }
  if (w >= 5) {
    gLoss += 0.08 * t
    aLoss += 0.06 * t
  }
  if (w >= 7) {
    gLoss += 0.12 * t
    aLoss += 0.09 * t
  }
  if (w >= 10) {
    gLoss += 0.15 * t
    aLoss += 0.1 * t
  }

  // Floor: hotter paths can show deeper long-term loss by 2300 (still not full melt).
  const gFloor = w >= 8 ? 0.35 : w >= 5 ? 0.45 : 0.55
  const aFloor = w >= 8 ? 0.5 : w >= 5 ? 0.6 : 0.7
  const greenland = Math.max(gFloor, 1 - gLoss)
  const antarctic = Math.max(aFloor, 1 - aLoss)

  let risk: IceState['sheetRisk'] = 'low'
  if (w >= 1.5) risk = 'elevated'
  if (w >= 2.5) risk = 'high'
  if (w >= 3.5 || scenario.iceSheetInstability) risk = 'extreme'

  return { greenland, antarctic, risk }
}

export function iceState(scenario: Scenario, year: number): IceState {
  const warming = warmingAt(scenario, year)
  const arctic = arcticSeaIceArea(warming, scenario.id, year)
  const sheets = iceSheetRemaining(scenario, year)
  const first = FIRST_ICE_FREE[scenario.id]
  const iceFree = arctic <= ARCTIC_ICE_FREE_M_KM2

  let paceNote: string
  if (scenario.id === 'baseline') {
    paceNote =
      'Holding today’s climate: Arctic ice stays depleted vs the 1970s but does not crash to a new ice-free normal.'
  } else if (!iceFree) {
    paceNote =
      'Arctic summer ice is shrinking roughly in step with global warming (near-linear — not a sudden tip). Still faster than mid-20th-century rates.'
  } else if (sheets.risk === 'extreme') {
    paceNote =
      'Summer Arctic is effectively open water most years. Ice sheets: elevated chance of committed multi-millennial collapse — decades–centuries of elevated melt, not a 5-year total wipeout.'
  } else {
    paceNote =
      'First practically ice-free Septembers arrive; under higher emissions they become routine. Sheet melt keeps accelerating with warming but plays out over centuries–millennia.'
  }

  return {
    arcticSeaIceMkm2: arctic,
    arcticFractionOf1979: arctic / ARCTIC_SIA_REF_M_KM2,
    arcticIceFreeSummer: iceFree,
    arcticFirstIceFreeYear: first,
    greenlandRemaining: sheets.greenland,
    antarcticRemaining: sheets.antarctic,
    sheetRisk: sheets.risk,
    paceNote,
  }
}

/** Build a polar cap as orange-slice polygons that include the pole (valid on a globe). */
export function polarCapFeatureCollection(
  pole: 'north' | 'south',
  radiusDeg: number,
  props: Record<string, unknown>,
  goreDeg = 20,
): GeoJSON.Feature[] {
  const poleLat = pole === 'north' ? 90 : -90
  const edgeLat =
    pole === 'north'
      ? Math.max(-89, 90 - Math.max(0.5, radiusDeg))
      : Math.min(89, -90 + Math.max(0.5, radiusDeg))

  const features: GeoJSON.Feature[] = []
  for (let lon0 = -180; lon0 < 180; lon0 += goreDeg) {
    const lon1 = Math.min(180, lon0 + goreDeg)
    const ring: [number, number][] = [
      [lon0, poleLat],
      [lon0, edgeLat],
      [lon1, edgeLat],
      [lon1, poleLat],
      [lon0, poleLat],
    ]
    features.push({
      type: 'Feature',
      properties: { ...props },
      geometry: { type: 'Polygon', coordinates: [ring] },
    })
  }
  return features
}

/** Arctic ice cap radius in degrees from pole from remaining area fraction. */
export function arcticCapRadiusDeg(fractionOf1979: number): number {
  // 1979 extent ~ covers to ~72–75°N on average as a crude disk; shrinks toward pole.
  const f = Math.max(0, Math.min(1.1, fractionOf1979))
  return 18 * Math.sqrt(f) // degrees from pole
}

export function antarcticCapRadiusDeg(sheetRemaining: number): number {
  // Grounded + shelf footprint — shrinks slightly as sheet thins (visual only).
  return 22 * (0.85 + 0.15 * sheetRemaining)
}

export const ICE_EXPLAINERS = [
  {
    title: 'Arctic summer sea ice',
    body: 'No classical tipping point (IPCC, high confidence). Area falls roughly linearly with global temperature. Practically ice-free Septembers (<1 M km²) are likely before 2050 in all SSP pathways — then become rare or routine depending on emissions.',
  },
  {
    title: 'Speed vs the last 50 years',
    body: 'Observed loss since the late 1970s is already fast. Models do not say “the next 50 years of melt finish in 5 years,” but under high warming the rate stays high and ice-free summers stack up. Sheets respond on longer clocks.',
  },
  {
    title: 'Greenland & Antarctica',
    body: 'These are tipping-prone ice sheets. Sustained warming near ~1.5–3°C raises the odds of committed, near-complete loss over multiple millennia. West Antarctic instability can add metres of sea level over centuries in high-end stories — still not an overnight melt.',
  },
  {
    title: 'Full polar melt?',
    body: 'Losing all Arctic *sea ice* in late summer is a 21st-century risk. Losing the whole Greenland ice sheet (~7 m sea level) or Antarctic sheets (~50+ m) is a multi-century to multi-millennial outcome if warming stays high — which is why “extreme ice” stress-tests matter for coasts.',
  },
] as const
