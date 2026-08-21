import { feature } from 'topojson-client'
import { lift } from './mapColor'
import { geoArea } from 'd3-geo'
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import type { CountryRisk, CountryRiskFile } from './landLoss'
import { computeLoss } from './landLoss'
import { optimiseForGlobe } from './globeGeometry'

export type CountryFeature = Feature<Geometry, { name: string; id: string }> & {
  __risk?: CountryRisk
  __areaKm2?: number
  /**
   * The country's *coastline* — interleaved lng, lat — as opposed to its
   * outline, which is mostly land border.
   *
   * Derived from arc sharing in the topology: a boundary arc that belongs to
   * exactly one country has no country on its other side, so it faces water.
   * That test is free here and impossible downstream, because the decoded
   * GeoJSON has thrown the sharing away, and every layer that has wanted to ask
   * "which sea is beside this country" has had to guess from the outline
   * instead. Guessing gets it wrong in both directions: Algeria's Saharan
   * frontier at 19°N reads as tropical water 1,500 km from any, and Argentina's
   * Andean border falls inside the Humboldt upwelling box while its actual
   * coast is the warm South Atlantic.
   */
  __coast?: Float32Array
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

/**
 * Keep every Nth coastline vertex.
 *
 * The 50m coastline is far denser than anything reading it needs — the coarsest
 * consumer asks which of a dozen multi-degree sea boxes a point falls in — and
 * storing all of it for 241 countries costs about 1 MB to answer a question
 * that a point every few kilometres answers identically.
 */
const COAST_STRIDE = 4

/** Every arc index a topology geometry references, with `~i` unwound. */
function eachArcIndex(arcs: unknown, fn: (index: number) => void): void {
  if (typeof arcs === 'number') fn(arcs < 0 ? ~arcs : arcs)
  else if (Array.isArray(arcs)) for (const a of arcs) eachArcIndex(a, fn)
}

export interface LoadedCountries {
  features: CountryFeature[]
  riskById: Map<string, CountryRisk>
  sourceNote: string
}

/**
 * Decoding is memoised on the module, not the component. StrictMode mounts the
 * provider twice in development, and without this the whole 756 KB topology is
 * fetched and re-decoded on the second pass.
 */
let inFlight: Promise<LoadedCountries> | null = null

export function loadCountries(): Promise<LoadedCountries> {
  inFlight ??= fetchCountries()
  return inFlight
}

async function fetchCountries(): Promise<LoadedCountries> {
  const [topoRes, riskRes] = await Promise.all([
    fetch('/countries-50m.json'),
    fetch('/country-risk.json'),
  ])
  const topo = (await topoRes.json()) as CountriesTopology
  const riskFile = (await riskRes.json()) as CountryRiskFile

  // Natural Earth reuses one M49 code for more than one feature — Australia and
  // Ashmore & Cartier Is. are both "036", and five disputed territories are all
  // "None". A plain id→risk map lets the last of each pair win, which handed
  // Australia's 7.7 M km² to a group of uninhabited islets and double-counted
  // it in the global totals. Match on id *and* name, and treat an ambiguous id
  // with no name match as having no risk record at all.
  const riskByIdName = new Map(
    riskFile.countries.map((c) => [`${c.id}\u0000${c.name}`, c]),
  )
  const riskByUniqueId = new Map<string, CountryRisk | null>()
  for (const c of riskFile.countries) {
    riskByUniqueId.set(c.id, riskByUniqueId.has(c.id) ? null : c)
  }
  const lookupRisk = (id: string, name: string): CountryRisk | undefined =>
    riskByIdName.get(`${id}\u0000${name}`) ?? riskByUniqueId.get(id) ?? undefined

  const riskById = new Map(
    riskFile.countries.filter((c) => riskByUniqueId.get(c.id)).map((c) => [c.id, c]),
  )
  const fc = feature(
    topo as never,
    topo.objects.countries as never,
  ) as unknown as FeatureCollection<Geometry, { name: string }>

  // How many countries each boundary arc belongs to. One means the far side is
  // not another country, which on this dataset means water.
  const arcUse = new Map<number, number>()
  for (const g of topo.objects.countries.geometries) {
    eachArcIndex(g.arcs, (i) => arcUse.set(i, (arcUse.get(i) ?? 0) + 1))
  }
  const coastByIndex = topo.objects.countries.geometries.map((g) => {
    const solo: number[][] = []
    eachArcIndex(g.arcs, (i) => {
      if (arcUse.get(i) === 1) solo.push([i])
    })
    if (solo.length === 0) return undefined
    // Decoded through topojson rather than by hand: the arcs are delta-encoded
    // against the topology's own quantisation, and reimplementing that here
    // would be a second, silently divergent copy of it.
    const lines = feature(topo as never, {
      type: 'MultiLineString',
      arcs: solo,
    } as never) as unknown as Feature<{
      type: 'MultiLineString'
      coordinates: number[][][]
    }>
    const out: number[] = []
    for (const line of lines.geometry.coordinates) {
      for (let i = 0; i < line.length; i += COAST_STRIDE) {
        out.push(line[i][0], line[i][1])
      }
    }
    return out.length > 0 ? new Float32Array(out) : undefined
  })

  const features: CountryFeature[] = fc.features.map((f, index) => {
    const id = String((f as { id?: string | number }).id ?? '')
    const name = f.properties?.name ?? 'Unknown'
    const risk = lookupRisk(id, name)
    const areaFromGeo = geoArea(f) * SR_TO_KM2
    const named: CountryFeature = {
      ...f,
      // Reshaped so the globe never hits its quadratic triangulation path —
      // ~10 ms here saves ~4.4 s of geometry building. Area and centroid are
      // preserved, so every downstream model reads the same numbers.
      geometry: optimiseForGlobe(f.geometry),
      properties: {
        name: f.properties?.name ?? risk?.name ?? 'Unknown',
        id,
      },
      __risk: risk,
      __areaKm2: risk?.areaKm2 ?? areaFromGeo,
      __coast: coastByIndex[index],
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
    return lift(196, 206, 192, hovered)
  }
  const t = Math.min(1, Math.pow(fractionLost / 0.35, 0.65))
  const r = Math.round(196 + t * (176 - 196))
  const g = Math.round(206 - t * 125)
  const b = Math.round(192 - t * 145)
  return lift(r, g, b, hovered)
}

export function oceanColor(seaLevelM: number): string {
  // Deeper teal as seas rise
  const t = Math.min(1, seaLevelM / 1.5)
  const r = Math.round(18 + t * 8)
  const g = Math.round(52 - t * 10)
  const b = Math.round(68 + t * 20)
  return `rgb(${r}, ${g}, ${b})`
}
