export type ElevationKey = 1 | 2 | 3 | 5 | 7 | 10

export interface CountryRisk {
  id: string
  iso3: string | null
  name: string
  areaKm2: number | null
  pctBelow5m: number
  popPctBelow5m: number | null
  fracAt: Record<string, number>
  /** Annual precipitation depth (mm/yr) from World Bank when available. */
  precipMm?: number | null
  precipYear?: number | null
}

export interface CountryRiskFile {
  source: string
  year: number
  countries: CountryRisk[]
}

export interface LandLossResult {
  country: CountryRisk
  areaKm2: number
  fractionLost: number
  areaLostKm2: number
  areaRemainingKm2: number
}

/** Interpolate cumulative low-elevation land fraction at sea-level rise height (m). */
export function fractionLostAtRise(
  country: CountryRisk,
  seaLevelM: number,
): number {
  if (seaLevelM <= 0 || country.pctBelow5m <= 0) return 0

  const keys: ElevationKey[] = [1, 2, 3, 5, 7, 10]
  const points = keys.map((h) => ({
    h,
    f: country.fracAt[String(h)] ?? 0,
  }))

  if (seaLevelM >= 10) {
    // Beyond 10 m: gentle extrapolation capped by 100%
    const f10 = points[points.length - 1].f
    const extra = Math.min(0.15, ((seaLevelM - 10) / 20) * 0.15)
    return Math.min(1, f10 + extra * Math.min(1, country.pctBelow5m / 30))
  }

  if (seaLevelM <= points[0].h) {
    return points[0].f * (seaLevelM / points[0].h)
  }

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    if (seaLevelM >= a.h && seaLevelM <= b.h) {
      const t = (seaLevelM - a.h) / (b.h - a.h)
      return a.f + t * (b.f - a.f)
    }
  }

  return points[points.length - 1].f
}

export function computeLoss(
  country: CountryRisk,
  seaLevelM: number,
  fallbackAreaKm2?: number,
): LandLossResult | null {
  const areaKm2 = country.areaKm2 ?? fallbackAreaKm2
  if (areaKm2 == null || areaKm2 <= 0) return null

  const fractionLost = fractionLostAtRise(country, seaLevelM)
  const areaLostKm2 = areaKm2 * fractionLost
  return {
    country,
    areaKm2,
    fractionLost,
    areaLostKm2,
    areaRemainingKm2: areaKm2 - areaLostKm2,
  }
}

export function formatArea(km2: number): string {
  if (km2 >= 1_000_000) return `${(km2 / 1_000_000).toFixed(2)} M km²`
  if (km2 >= 1_000) return `${(km2 / 1_000).toFixed(1)} k km²`
  if (km2 >= 10) return `${km2.toFixed(0)} km²`
  return `${km2.toFixed(1)} km²`
}

export function formatPct(fraction: number): string {
  const pct = fraction * 100
  if (pct > 0 && pct < 0.01) return '<0.01%'
  if (pct < 10) return `${pct.toFixed(2)}%`
  return `${pct.toFixed(1)}%`
}
