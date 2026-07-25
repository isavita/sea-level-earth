import type { CountryFeature } from './countries'
import { computeLoss } from './landLoss'
import { estimateCountryTemp } from './warming'
import { estimateCountryRain } from './rain'

export type ImpactSortKey = 'area' | 'pct' | 'temp' | 'rain' | 'rainDelta'

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
}

export function rankByImpact(
  features: CountryFeature[],
  seaLevelM: number,
  warmingC: number,
  limit = 25,
  sortBy: ImpactSortKey = 'temp',
): CountryImpactRow[] {
  const rows: CountryImpactRow[] = []
  for (const f of features) {
    const loss = f.__risk
      ? computeLoss(f.__risk, seaLevelM, f.__areaKm2)
      : null
    const temp = estimateCountryTemp(f, warmingC)
    const rain = estimateCountryRain(f, warmingC)
    const areaKm2 = loss?.areaKm2 ?? f.__areaKm2 ?? 0
    if (areaKm2 <= 0) continue
    rows.push({
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
    })
  }

  rows.sort((a, b) => {
    if (sortBy === 'pct') return b.fractionLost - a.fractionLost
    if (sortBy === 'temp') return b.absoluteC - a.absoluteC
    if (sortBy === 'rain') return b.futureMm - a.futureMm
    if (sortBy === 'rainDelta') return b.deltaFrac - a.deltaFrac
    return b.areaLostKm2 - a.areaLostKm2
  })

  if (sortBy === 'area' || sortBy === 'pct') {
    return rows.filter((r) => r.areaLostKm2 > 1).slice(0, limit)
  }
  return rows.slice(0, limit)
}
