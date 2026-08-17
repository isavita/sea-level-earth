/** IPCC AR6–aligned pathways plus hotter stress-tests for Meridian. */

export type ScenarioId =
  | 'baseline'
  | 'ssp126'
  | 'ssp245'
  | 'ssp585'
  | 'hot6'
  | 'runaway'

export interface Scenario {
  id: ScenarioId
  label: string
  shortLabel: string
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
}

export const SCENARIOS: Record<ScenarioId, Scenario> = {
  baseline: {
    id: 'baseline',
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
  },
  ssp126: {
    id: 'ssp126',
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
  },
  ssp245: {
    id: 'ssp245',
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
  },
  ssp585: {
    id: 'ssp585',
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
  },
  hot6: {
    id: 'hot6',
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
  },
  runaway: {
    id: 'runaway',
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
]
