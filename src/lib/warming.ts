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

/** Map fill: cool slate → yellow → amber → rust by local warming vs pre-industrial. */
export function tempColor(absoluteC: number, hovered: boolean): string {
  // Anchor ~1°C (near today) → ~10°C+ (catastrophic local)
  const t = Math.max(0, Math.min(1, (absoluteC - 1.0) / 9.0))
  // pale cool → warm cream → orange → deep rust
  const stops = [
    { t: 0, r: 168, g: 196, b: 188 },
    { t: 0.25, r: 214, g: 210, b: 160 },
    { t: 0.5, r: 232, g: 168, b: 92 },
    { t: 0.75, r: 196, g: 92, b: 48 },
    { t: 1, r: 140, g: 36, b: 28 },
  ]
  let i = 0
  while (i < stops.length - 2 && t > stops[i + 1].t) i += 1
  const a = stops[i]
  const b = stops[i + 1]
  const u = (t - a.t) / (b.t - a.t || 1)
  const r = Math.round(a.r + u * (b.r - a.r))
  const g = Math.round(a.g + u * (b.g - a.g))
  const bl = Math.round(a.b + u * (b.b - a.b))
  const alpha = hovered ? 0.98 : 0.94
  return `rgba(${r}, ${g}, ${bl}, ${alpha})`
}

export const TEMP_LEGEND = [
  { label: '+1°C', color: 'rgb(168, 196, 188)' },
  { label: '+3°C', color: 'rgb(214, 210, 160)' },
  { label: '+5°C', color: 'rgb(232, 168, 92)' },
  { label: '+8°C', color: 'rgb(196, 92, 48)' },
  { label: '+10°C+', color: 'rgb(140, 36, 28)' },
] as const
