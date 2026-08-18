/**
 * IPCC AR6–aligned pathways, hotter stress-tests, and a second family that
 * varies how the Earth *responds* rather than how much we emit.
 *
 * The emissions pathways answer one question — how much carbon. The
 * Earth-system pathways answer a different one: what if the parts of the
 * response that observations keep disagreeing with the models about are the
 * parts that matter? Those live in `physics` and reshape the map, not just the
 * curve. See `lib/earthSystem.ts` for the mechanisms.
 */

import {
  NEUTRAL_PHYSICS,
  type ScenarioPhysics,
} from '../lib/earthSystem'

export type ScenarioId =
  | 'baseline'
  | 'ssp126'
  | 'ssp245'
  | 'ssp585'
  | 'hot6'
  | 'runaway'
  | 'dimming'
  | 'unmasking'
  | 'sinks'
  | 'amoc'
  | 'compound'

/** Which family a pathway belongs to, for grouping the picker. */
export type ScenarioGroup = 'emissions' | 'earthSystem'

export interface Scenario {
  id: ScenarioId
  label: string
  shortLabel: string
  group: ScenarioGroup
  description: string
  /** Plain-language: what would have to be true for this path. */
  whatItTakes: string[]
  /** Short badge on how plausible this pathway is. */
  plausibility: string
  /** Badge tone, low → high concern. */
  plausibilityTone: 'reference' | 'good' | 'likely' | 'high' | 'extreme'
  /** Signature consequences around 2100 — what this world actually feels like. */
  atAGlance: string[]
  /** Global mean surface warming vs pre-industrial by year (°C). */
  warmingByYear: Record<number, number>
  warmingLabel: string
  /** Global mean sea level rise vs 1995–2014 (m). */
  seaLevelByYear: Record<number, number>
  color: string
  /** Whether low-confidence ice-sheet instability is included in SLR. */
  iceSheetInstability: boolean
  /** Earth-system responses layered on top of the global curve. */
  physics: ScenarioPhysics
  /**
   * What in the recent literature motivates this pathway. Only set for the
   * Earth-system family, where the reader deserves to know it is not invented.
   */
  evidence?: string
}

export const SCENARIOS: Record<ScenarioId, Scenario> = {
  baseline: {
    id: 'baseline',
    group: 'emissions',
    label: 'No further change',
    shortLabel: 'No change',
    description:
      'Counterfactual: climate frozen near early-2020s levels. Useful as a baseline — not a realistic future.',
    whatItTakes: [
      'Global emissions drop to near zero almost immediately and stay there',
      'No further fossil CO₂ added to the atmosphere',
      'Existing warming does not keep raising seas (in reality, some rise is already locked in)',
    ],
    plausibility: 'Reference only — already impossible',
    plausibilityTone: 'reference',
    atAGlance: [
      'Seas still creep up ~0.2 m by 2100 from heat already stored in the ocean',
      'Most warm-water coral reefs remain at high risk even at today’s temperature',
      'Useful as the “what we already bought” line, not as a future to plan for',
    ],
    warmingByYear: {
      2020: 1.15,
      2030: 1.15,
      2050: 1.15,
      2100: 1.15,
      2150: 1.15,
      2300: 1.15,
    },
    warmingLabel: '~1.15°C held',
    seaLevelByYear: {
      2020: 0.04,
      2030: 0.06,
      2050: 0.1,
      2100: 0.18,
      2150: 0.25,
      2300: 0.4,
    },
    color: '#5a6b66',
    iceSheetInstability: false,
    physics: NEUTRAL_PHYSICS,
  },
  ssp126: {
    id: 'ssp126',
    group: 'emissions',
    label: 'Strong mitigation (SSP1-2.6)',
    shortLabel: 'Mitigation',
    description:
      'Low emissions: rapid cuts, net-zero around mid-century. Warming stays near ~1.8°C.',
    whatItTakes: [
      'Deep global cuts starting this decade; coal phase-out fast',
      'Net-zero CO₂ around mid-century, then some net-negative emissions',
      'Strong international climate policy, clean power, efficiency, and land sinks',
      'Rough remaining carbon budget: on the order of a few hundred GtCO₂ from now',
    ],
    plausibility: 'Achievable, but needs action now',
    plausibilityTone: 'good',
    atAGlance: [
      'Seas +0.44 m by 2100 — costly for coasts, but defendable for most cities',
      'Ice-free Arctic Septembers happen, then stay rare rather than becoming normal',
      'Glacier-fed rivers still pass peak water, so Asian water stress arrives anyway',
    ],
    warmingByYear: {
      2020: 1.15,
      2030: 1.35,
      2050: 1.6,
      2100: 1.8,
      2150: 1.75,
      2300: 1.6,
    },
    warmingLabel: '~1.8°C by 2100',
    seaLevelByYear: {
      2020: 0.04,
      2030: 0.09,
      2050: 0.19,
      2100: 0.44,
      2150: 0.6,
      2300: 0.9,
    },
    color: '#2f7a5c',
    iceSheetInstability: false,
    physics: NEUTRAL_PHYSICS,
  },
  ssp245: {
    id: 'ssp245',
    group: 'emissions',
    label: 'Current trend (SSP2-4.5)',
    shortLabel: 'Current trend',
    description:
      'Intermediate pathway: emissions peak mid-century then decline. Roughly “policies continue” without deep acceleration of cuts.',
    whatItTakes: [
      'Emissions peak around mid-century, then fall — but not as hard as 1.5–2°C paths',
      'Some climate policy and technology progress, incomplete fossil phase-out',
      'Continuing oil/gas use for decades; coal declines slowly',
      'Close to many “stated policies / middle of the road” outlooks',
    ],
    plausibility: 'Where today’s policies point',
    plausibilityTone: 'likely',
    atAGlance: [
      'Seas +0.56 m by 2100 and still rising — repeated flooding becomes routine',
      'Ice-free Arctic summers become normal from roughly the 2040s',
      'Colorado, Tigris–Euphrates and Murray–Darling all lose over a tenth of their flow',
    ],
    warmingByYear: {
      2020: 1.15,
      2030: 1.45,
      2050: 2.0,
      2100: 2.7,
      2150: 2.9,
      2300: 3.1,
    },
    warmingLabel: '~2.7°C by 2100',
    seaLevelByYear: {
      2020: 0.04,
      2030: 0.09,
      2050: 0.2,
      2100: 0.56,
      2150: 0.82,
      2300: 1.5,
    },
    color: '#2a6f7a',
    iceSheetInstability: false,
    physics: NEUTRAL_PHYSICS,
  },
  ssp585: {
    id: 'ssp585',
    group: 'emissions',
    label: 'Pessimistic (SSP5-8.5)',
    shortLabel: 'Pessimistic',
    description:
      'Very high emissions: fossil-heavy development with little mitigation. IPCC high-end of commonly cited 21st-century pathways (~4.4°C).',
    whatItTakes: [
      'Little effective climate policy worldwide for decades',
      'Energy system stays fossil-dominated (coal + oil + gas grow or stay high)',
      'High energy demand from fossil-fuelled growth; weak efficiency gains',
      'Cumulative emissions many times larger than 1.5–2°C budgets',
    ],
    plausibility: 'High-end, now considered less likely',
    plausibilityTone: 'high',
    atAGlance: [
      'Seas +0.77 m by 2100, with several more metres already locked in beyond',
      'Roughly 750M people live in river basins that have lost significant flow',
      'Parts of the tropics pass the limits of human heat tolerance during heatwaves',
    ],
    warmingByYear: {
      2020: 1.15,
      2030: 1.55,
      2050: 2.4,
      2100: 4.4,
      2150: 5.5,
      2300: 8.0,
    },
    warmingLabel: '~4.4°C by 2100',
    seaLevelByYear: {
      2020: 0.04,
      2030: 0.1,
      2050: 0.23,
      2100: 0.77,
      2150: 1.37,
      2300: 3.5,
    },
    color: '#b4532a',
    iceSheetInstability: false,
    physics: NEUTRAL_PHYSICS,
  },
  hot6: {
    id: 'hot6',
    group: 'emissions',
    label: 'Very hot (~6°C)',
    shortLabel: 'Very hot 6°C',
    description:
      'Hotter than SSP5-8.5 medians by 2100 — stress-test if climate sensitivity and emissions both run high. Summer Arctic ice is gone; ice-sheet risk is severe.',
    whatItTakes: [
      'SSP5-8.5-like fossil expansion plus high climate sensitivity (Earth responds more than average models)',
      'Continued growth in coal/oil/gas; carbon sinks weaken (forests, soils, oceans take up less)',
      'Weak or reversed mitigation after mid-century',
      'Not the IPCC “central” story — a high-end “what if both go wrong” case',
    ],
    plausibility: 'Low-likelihood stress test',
    plausibilityTone: 'extreme',
    atAGlance: [
      'Seas +1.2 m by 2100 and accelerating hard into the 2100s',
      'Greenland and West Antarctica committed to multi-metre, multi-century loss',
      'The Indus and Amu Darya lose roughly half their flow as the glaciers run out',
    ],
    warmingByYear: {
      2020: 1.15,
      2030: 1.7,
      2050: 3.0,
      2100: 6.0,
      2150: 7.5,
      2300: 10.0,
    },
    warmingLabel: '~6°C by 2100',
    seaLevelByYear: {
      2020: 0.04,
      2030: 0.12,
      2050: 0.4,
      2100: 1.2,
      2150: 2.4,
      2300: 5.5,
    },
    color: '#9a2a1a',
    iceSheetInstability: true,
    physics: NEUTRAL_PHYSICS,
  },
  runaway: {
    id: 'runaway',
    group: 'emissions',
    label: 'Catastrophic (~8°C+)',
    shortLabel: 'Catastrophic 8°C',
    description:
      'Illustrative catastrophe: ~8°C by 2100 and worsening after — far beyond likely IPCC ranges. Used to show ice-sheet and coast stress under extreme forcing, not a forecast.',
    whatItTakes: [
      'Near-maximal fossil use for the whole century with almost no mitigation',
      'High climate sensitivity + carbon-cycle feedbacks (permafrost CO₂/CH₄, forest dieback)',
      'Possible major ice-sheet collapse contributions to sea level',
      'Would require a deliberate “burn everything” world — treated here as a warning envelope, not a prediction',
    ],
    plausibility: 'Warning envelope — not a forecast',
    plausibilityTone: 'extreme',
    atAGlance: [
      'Seas +2 m by 2100 and around +10 m by 2300 — coastlines redrawn worldwide',
      'Most glacier-fed rivers collapse after their meltwater is exhausted',
      'Shown to bound the risk space, not because anyone expects this path',
    ],
    warmingByYear: {
      2020: 1.15,
      2030: 1.9,
      2050: 3.6,
      2100: 8.0,
      2150: 10.5,
      2300: 14.0,
    },
    warmingLabel: '~8°C by 2100',
    seaLevelByYear: {
      2020: 0.04,
      2030: 0.15,
      2050: 0.55,
      2100: 2.0,
      2150: 4.5,
      2300: 10.0,
    },
    color: '#6b0f0f',
    iceSheetInstability: true,
    physics: NEUTRAL_PHYSICS,
  },

  /* ---------------------------------------------------------------------
     Earth-system pathways. Emissions here are ordinary — close to the
     current-policy trend — and the difference comes from how the planet
     answers. Each is built on a specific, recent, published disagreement
     between the models and what has actually been measured.
     --------------------------------------------------------------------- */

  dimming: {
    id: 'dimming',
    group: 'earthSystem',
    label: 'Darkening Earth (albedo loss)',
    shortLabel: 'Darkening Earth',
    description:
      'Today’s emissions, but the planet reflects less sunlight than models assume. Earth’s energy imbalance has roughly doubled since 2005, and most of that came from absorbing more sunlight rather than trapping more heat.',
    evidence:
      'CERES satellite records show the imbalance growing mainly through a fall in reflected shortwave radiation. 2023 then set the lowest planetary albedo in the modern record, traced largely to a retreat of low cloud over the northern oceans — the feedback that dominates the spread in model climate sensitivity.',
    whatItTakes: [
      'Emissions follow roughly the current-policy trend — no extra carbon needed',
      'Low-cloud cover keeps declining as the oceans warm, as observed since ~2000',
      'Arctic sea ice and northern snow keep retreating, darkening the surface further',
      'Real climate sensitivity sits near the top of the IPCC likely range rather than the middle',
    ],
    plausibility: 'Matches the last two decades of satellite data',
    plausibilityTone: 'high',
    atAGlance: [
      'Same emissions as “current trend”, but ~1.2°C hotter by 2100',
      'The Arctic runs away from the rest of the planet — northern Siberia and Canada bear the extra',
      'Seas +0.72 m by 2100, because the same feedback that dims the planet melts the ice',
    ],
    warmingByYear: {
      2020: 1.15,
      2030: 1.55,
      2050: 2.35,
      2100: 3.9,
      2150: 4.6,
      2300: 5.4,
    },
    warmingLabel: '~3.9°C by 2100',
    seaLevelByYear: {
      2020: 0.04,
      2030: 0.1,
      2050: 0.25,
      2100: 0.72,
      2150: 1.15,
      2300: 2.4,
    },
    color: '#c98b2e',
    iceSheetInstability: false,
    physics: {
      albedoFeedback: 0.85,
      aerosolUnmasking: 0.15,
      amocWeakening: 0.1,
      carbonFeedback: 0.15,
    },
  },

  unmasking: {
    id: 'unmasking',
    group: 'earthSystem',
    label: 'Clean air, hot decade (aerosol unmasking)',
    shortLabel: 'Aerosol unmasking',
    description:
      'Cleaning up sulphate pollution removes a reflective shield faster than the CO₂ beneath it decays. The warming was always paid for — this pathway just collects it early.',
    evidence:
      'The 2020 marine fuel sulphur cap cut ship emissions sharply and has been described as an inadvertent termination of an accidental geoengineering experiment, with the strongest signal over the shipping lanes. East Asian air-quality policy has been pulling the same lever since the late 2000s. Aerosol forcing remains the largest single uncertainty in total human forcing.',
    whatItTakes: [
      'Air-quality policy keeps succeeding — which is desirable for its own sake',
      'Sulphate aerosols and the marine cloud brightening they cause fall away within decades',
      'CO₂ already emitted continues to act, with nothing left masking it',
      'Warming front-loads into the 2030s–2050s rather than arriving late in the century',
    ],
    plausibility: 'Already underway since 2020',
    plausibilityTone: 'likely',
    atAGlance: [
      'By 2030 it is already hotter than SSP5-8.5, on a fraction of the emissions',
      'Concentrated over East and South Asia, Europe and the North Atlantic shipping lanes',
      'A cleaner, healthier atmosphere that is also a hotter one — the bargain we already made',
    ],
    warmingByYear: {
      2020: 1.15,
      2030: 1.62,
      2050: 2.35,
      2100: 3.4,
      2150: 3.8,
      2300: 4.2,
    },
    warmingLabel: '~3.4°C by 2100',
    seaLevelByYear: {
      2020: 0.04,
      2030: 0.11,
      2050: 0.24,
      2100: 0.65,
      2150: 1.0,
      2300: 1.95,
    },
    color: '#b8823f',
    iceSheetInstability: false,
    physics: {
      albedoFeedback: 0.25,
      aerosolUnmasking: 1.0,
      amocWeakening: 0.1,
      carbonFeedback: 0.1,
    },
  },

  sinks: {
    id: 'sinks',
    group: 'earthSystem',
    label: 'Carbon sinks give way',
    shortLabel: 'Sinks give way',
    description:
      'Land and ocean currently absorb about half of what we emit, and that discount is assumed to hold. If it shrinks, emissions we already consider survivable stop being so.',
    evidence:
      'The land carbon sink nearly vanished in the 2023 anomaly as heat, drought and fire hit tropical and boreal forests. Abrupt permafrost thaw — thermokarst collapse rather than gradual deepening — is largely absent from the models behind the IPCC pathways, and has been estimated to roughly double the permafrost carbon feedback. Methane has been climbing since 2007 with an isotopic signature pointing at wetlands.',
    whatItTakes: [
      'Emissions on roughly the current-policy trend, with no additional fossil expansion',
      'Forest and soil sinks weaken under compounding heat, drought and fire',
      'Permafrost releases carbon abruptly through ground collapse, not just gradual thaw',
      'Wetland methane keeps rising as the tropics warm and flood',
    ],
    plausibility: 'Feedback largely missing from IPCC models',
    plausibilityTone: 'high',
    atAGlance: [
      'The curve bends upward late — 2100 is worse than 2050 suggests, and 2150 worse again',
      'Warming concentrates at northern latitudes, because that is where the frozen carbon is',
      'Cutting emissions still works, but every tonne buys less than the budgets assume',
    ],
    warmingByYear: {
      2020: 1.15,
      2030: 1.5,
      2050: 2.2,
      2100: 4.6,
      2150: 6.0,
      2300: 7.8,
    },
    warmingLabel: '~4.6°C by 2100',
    seaLevelByYear: {
      2020: 0.04,
      2030: 0.1,
      2050: 0.24,
      2100: 0.85,
      2150: 1.6,
      2300: 3.9,
    },
    color: '#8f6b3a',
    iceSheetInstability: false,
    physics: {
      albedoFeedback: 0.55,
      aerosolUnmasking: 0.2,
      amocWeakening: 0.2,
      carbonFeedback: 1.0,
    },
  },

  amoc: {
    id: 'amoc',
    group: 'earthSystem',
    label: 'Atlantic circulation stalls',
    shortLabel: 'Atlantic stalls',
    description:
      'The one way a warming world makes somewhere dramatically colder. If the Atlantic overturning circulation stops carrying heat north, north-west Europe cools by several degrees while the rest of the planet keeps warming.',
    evidence:
      'Observational early-warning analyses place a possible collapse within this century, and a physics-based indicator found the modelled circulation is on a path toward its tipping point. Coupled models are known to hold it too stable because of a shared bias in how they transport freshwater — so their reassurance is the part least worth trusting.',
    whatItTakes: [
      'Greenland meltwater and increased rainfall keep freshening the far North Atlantic',
      'The overturning passes a threshold it cannot return across on human timescales',
      'Global mean warming actually eases slightly — the heat is redistributed, not removed',
      'The regional consequences dwarf the global-mean ones, which is why the average misleads',
    ],
    plausibility: 'Low probability, extreme regional impact',
    plausibilityTone: 'extreme',
    atAGlance: [
      'Iceland, Ireland and Britain end up colder than they were before industrialisation, while the world overall is 2.4°C warmer',
      'The US north-east coast takes roughly 0.4 m of extra sea level on top of the global rise',
      'The Sahel loses a fifth to a third of its rain as the tropical rain belt slides south',
    ],
    warmingByYear: {
      2020: 1.15,
      2030: 1.44,
      2050: 1.95,
      2100: 2.4,
      2150: 2.6,
      2300: 3.0,
    },
    warmingLabel: '~2.4°C, but Europe colder',
    seaLevelByYear: {
      2020: 0.04,
      2030: 0.09,
      2050: 0.2,
      2100: 0.55,
      2150: 0.8,
      2300: 1.45,
    },
    color: '#4a7fa8',
    iceSheetInstability: false,
    physics: {
      albedoFeedback: 0.15,
      aerosolUnmasking: 0.15,
      amocWeakening: 1.0,
      carbonFeedback: 0.1,
    },
  },

  compound: {
    id: 'compound',
    group: 'earthSystem',
    label: 'Compound failure',
    shortLabel: 'Compound failure',
    description:
      'Every mechanism on this list going wrong together, on ordinary emissions. Not the hottest number in this app — the hottest one that does not require anybody to behave unusually badly.',
    evidence:
      'Nothing here is individually exotic: each component is the high end of an assessed range or a feedback the IPCC pathways acknowledge but do not fully include. What makes it pessimistic is that they are correlated — a darker planet melts more ice, thawing ground releases more carbon, and a fresher North Atlantic weakens the overturning. Models tend to treat them separately.',
    whatItTakes: [
      'Emissions merely on the current-policy trend — no fossil expansion required',
      'Climate sensitivity near the top of the likely range as the planet keeps darkening',
      'Aerosol cleanup collects the masked warming early, front-loading the damage',
      'Carbon sinks weaken and permafrost gives way while the ice sheets destabilise',
    ],
    plausibility: 'The worst case that needs no villain',
    plausibilityTone: 'extreme',
    atAGlance: [
      'Seas +1.6 m by 2100 and +7.5 m by 2300 — most low-lying deltas are gone',
      'Siberia passes +15°C, while a half-stalled Atlantic still holds Ireland and Iceland below +7°C',
      'Reached without anyone choosing it, which is precisely the point',
    ],
    warmingByYear: {
      2020: 1.15,
      2030: 1.68,
      2050: 2.9,
      2100: 5.6,
      2150: 7.4,
      2300: 9.6,
    },
    warmingLabel: '~5.6°C by 2100',
    seaLevelByYear: {
      2020: 0.04,
      2030: 0.13,
      2050: 0.45,
      2100: 1.6,
      2150: 3.2,
      2300: 7.5,
    },
    color: '#7a2f5c',
    iceSheetInstability: true,
    physics: {
      albedoFeedback: 1.0,
      aerosolUnmasking: 0.85,
      amocWeakening: 0.6,
      carbonFeedback: 1.0,
    },
  },
}

export const YEAR_MIN = 2020
export const YEAR_MAX = 2300

export function interpolateRecord(
  record: Record<number, number>,
  year: number,
): number {
  const years = Object.keys(record)
    .map(Number)
    .sort((a, b) => a - b)
  if (year <= years[0]) return record[years[0]]
  if (year >= years[years.length - 1]) return record[years[years.length - 1]]
  for (let i = 0; i < years.length - 1; i++) {
    const y0 = years[i]
    const y1 = years[i + 1]
    if (year >= y0 && year <= y1) {
      const t = (year - y0) / (y1 - y0)
      return record[y0] + t * (record[y1] - record[y0])
    }
  }
  return record[years[years.length - 1]]
}

export function seaLevelAt(scenario: Scenario, year: number): number {
  return interpolateRecord(scenario.seaLevelByYear, year)
}

export function warmingAt(scenario: Scenario, year: number): number {
  return interpolateRecord(scenario.warmingByYear, year)
}

export const SCENARIO_ORDER: ScenarioId[] = [
  'baseline',
  'ssp126',
  'ssp245',
  'ssp585',
  'hot6',
  'runaway',
  'unmasking',
  'dimming',
  'sinks',
  'amoc',
  'compound',
]

export interface ScenarioGroupDef {
  id: ScenarioGroup
  label: string
  blurb: string
  ids: ScenarioId[]
}

/**
 * The picker is split because the two families answer different questions, and
 * reading an Earth-system pathway as "more emissions" would miss the point:
 * they mostly run on the current-policy trend and differ in how Earth replies.
 */
export const SCENARIO_GROUPS: ScenarioGroupDef[] = [
  {
    id: 'emissions',
    label: 'How much we emit',
    blurb: 'IPCC-aligned pathways, plus two hotter stress tests.',
    ids: SCENARIO_ORDER.filter((id) => SCENARIOS[id].group === 'emissions'),
  },
  {
    id: 'earthSystem',
    label: 'How the Earth responds',
    blurb:
      'Ordinary emissions, but with feedbacks recent observations suggest the models understate.',
    ids: SCENARIO_ORDER.filter((id) => SCENARIOS[id].group === 'earthSystem'),
  },
]
