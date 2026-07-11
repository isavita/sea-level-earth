import { feature } from 'topojson-client'
import { geoArea } from 'd3-geo'
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import type { CountryRisk, CountryRiskFile } from './landLoss'
import { computeLoss } from './landLoss'

export type CountryFeature = Feature<Geometry, { name: string; id: string }> & {
  __risk?: CountryRisk
  __areaKm2?: number
}

type CountriesTopology = {
  type: 'Topology'
  objects: {
    countries: {
      type: 'GeometryCollection'
      geometries: Array<{
        type: string
        id?: string | number
        properties?: { name?: string }
        arcs?: unknown
      }>
    }
  }
  arcs: unknown
}

const EARTH_KM2 = 510_072_000
// geoArea returns steradians; Earth surface ≈ 4π sr → km² factor:
const SR_TO_KM2 = EARTH_KM2 / (4 * Math.PI)

export async function loadCountries(): Promise<{
  features: CountryFeature[]
  riskById: Map<string, CountryRisk>
  sourceNote: string
}> {
  const [topoRes, riskRes] = await Promise.all([
    fetch('/countries-50m.json'),
    fetch('/country-risk.json'),
  ])
  const topo = (await topoRes.json()) as CountriesTopology
  const riskFile = (await riskRes.json()) as CountryRiskFile

  const riskById = new Map(riskFile.countries.map((c) => [c.id, c]))
  const fc = feature(
    topo as never,
    topo.objects.countries as never,
  ) as unknown as FeatureCollection<Geometry, { name: string }>

  const features: CountryFeature[] = fc.features.map((f) => {
    const id = String((f as { id?: string | number }).id ?? '')
    const risk = riskById.get(id)
    const areaFromGeo = geoArea(f) * SR_TO_KM2
    const named: CountryFeature = {
      ...f,
      properties: {
        name: f.properties?.name ?? risk?.name ?? 'Unknown',
        id,
      },
      __risk: risk,
      __areaKm2: risk?.areaKm2 ?? areaFromGeo,
    }
    return named
  })

  return {
    features,
    riskById,
    sourceNote: riskFile.source,
  }
}

export type LossSortKey = 'area' | 'pct'

export function rankByLoss(
  features: CountryFeature[],
  seaLevelM: number,
  limit = 20,
  sortBy: LossSortKey = 'area',
) {
  const rows = features
    .map((f) => {
      if (!f.__risk) return null
      return computeLoss(f.__risk, seaLevelM, f.__areaKm2)
    })
    .filter((r): r is NonNullable<typeof r> => r != null && r.areaLostKm2 > 1)
    .sort((a, b) =>
      sortBy === 'pct'
        ? b.fractionLost - a.fractionLost
        : b.areaLostKm2 - a.areaLostKm2,
    )
    .slice(0, limit)

  return rows
}

/** Color for % land lost — cool slate → amber → rust. */
export function lossColor(fractionLost: number, hovered: boolean): string {
  if (fractionLost <= 0.0005) {
    return hovered ? 'rgba(214, 222, 208, 0.98)' : 'rgba(196, 206, 192, 0.94)'
  }
  const t = Math.min(1, Math.pow(fractionLost / 0.35, 0.65))
  const r = Math.round(196 + t * (176 - 196))
  const g = Math.round(206 - t * 125)
  const b = Math.round(192 - t * 145)
  const a = hovered ? 0.98 : 0.94
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

export function oceanColor(seaLevelM: number): string {
  // Deeper teal as seas rise
  const t = Math.min(1, seaLevelM / 1.5)
  const r = Math.round(18 + t * 8)
  const g = Math.round(52 - t * 10)
  const b = Math.round(68 + t * 20)
  return `rgb(${r}, ${g}, ${b})`
}
