import { useMemo, useState } from 'react'
import {
  computeLoss,
  formatArea,
  formatPct,
} from '../lib/landLoss'
import { useCountries } from '../lib/CountriesContext'
import type { CountryFeature } from '../lib/countries'
import { estimateCountryTemp, formatDeltaC } from '../lib/warming'
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
    let affected = 0
    let hottest = 0
    for (const f of features) {
      if (!f.__areaKm2) continue
      const temp = estimateCountryTemp(f, warmingC)
      hottest = Math.max(hottest, temp.absoluteC)
      if (!f.__risk) continue
      const row = computeLoss(f.__risk, seaLevelM, f.__areaKm2)
      if (!row) continue
      base += row.areaKm2
      lost += row.areaLostKm2
      if (row.areaLostKm2 > 1) affected += 1
    }
    return {
      lost,
      base,
      affected,
      pct: base > 0 ? lost / base : 0,
      hottest,
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return ranking
    return rankByImpact(features, seaLevelM, warmingC, 500, sortBy).filter(
      (r) => r.name.toLowerCase().includes(q),
    ).slice(0, 30)
  }, [query, ranking, features, seaLevelM, warmingC, sortBy])

  return (
    <section className="panel stats">
      <header className="panel-head">
        <p className="eyebrow">Territory</p>
        <h2>Land & temperature</h2>
      </header>

      <div className="map-mode-switch" role="tablist" aria-label="Map colour">
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
          Map: temperature
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
          Map: land loss
        </button>
      </div>

      <div className="totals">
        <div>
          <span className="totals-label">Est. land lost globally</span>
          <strong>{formatArea(totals.lost)}</strong>
          <em>{formatPct(totals.pct)} of measured land</em>
        </div>
        <div>
          <span className="totals-label">Hottest local warming</span>
          <strong>+{totals.hottest.toFixed(1)}°C</strong>
          <em>vs pre-industrial</em>
        </div>
      </div>

      {selected && selectedTemp && (
        <article className="country-card">
          <div className="country-card-top">
            <h3>{selected.properties.name}</h3>
            <button type="button" className="text-btn" onClick={() => onSelectId('')}>
              Clear
            </button>
          </div>
          <dl className="country-metrics four">
            <div>
              <dt>Land left</dt>
              <dd>
                {formatArea(
                  selectedLoss?.areaRemainingKm2 ?? selected.__areaKm2 ?? 0,
                )}
              </dd>
            </div>
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
                <span>vs pre-industrial</span>
              </dd>
            </div>
            <div>
              <dt>Since 2020s</dt>
              <dd>
                {formatDeltaC(selectedTemp.deltaSince2020C)}
                <span>{selectedTemp.multiplier.toFixed(1)}× global</span>
              </dd>
            </div>
          </dl>
          <p className="hint">
            High-latitude countries warm faster than the global average (Arctic
            amplification). Sketch based on latitude — not a full climate model.
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
                  className={sortBy === 'pct' ? 'sort-btn active' : 'sort-btn'}
                  onClick={() => setSortBy('pct')}
                  aria-pressed={sortBy === 'pct'}
                >
                  %{sortBy === 'pct' ? ' ↓' : ''}
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
                  <td>{formatPct(row.fractionLost)}</td>
                  <td className="temp-cell">+{row.absoluteC.toFixed(1)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="footnote">
        Δ°C is local mean warming vs pre-industrial (latitude amplification).
        Sort by Lost, %, or temperature. Map colours follow the toggle above.
      </p>
    </section>
  )
}
