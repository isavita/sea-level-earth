/**
 * Major river basins: today's flow and how warming reshapes it.
 *
 * Three mechanisms drive the model, and they pull in different directions —
 * which is the whole point of showing rivers alongside sea level:
 *
 * 1. GLACIER MELT — "peak water". As glaciers retreat they *release* stored ice,
 *    so flow first RISES. Once the ice is largely gone the meltwater engine dies
 *    and flow collapses well below today. Himalayan and Andean basins are the
 *    classic cases (peak water is widely projected mid-century).
 * 2. SNOWPACK — warming shifts precipitation from snow to rain and melts what
 *    snow remains earlier. Annual totals move less than seasonality, but the
 *    dry-season river (when people actually need it) shrinks.
 * 3. RAIN + EVAPORATION — basin rainfall shifts (wet-get-wetter, dry-get-drier),
 *    while hotter air evaporates more before it ever reaches the channel. A
 *    basin can get the same rain and still lose river flow.
 *
 * Illustrative, IPCC/AR6-shaped — not a calibrated hydrological model.
 */

export type RiverStress = 'rising' | 'stable' | 'declining' | 'severe'

export interface River {
  id: string
  name: string
  /** Countries / region the basin serves. */
  region: string
  /** Mean annual discharge near the mouth today (km³/yr). */
  dischargeKm3: number
  /** People living in the basin (millions). */
  peopleM: number
  /** Share of flow originating as glacier melt (0–1). */
  glacierFrac: number
  /** Share of flow originating as seasonal snowpack (0–1). */
  snowFrac: number
  /**
   * Net basin rainfall sensitivity per °C of extra warming, already including
   * the evapotranspiration penalty. Negative = the basin dries.
   */
  rainSensPerC: number
  /** Coarse course from headwaters to mouth, [lng, lat]. */
  path: [number, number][]
  /** One line on why this basin matters. */
  note: string
}

export const RIVERS: River[] = [
  {
    id: 'indus',
    name: 'Indus',
    region: 'Pakistan · India · China',
    dischargeKm3: 90,
    peopleM: 268,
    glacierFrac: 0.4,
    snowFrac: 0.35,
    rainSensPerC: -0.04,
    path: [
      [81, 32], [77, 34.5], [74, 35], [72, 34],
      [71, 32], [70.5, 29], [69, 26], [67.5, 24.2],
    ],
    note: 'The most glacier-dependent big river on Earth — and it irrigates Pakistan.',
  },
  {
    id: 'ganges',
    name: 'Ganges–Brahmaputra',
    region: 'India · Bangladesh · Nepal',
    dischargeKm3: 1100,
    peopleM: 600,
    glacierFrac: 0.12,
    snowFrac: 0.15,
    rainSensPerC: 0.05,
    path: [
      [79, 30.8], [80, 29], [82, 26], [85, 25.5],
      [87, 25], [88.5, 23.5], [89.5, 22.5],
    ],
    note: 'A stronger monsoon adds water and flood risk, while the glacier share fades.',
  },
  {
    id: 'yangtze',
    name: 'Yangtze',
    region: 'China',
    dischargeKm3: 900,
    peopleM: 450,
    glacierFrac: 0.05,
    snowFrac: 0.12,
    rainSensPerC: 0.03,
    path: [
      [91, 33.5], [97, 32], [101, 29], [104, 29],
      [108, 30.5], [112, 30.3], [117, 31], [121.5, 31.5],
    ],
    note: 'Wetter monsoon on average, but with sharper floods and deeper dry spells.',
  },
  {
    id: 'yellow',
    name: 'Yellow (Huang He)',
    region: 'China',
    dischargeKm3: 50,
    peopleM: 180,
    glacierFrac: 0.04,
    snowFrac: 0.15,
    rainSensPerC: -0.01,
    path: [
      [96, 35], [100, 35], [103, 36], [107, 37.5],
      [110, 40], [112, 37], [114, 36], [118, 37.8],
    ],
    note: 'Already over-allocated; extra evaporation eats most of any rainfall gain.',
  },
  {
    id: 'mekong',
    name: 'Mekong',
    region: 'SE Asia',
    dischargeKm3: 475,
    peopleM: 70,
    glacierFrac: 0.07,
    snowFrac: 0.1,
    rainSensPerC: 0.03,
    path: [
      [94, 33], [98, 31], [100, 26], [101, 21],
      [102, 18], [104, 15], [105.5, 12], [106.5, 10],
    ],
    note: 'Feeds the delta rice bowl — squeezed by dams as well as climate.',
  },
  {
    id: 'amudarya',
    name: 'Amu Darya',
    region: 'Central Asia',
    dischargeKm3: 79,
    peopleM: 43,
    glacierFrac: 0.35,
    snowFrac: 0.35,
    rainSensPerC: -0.05,
    path: [
      [71, 38], [68, 37.5], [65, 38], [62, 40], [60, 42], [59, 44],
    ],
    note: 'Glacier- and snow-fed in a desert basin — the Aral Sea already died here.',
  },
  {
    id: 'colorado',
    name: 'Colorado',
    region: 'US Southwest · Mexico',
    dischargeKm3: 17,
    peopleM: 40,
    glacierFrac: 0.01,
    snowFrac: 0.6,
    rainSensPerC: -0.06,
    path: [
      [-105.8, 40.5], [-108, 39], [-110, 38], [-111.5, 37],
      [-113, 36], [-114.5, 35], [-114.6, 32.7],
    ],
    note: 'Snowpack-run and already over-drawn; flow falls roughly 9% per °C.',
  },
  {
    id: 'tigris',
    name: 'Tigris–Euphrates',
    region: 'Turkey · Syria · Iraq',
    dischargeKm3: 50,
    peopleM: 60,
    glacierFrac: 0.02,
    snowFrac: 0.4,
    rainSensPerC: -0.08,
    path: [
      [39, 39], [39, 37], [41, 36], [44, 34],
      [45.5, 32], [47, 31], [48.5, 30],
    ],
    note: 'One of the fastest-drying basins anywhere — a hard water-security case.',
  },
  {
    id: 'nile',
    name: 'Nile',
    region: 'NE Africa',
    dischargeKm3: 85,
    peopleM: 260,
    glacierFrac: 0,
    snowFrac: 0.02,
    rainSensPerC: 0.02,
    path: [
      [32.5, -1], [32, 2], [31.5, 6], [31, 10], [32.5, 15],
      [33, 18], [32.9, 24], [31.5, 28], [31, 31.5],
    ],
    note: 'Hinges on Ethiopian highland rain; small % swings move whole harvests.',
  },
  {
    id: 'niger',
    name: 'Niger',
    region: 'West Africa · Sahel',
    dischargeKm3: 180,
    peopleM: 130,
    glacierFrac: 0,
    snowFrac: 0,
    rainSensPerC: 0.02,
    path: [
      [-11, 10], [-8, 12], [-5, 14], [-1, 16],
      [2, 15], [4, 12], [6, 9], [6.5, 5.5],
    ],
    note: 'Sahel rainfall is the single biggest uncertainty in this whole map.',
  },
  {
    id: 'amazon',
    name: 'Amazon',
    region: 'South America',
    dischargeKm3: 6600,
    peopleM: 30,
    glacierFrac: 0.01,
    snowFrac: 0,
    rainSensPerC: -0.02,
    path: [
      [-73.5, -10.5], [-70, -8], [-67, -5], [-64, -3.5],
      [-60, -3.2], [-56, -2.5], [-52, -1.5], [-50, -0.5],
    ],
    note: 'Biggest river on Earth; forest dieback could dry its own rainfall engine.',
  },
  {
    id: 'congo',
    name: 'Congo',
    region: 'Central Africa',
    dischargeKm3: 1300,
    peopleM: 90,
    glacierFrac: 0,
    snowFrac: 0,
    rainSensPerC: 0.02,
    path: [
      [27, -11], [26, -7], [24, -4], [21, -2],
      [18, -2], [16, -4], [13.5, -5.8],
    ],
    note: 'Second-largest flow; equatorial rain keeps it comparatively steady.',
  },
  {
    id: 'mississippi',
    name: 'Mississippi',
    region: 'United States',
    dischargeKm3: 580,
    peopleM: 30,
    glacierFrac: 0,
    snowFrac: 0.2,
    rainSensPerC: 0.01,
    path: [
      [-95, 47.2], [-91, 44], [-90, 38.6], [-90.2, 35],
      [-91, 32], [-91, 30], [-89.4, 29.2],
    ],
    note: 'Wetter overall, but swinging harder between flood and drought years.',
  },
  {
    id: 'danube',
    name: 'Danube',
    region: 'Central Europe',
    dischargeKm3: 200,
    peopleM: 80,
    glacierFrac: 0.02,
    snowFrac: 0.22,
    rainSensPerC: -0.03,
    path: [
      [8.2, 48], [12, 48.7], [16.4, 48.2], [19, 47.5],
      [21, 46], [23, 44], [27, 44.2], [29.7, 45.2],
    ],
    note: 'Alpine snow and summer rain both decline — low-water summers get worse.',
  },
  {
    id: 'rhine',
    name: 'Rhine',
    region: 'Western Europe',
    dischargeKm3: 75,
    peopleM: 60,
    glacierFrac: 0.05,
    snowFrac: 0.25,
    rainSensPerC: -0.03,
    path: [
      [8.6, 46.5], [8, 47.5], [7.6, 48.5], [8.3, 50],
      [7, 51], [6, 51.8], [4.1, 51.9],
    ],
    note: 'Alpine-fed shipping artery; 2018 and 2022 low water already halted barges.',
  },
  {
    id: 'murray',
    name: 'Murray–Darling',
    region: 'Australia',
    dischargeKm3: 24,
    peopleM: 3,
    glacierFrac: 0,
    snowFrac: 0.1,
    rainSensPerC: -0.07,
    path: [
      [148, -30], [147, -32], [144, -34], [141, -34.2],
      [139.5, -35], [138.9, -35.5],
    ],
    note: 'Australia’s food bowl, in the drying subtropical belt.',
  },
  {
    id: 'lena',
    name: 'Lena',
    region: 'Siberia · Arctic',
    dischargeKm3: 530,
    peopleM: 1,
    glacierFrac: 0.01,
    snowFrac: 0.55,
    rainSensPerC: 0.08,
    path: [
      [107, 54], [110, 57], [115, 60], [122, 64],
      [126, 67], [127, 70], [126, 72],
    ],
    note: 'Arctic rivers gain water as the north warms and permafrost thaws.',
  },
]

/** Global warming level treated as "today" everywhere in the app. */
const BASELINE_C = 1.15

/**
 * Glacier runoff vs today — the "peak water" curve.
 * Melt accelerates first (more water), then the reservoir of ice runs out and
 * the contribution collapses. Peaks about +1.2°C above today.
 */
export function glacierRunoffMultiplier(extraWarmingC: number): number {
  const peak = 1.2
  if (extraWarmingC <= 0) return 1
  if (extraWarmingC <= peak) return 1 + 0.55 * (extraWarmingC / peak)
  const decay = (extraWarmingC - peak) / 2.6
  return Math.max(0.08, 1.55 * Math.exp(-decay * 1.35))
}

/** Mean absolute latitude of a basin, taken from its course. */
export function basinAbsLat(river: River): number {
  const sum = river.path.reduce((acc, [, lat]) => acc + Math.abs(lat), 0)
  return sum / river.path.length
}

/**
 * Annual loss rate of the snowmelt component, per °C.
 *
 * Snow turning to rain mostly shifts *timing* rather than annual volume. The
 * annual loss comes from what the warmth does next: earlier melt plus a longer
 * growing season evaporate a real share of the water in warm basins (the
 * Colorado loses roughly 9% of its flow per °C this way). Cold high-latitude
 * basins evaporate very little, so they keep nearly all of it — which is why
 * Arctic rivers like the Lena are observed to be gaining water, not losing it.
 */
export function snowPenaltyPerC(absLat: number): number {
  const warmth = Math.max(0.2, Math.min(1, 1 - (absLat - 40) / 30))
  return 0.11 * warmth
}

/** Seasonal snowpack contribution vs today: less snow, melting earlier. */
export function snowRunoffMultiplier(extraWarmingC: number, absLat = 35): number {
  return Math.max(
    0.15,
    1 - snowPenaltyPerC(absLat) * Math.max(0, extraWarmingC),
  )
}

export interface RiverState {
  river: River
  /** Flow relative to today (1 = unchanged). */
  flowFraction: number
  /** Projected mean annual discharge (km³/yr). */
  flowKm3: number
  /** Change vs today as a fraction (−0.2 = 20% less water). */
  deltaFrac: number
  stress: RiverStress
  /** True for glacier basins whose meltwater bonus has already turned over. */
  pastPeakWater: boolean
  /** Short, human explanation of what is driving this river's number. */
  driver: string
}

export function riverState(river: River, warmingC: number): RiverState {
  const extra = Math.max(0, warmingC - BASELINE_C)
  const rainFrac = Math.max(0, 1 - river.glacierFrac - river.snowFrac)

  const glacier = river.glacierFrac * glacierRunoffMultiplier(extra)
  const snow = river.snowFrac * snowRunoffMultiplier(extra, basinAbsLat(river))
  const rain = rainFrac * (1 + river.rainSensPerC * extra)

  const flowFraction = Math.max(0.05, glacier + snow + rain)
  const deltaFrac = flowFraction - 1

  // Has the glacier contribution peaked and turned down?
  const glacierMult = glacierRunoffMultiplier(extra)
  const pastPeakWater = river.glacierFrac >= 0.1 && extra > 1.2 && glacierMult < 1.4

  // Classify on the same rounded percentage the UI prints, so a row can never
  // read "−6%" next to a "Near today" pill.
  const pct = Math.round(deltaFrac * 100)
  let stress: RiverStress = 'stable'
  if (pct >= 6) stress = 'rising'
  else if (pct <= -25) stress = 'severe'
  else if (pct <= -6) stress = 'declining'

  let driver: string
  if (river.glacierFrac >= 0.2 && pastPeakWater) {
    driver = 'Peak water passed — the glaciers that fed it are running out.'
  } else if (river.glacierFrac >= 0.2) {
    driver = 'Still gaining meltwater as glaciers retreat — a temporary surplus.'
  } else if (river.snowFrac >= 0.4) {
    driver = 'Snowpack turning to rain: less stored water for summer.'
  } else if (river.rainSensPerC <= -0.05) {
    driver = 'Drying basin — falling rainfall plus stronger evaporation.'
  } else if (river.rainSensPerC >= 0.04) {
    driver = 'Wetter basin — more rain than it loses to evaporation.'
  } else {
    driver = 'Rainfall roughly holds, but hotter air evaporates more of it.'
  }

  return {
    river,
    flowFraction,
    flowKm3: river.dischargeKm3 * flowFraction,
    deltaFrac,
    stress,
    pastPeakWater,
    driver,
  }
}

export function allRiverStates(warmingC: number): RiverState[] {
  return RIVERS.map((r) => riverState(r, warmingC))
}

/** Headline numbers for the freshwater panel. */
export function freshwaterSummary(warmingC: number) {
  const states = allRiverStates(warmingC)
  let peopleLosing = 0
  let peopleGaining = 0
  let pastPeak = 0
  for (const s of states) {
    if (s.stress === 'declining' || s.stress === 'severe') {
      peopleLosing += s.river.peopleM
    } else if (s.stress === 'rising') {
      peopleGaining += s.river.peopleM
    }
    if (s.pastPeakWater) pastPeak += 1
  }
  return { states, peopleLosing, peopleGaining, pastPeak }
}

/** Line colour for a river: teal-blue (more water) → rust (much less). */
export function riverFlowColor(deltaFrac: number): string {
  const t = Math.max(-1, Math.min(1, deltaFrac / 0.3))
  if (t >= 0) {
    const u = t
    return `rgba(${Math.round(96 - u * 40)}, ${Math.round(186 + u * 20)}, ${Math.round(226 + u * 20)}, 0.95)`
  }
  const u = -t
  return `rgba(${Math.round(96 + u * 130)}, ${Math.round(186 - u * 120)}, ${Math.round(226 - u * 180)}, 0.95)`
}

export function formatKm3(km3: number): string {
  if (km3 >= 1000) return `${(km3 / 1000).toFixed(2)}k km³`
  if (km3 >= 100) return `${km3.toFixed(0)} km³`
  return `${km3.toFixed(1)} km³`
}

export const RIVER_EXPLAINERS = [
  {
    title: 'Peak water',
    body: 'Glacier-fed rivers get *more* water at first — retreating ice releases centuries of stored snow. That bonus peaks (mid-century for most Himalayan and Andean basins) and then falls away, leaving the river drier than it was before the melt began.',
  },
  {
    title: 'Snow becomes rain',
    body: 'Warming does not only shrink snowpack, it moves the timing. Rain runs off immediately and melt comes earlier, so water arrives in winter and spring instead of the summer when farms and cities need it.',
  },
  {
    title: 'Hotter air drinks first',
    body: 'Evaporation and plant water use rise steeply with temperature. A basin can receive exactly the same rainfall as today and still deliver noticeably less water to the river — which is why several basins here decline even with flat precipitation.',
  },
  {
    title: 'Groundwater and lakes',
    body: 'When rivers fall short, irrigation switches to pumping. Aquifers under the Indus, the North China Plain and the US High Plains are already dropping, and lakes from the Aral to Lake Chad show how fast surface water can disappear once inflow is diverted.',
  },
] as const
