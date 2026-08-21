import type { CountryFeature } from './countries'
import { computeLoss } from './landLoss'
import { estimateCountryTemp } from './warming'
import type { ScenarioPhysics } from './earthSystem'
import { estimateCountryRain } from './rain'
import { estimateCountryFire } from './fire'
import { estimateCountryDrought, type AridityClass } from './drought'
import {
  estimateCountryHumidHeat,
  type HabitabilityBand,
} from './humidHeat'
import { localSeaLevel } from './regionalSeaLevel'

export type ImpactSortKey =
  | 'area'
  | 'pct'
  | 'temp'
  | 'rain'
  | 'rainDelta'
  | 'fire'
  | 'burnedArea'
  | 'drought'
  | 'humidHeat'

/**
 * Everything needed to turn a global mean rise into the rise a given coast
 * actually sees. Grouped so callers pass one object instead of threading three
 * loosely-related arguments through every signature.
 */
export interface SeaLevelContext {
  /** Global mean rise vs 1995–2014, in metres. */
  globalMeanM: number
  year: number
  iceSheetInstability: boolean
  /**
   * Earth-system responses for the active pathway. They reshape both the
   * warming pattern and, through the Atlantic circulation, the sea-level one —
   * so they travel with the rest of the scenario context rather than as a
   * separate argument threaded through every signature.
   */
  physics: ScenarioPhysics
}

export interface CountryImpactRow {
  feature: CountryFeature
  name: string
  id: string
  areaKm2: number
  areaLostKm2: number
  areaRemainingKm2: number
  fractionLost: number
  absoluteC: number
  deltaSince2020C: number
  multiplier: number
  baselineMm: number
  futureMm: number
  deltaMm: number
  deltaFrac: number
  /** Relative sea-level rise at this country's own coast (m). */
  localSeaLevelM: number
  /** Local rise ÷ global mean. */
  seaLevelRatio: number
  /** Fire-weather index 0–100, and how far it has moved since the 2020s. */
  fireIndex: number
  fireDeltaIndex: number
  /** Modelled burned area in km²/yr, the share of the country it is, and the
   *  number of days a year the land is flammable. */
  fireBurnedKm2: number
  fireBurnedFraction: number
  fireSeasonDays: number
  /** Water balance: standardised drying, aridity class and P − PET in mm/yr. */
  droughtAnomaly: number
  aridityClass: AridityClass
  waterBalanceMm: number
  /**
   * Humid heat: the wet bulb reached about one day a year, how far past the
   * outdoor-labour threshold the year runs, and the people behind it.
   */
  peakWetBulbC: number
  wetBulbDeltaC: number
  daysAbove28: number
  daysAbove31: number
  habitability: HabitabilityBand
  populationM: number
}

export function rankByImpact(
  features: CountryFeature[],
  sea: SeaLevelContext,
  warmingC: number,
  limit = 25,
  sortBy: ImpactSortKey = 'temp',
  /**
   * Land sorts normally hide countries with no measurable inundation, which
   * keeps the leaderboard meaningful. Searching must not inherit that filter,
   * or looking up a landlocked country returns nothing and reads as a broken
   * search box.
   */
  hideUnaffected = true,
): CountryImpactRow[] {
  const rows: CountryImpactRow[] = []
  for (const f of features) {
    // Each coast gets its own rise: gravitational fingerprints, ocean dynamics
    // and land motion move it well away from the global mean.
    const local = localSeaLevel(
      f,
      sea.globalMeanM,
      sea.year,
      sea.iceSheetInstability,
      sea.physics.amocWeakening,
    )
    const loss = f.__risk
      ? computeLoss(f.__risk, local.riseM, f.__areaKm2)
      : null
    const temp = estimateCountryTemp(f, warmingC, sea.physics)
    const rain = estimateCountryRain(f, warmingC, sea.physics)
    const fire = estimateCountryFire(f, warmingC, sea.physics)
    const water = estimateCountryDrought(f, warmingC, sea.physics)
    const humid = estimateCountryHumidHeat(f, warmingC, sea.physics)
    const areaKm2 = loss?.areaKm2 ?? f.__areaKm2 ?? 0
    if (areaKm2 <= 0) continue
    rows.push({
      localSeaLevelM: local.riseM,
      seaLevelRatio: local.ratio,
      feature: f,
      name: f.properties.name,
      id: f.properties.id,
      areaKm2,
      areaLostKm2: loss?.areaLostKm2 ?? 0,
      areaRemainingKm2: loss?.areaRemainingKm2 ?? areaKm2,
      fractionLost: loss?.fractionLost ?? 0,
      absoluteC: temp.absoluteC,
      deltaSince2020C: temp.deltaSince2020C,
      multiplier: temp.multiplier,
      baselineMm: rain.baselineMm,
      futureMm: rain.futureMm,
      deltaMm: rain.deltaMm,
      deltaFrac: rain.deltaFrac,
      fireIndex: fire.index,
      fireDeltaIndex: fire.deltaIndex,
      fireBurnedKm2: fire.burnedKm2,
      fireBurnedFraction: fire.burnedFraction,
      fireSeasonDays: fire.seasonDays,
      droughtAnomaly: water.anomaly,
      aridityClass: water.aridityClass,
      waterBalanceMm: water.balanceMm,
      peakWetBulbC: humid.peakWetBulbC,
      wetBulbDeltaC: humid.deltaPeakC,
      daysAbove28: humid.daysAbove28,
      daysAbove31: humid.daysAbove31,
      habitability: humid.band,
      populationM: humid.populationM,
    })
  }

  rows.sort((a, b) => {
    if (sortBy === 'pct') return b.fractionLost - a.fractionLost
    if (sortBy === 'temp') return b.absoluteC - a.absoluteC
    if (sortBy === 'rain') return b.futureMm - a.futureMm
    if (sortBy === 'rainDelta') return b.deltaFrac - a.deltaFrac
    if (sortBy === 'fire') return b.fireIndex - a.fireIndex
    if (sortBy === 'burnedArea') return b.fireBurnedKm2 - a.fireBurnedKm2
    // Drying sorts worst-first, so the most negative anomaly leads.
    if (sortBy === 'drought') return a.droughtAnomaly - b.droughtAnomaly
    if (sortBy === 'humidHeat') return b.peakWetBulbC - a.peakWetBulbC
    return b.areaLostKm2 - a.areaLostKm2
  })

  if (hideUnaffected && (sortBy === 'area' || sortBy === 'pct')) {
    return rows.filter((r) => r.areaLostKm2 > 1).slice(0, limit)
  }
  return rows.slice(0, limit)
}
