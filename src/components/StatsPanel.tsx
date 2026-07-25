import { useMemo, useState } from 'react'
import {
  computeLoss,
  formatArea,
  formatPct,
} from '../lib/landLoss'
import { useCountries } from '../lib/CountriesContext'
import type { CountryFeature } from '../lib/countries'
import { estimateCountryTemp, formatDeltaC } from '../lib/warming'
import {
  estimateCountryRain,
  formatDeltaFrac,
  formatDeltaMm,
  formatMm,
} from '../lib/rain'
import { rankByImpact, type ImpactSortKey } from '../lib/impact'
import type { MapMode } from './EarthGlobe'

interface StatsPanelProps {
  seaLevelM: number
  warmingC: number
  mapMode: MapMode
  onMapMode: (mode: MapMode) => void
  selected: CountryFeature | null
  onSelectId: (id: string) => void
}

export function StatsPanel({
  seaLevelM,
  warmingC,
  mapMode,
  onMapMode,
  selected,
  onSelectId,
}: StatsPanelProps) {
  const { features } = useCountries()
  const [query, setQuery] = useState('')
  const [sortBy, setSortBy] = useState<ImpactSortKey>('temp')

  const ranking = useMemo(
    () => rankByImpact(features, seaLevelM, warmingC, 30, sortBy),
    [features, seaLevelM, warmingC, sortBy],
  )

  const totals = useMemo(() => {
    let lost = 0
    let base = 0
    let hottest = 0
    let wettestDelta = -Infinity
    let driestDelta = Infinity
    for (const f of features) {
      if (!f.__areaKm2) continue
      const temp = estimateCountryTemp(f, warmingC)
      const rain = estimateCountryRain(f, warmingC)
      hottest = Math.max(hottest, temp.absoluteC)
      wettestDelta = Math.max(wettestDelta, rain.deltaFrac)
      driestDelta = Math.min(driestDelta, rain.deltaFrac)
      if (!f.__risk) continue
      const row = computeLoss(f.__risk, seaLevelM, f.__areaKm2)
      if (!row) continue
      base += row.areaKm2
      lost += row.areaLostKm2
    }
    return {
      lost,
      pct: base > 0 ? lost / base : 0,
      hottest,
      wettestDelta: Number.isFinite(wettestDelta) ? wettestDelta : 0,
      driestDelta: Number.isFinite(driestDelta) ? driestDelta : 0,
    }
  }, [features, seaLevelM, warmingC])

  const selectedLoss = useMemo(() => {
    if (!selected?.__risk) return null
    return computeLoss(selected.__risk, seaLevelM, selected.__areaKm2)
  }, [selected, seaLevelM])

  const selectedTemp = useMemo(() => {
    if (!selected) return null
    return estimateCountryTemp(selected, warmingC)
  }, [selected, warmingC])

  const selectedRain = useMemo(() => {
    if (!selected) return null
    return estimateCountryRain(selected, warmingC)
  }, [selected, warmingC])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return ranking
    return rankByImpact(features, seaLevelM, warmingC, 500, sortBy)
      .filter((r) => r.name.toLowerCase().includes(q))
      .slice(0, 30)
  }, [query, ranking, features, seaLevelM, warmingC, sortBy])

  return (
    <section className="panel stats">
      <header className="panel-head">
        <p className="eyebrow">Territory</p>
        <h2>Land, heat & rain</h2>
      </header>

      <div className="map-mode-switch three" role="tablist" aria-label="Map colour">
        <button
          type="button"
          role="tab"
          aria-selected={mapMode === 'temp'}
          className={mapMode === 'temp' ? 'active' : undefined}
          onClick={() => {
            onMapMode('temp')
            setSortBy('temp')
          }}
        >
          Temperature
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mapMode === 'rain'}
          className={mapMode === 'rain' ? 'active' : undefined}
          onClick={() => {
            onMapMode('rain')
            setSortBy('rainDelta')
          }}
        >
          Rain
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mapMode === 'loss'}
          className={mapMode === 'loss' ? 'active' : undefined}
          onClick={() => {
            onMapMode('loss')
            setSortBy('area')
          }}
        >
          Land loss
        </button>
      </div>

      <div className="totals">
        <div>
          <span className="totals-label">Est. land lost globally</span>
          <strong>{formatArea(totals.lost)}</strong>
          <em>{formatPct(totals.pct)} of measured land</em>
        </div>
        <div>
          <span className="totals-label">
            {mapMode === 'rain' ? 'Largest rain swings' : 'Hottest local warming'}
          </span>
          <strong>
            {mapMode === 'rain'
              ? `${formatDeltaFrac(totals.wettestDelta)} / ${formatDeltaFrac(totals.driestDelta)}`
              : `+${totals.hottest.toFixed(1)}°C`}
          </strong>
          <em>
            {mapMode === 'rain' ? 'wettest / driest Δ%' : 'vs pre-industrial'}
          </em>
        </div>
      </div>

      {selected && selectedTemp && selectedRain && (
        <article className="country-card">
          <div className="country-card-top">
            <h3>{selected.properties.name}</h3>
            <button type="button" className="text-btn" onClick={() => onSelectId('')}>
              Clear
            </button>
          </div>
          <dl className="country-metrics four">
            <div>
              <dt>Land lost</dt>
              <dd className="danger">
                {formatArea(selectedLoss?.areaLostKm2 ?? 0)}
                <span>{formatPct(selectedLoss?.fractionLost ?? 0)}</span>
              </dd>
            </div>
            <div>
              <dt>Local warming</dt>
              <dd>
                +{selectedTemp.absoluteC.toFixed(1)}°C
                <span>{formatDeltaC(selectedTemp.deltaSince2020C)} since 2020s</span>
              </dd>
            </div>
            <div>
              <dt>Rain now→future</dt>
              <dd>
                {formatMm(selectedRain.futureMm)}
                <span>from {formatMm(selectedRain.baselineMm)}</span>
              </dd>
            </div>
            <div>
              <dt>Rain Δ</dt>
              <dd className={selectedRain.deltaMm < 0 ? 'danger' : undefined}>
                {formatDeltaMm(selectedRain.deltaMm)}
                <span>{formatDeltaFrac(selectedRain.deltaFrac)}</span>
              </dd>
            </div>
          </dl>
          <p className="hint">
            Rain baseline from World Bank where available; change is a
            latitude-pattern sketch scaled by warming (subtropics often drier,
            high latitudes / deep tropics wetter) — not a full climate model.
            {selectedLoss &&
              selectedLoss.country.pctBelow5m > 0 &&
              ` ${selectedLoss.country.pctBelow5m.toFixed(1)}% of land is ≤5 m (LECZ).`}
          </p>
        </article>
      )}

      <div className="search-row">
        <input
          type="search"
          placeholder="Search country…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search country"
        />
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Country</th>
              <th>
                <button
                  type="button"
                  className={sortBy === 'area' ? 'sort-btn active' : 'sort-btn'}
                  onClick={() => setSortBy('area')}
                  aria-pressed={sortBy === 'area'}
                >
                  Lost{sortBy === 'area' ? ' ↓' : ''}
                </button>
              </th>
              <th>
                <button
                  type="button"
                  className={sortBy === 'temp' ? 'sort-btn active' : 'sort-btn'}
                  onClick={() => setSortBy('temp')}
                  aria-pressed={sortBy === 'temp'}
                >
                  Δ°C{sortBy === 'temp' ? ' ↓' : ''}
                </button>
              </th>
              <th>
                <button
                  type="button"
                  className={
                    sortBy === 'rainDelta' ? 'sort-btn active' : 'sort-btn'
                  }
                  onClick={() => setSortBy('rainDelta')}
                  aria-pressed={sortBy === 'rainDelta'}
                >
                  Δ rain{sortBy === 'rainDelta' ? ' ↓' : ''}
                </button>
              </th>
              <th>
                <button
                  type="button"
                  className={sortBy === 'rain' ? 'sort-btn active' : 'sort-btn'}
                  onClick={() => setSortBy('rain')}
                  aria-pressed={sortBy === 'rain'}
                >
                  mm{sortBy === 'rain' ? ' ↓' : ''}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => {
              const active = selected?.properties.id === row.id
              return (
                <tr
                  key={row.id}
                  className={active ? 'active' : undefined}
                  onClick={() => onSelectId(row.id)}
                >
                  <td>{row.name}</td>
                  <td>{formatArea(row.areaLostKm2)}</td>
                  <td className="temp-cell">+{row.absoluteC.toFixed(1)}</td>
                  <td className={row.deltaMm < 0 ? 'rain-dry' : 'rain-wet'}>
                    {formatDeltaFrac(row.deltaFrac)}
                  </td>
                  <td>{row.futureMm.toFixed(0)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="footnote">
        Δ°C vs pre-industrial; rain mm/yr is projected annual depth; Δ rain is
        vs ~2020s baseline. Sort any column. Map colours follow the toggle.
      </p>
    </section>
  )
}
