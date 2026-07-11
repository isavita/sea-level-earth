import { useMemo, useState } from 'react'
import {
  computeLoss,
  formatArea,
  formatPct,
  type LandLossResult,
} from '../lib/landLoss'
import { rankByLoss, type LossSortKey } from '../lib/countries'
import { useCountries } from '../lib/CountriesContext'
import type { CountryFeature } from '../lib/countries'
import { estimateCountryTemp, formatDeltaC } from '../lib/warming'

interface StatsPanelProps {
  seaLevelM: number
  warmingC: number
  selected: CountryFeature | null
  onSelectId: (id: string) => void
}

export function StatsPanel({
  seaLevelM,
  warmingC,
  selected,
  onSelectId,
}: StatsPanelProps) {
  const { features } = useCountries()
  const [query, setQuery] = useState('')
  const [sortBy, setSortBy] = useState<LossSortKey>('area')

  const ranking = useMemo(
    () => rankByLoss(features, seaLevelM, 25, sortBy),
    [features, seaLevelM, sortBy],
  )

  const totals = useMemo(() => {
    let lost = 0
    let base = 0
    let affected = 0
    for (const f of features) {
      if (!f.__risk || !f.__areaKm2) continue
      const row = computeLoss(f.__risk, seaLevelM, f.__areaKm2)
      if (!row) continue
      base += row.areaKm2
      lost += row.areaLostKm2
      if (row.areaLostKm2 > 1) affected += 1
    }
    return { lost, base, affected, pct: base > 0 ? lost / base : 0 }
  }, [features, seaLevelM])

  const selectedLoss: LandLossResult | null = useMemo(() => {
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
    return features
      .map((f) =>
        f.__risk ? computeLoss(f.__risk, seaLevelM, f.__areaKm2) : null,
      )
      .filter((r): r is LandLossResult => {
        if (!r) return false
        return r.country.name.toLowerCase().includes(q)
      })
      .sort((a, b) =>
        sortBy === 'pct'
          ? b.fractionLost - a.fractionLost
          : b.areaLostKm2 - a.areaLostKm2,
      )
      .slice(0, 25)
  }, [query, ranking, features, seaLevelM, sortBy])

  return (
    <section className="panel stats">
      <header className="panel-head">
        <p className="eyebrow">Territory</p>
        <h2>Land & temperature</h2>
      </header>

      <div className="totals">
        <div>
          <span className="totals-label">Est. land lost globally</span>
          <strong>{formatArea(totals.lost)}</strong>
          <em>{formatPct(totals.pct)} of measured land</em>
        </div>
        <div>
          <span className="totals-label">Countries affected</span>
          <strong>{totals.affected}</strong>
          <em>with &gt;1 km² exposed</em>
        </div>
      </div>

      {selected && selectedLoss && selectedTemp && (
        <article className="country-card">
          <div className="country-card-top">
            <h3>{selectedLoss.country.name}</h3>
            <button type="button" className="text-btn" onClick={() => onSelectId('')}>
              Clear
            </button>
          </div>
          <dl className="country-metrics four">
            <div>
              <dt>Land left</dt>
              <dd>{formatArea(selectedLoss.areaRemainingKm2)}</dd>
            </div>
            <div>
              <dt>Land lost</dt>
              <dd className="danger">
                {formatArea(selectedLoss.areaLostKm2)}
                <span>{formatPct(selectedLoss.fractionLost)}</span>
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
            amplification). This is a latitude-based sketch, not a full climate
            model.
            {selectedLoss.country.pctBelow5m > 0 &&
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
                  className={
                    sortBy === 'area' ? 'sort-btn active' : 'sort-btn'
                  }
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
                  % land{sortBy === 'pct' ? ' ↓' : ''}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => {
              const active = selected?.properties.id === row.country.id
              return (
                <tr
                  key={row.country.id}
                  className={active ? 'active' : undefined}
                  onClick={() => onSelectId(row.country.id)}
                >
                  <td>{row.country.name}</td>
                  <td>{formatArea(row.areaLostKm2)}</td>
                  <td>{formatPct(row.fractionLost)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="footnote">
        Borders: Natural Earth. Coasts: LECZ ≤5 m. Ice & warming: IPCC
        AR6–shaped illustrative curves. Not a local engineering flood map.
      </p>
    </section>
  )
}
