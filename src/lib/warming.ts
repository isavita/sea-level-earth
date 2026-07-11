import { geoCentroid } from 'd3-geo'
import type { CountryFeature } from '../lib/countries'

/**
 * Rough country warming vs global mean: land + high latitudes warm more (Arctic amplification).
 * Illustrative — not a full CMIP downscaling.
 */
export function countryWarmingMultiplier(feature: CountryFeature): number {
  const [, lat] = geoCentroid(feature)
  const absLat = Math.abs(lat || 0)
  const latFactor = 0.85 + 1.45 * Math.pow(absLat / 90, 1.35)
  return Math.min(2.6, Math.max(0.75, latFactor))
}

export interface CountryTemp {
  absoluteC: number
  deltaSince2020C: number
  multiplier: number
}

export function estimateCountryTemp(
  feature: CountryFeature,
  globalWarmingC: number,
  baselineGlobalC = 1.15,
): CountryTemp {
  const multiplier = countryWarmingMultiplier(feature)
  const absoluteC = globalWarmingC * multiplier
  const around2020 = baselineGlobalC * multiplier
  return {
    absoluteC,
    deltaSince2020C: absoluteC - around2020,
    multiplier,
  }
}

export function formatDeltaC(d: number): string {
  const sign = d >= 0 ? '+' : ''
  return `${sign}${d.toFixed(1)}°C`
}
