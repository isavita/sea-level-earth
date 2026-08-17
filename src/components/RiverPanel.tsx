import { useMemo, useState } from 'react'
import {
  RIVER_EXPLAINERS,
  formatKm3,
  freshwaterSummary,
  type RiverState,
} from '../data/rivers'

interface RiverPanelProps {
  warmingC: number
  year: number
  selectedRiverId: string | null
  onSelectRiver: (id: string | null) => void
}

const STRESS_LABEL: Record<RiverState['stress'], string> = {
  rising: 'More water',
  stable: 'Near today',
  declining: 'Declining',
  severe: 'Severe loss',
}

function formatPct(frac: number): string {
  const pct = frac * 100
  if (Math.abs(pct) < 0.5) return '~0%'
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct.toFixed(0)}%`
}

export function RiverPanel({
  warmingC,
  year,
  selectedRiverId,
  onSelectRiver,
}: RiverPanelProps) {
  const [showAll, setShowAll] = useState(false)
  const { states, peopleLosing, peopleGaining, pastPeak } = useMemo(
    () => freshwaterSummary(warmingC),
    [warmingC],
  )

  // Hardest-hit basins first — that is the story worth leading with.
  const ranked = useMemo(
    () => [...states].sort((a, b) => a.deltaFrac - b.deltaFrac),
    [states],
  )
  const visible = showAll ? ranked : ranked.slice(0, 6)

  return (
    <section className="panel river-panel">
      <header className="panel-head">
        <p className="eyebrow">Hydrosphere</p>
        <h2>Rivers & freshwater</h2>
      </header>

      <div className="totals">
        <div>
          <span className="totals-label">People losing river water</span>
          <strong>{peopleLosing.toFixed(0)}M</strong>
          <em>basins down &gt;6% by {year}</em>
        </div>
        <div>
          <span className="totals-label">People gaining</span>
          <strong>{peopleGaining.toFixed(0)}M</strong>
          <em>wetter basins</em>
        </div>
      </div>

      {pastPeak > 0 && (
        <p className="peak-water-flag">
          <strong>{pastPeak}</strong> glacier-fed{' '}
          {pastPeak === 1 ? 'basin has' : 'basins have'} passed{' '}
          <strong>peak water</strong> — the meltwater bonus is over and their
          flow is now falling.
        </p>
      )}

      <ul className="river-list">
        {visible.map((s) => {
          const active = s.river.id === selectedRiverId
          // Bar is flow vs today, where today = 60% of the track width so a
          // rising river still has room to grow.
          const width = Math.max(3, Math.min(100, s.flowFraction * 60))
          return (
            <li key={s.river.id}>
              <button
                type="button"
                className={`river-row${active ? ' active' : ''}`}
                onClick={() => onSelectRiver(active ? null : s.river.id)}
                aria-pressed={active}
              >
                <span className="river-top">
                  <span className="river-name">{s.river.name}</span>
                  <span className={`river-delta ${s.stress}`}>
                    {formatPct(s.deltaFrac)}
                  </span>
                </span>
                <span className="river-track">
                  <i className="river-today" aria-hidden />
                  <i
                    className={`river-fill ${s.stress}`}
                    style={{ width: `${width}%` }}
                  />
                </span>
                <span className="river-meta">
                  <span>
                    {formatKm3(s.river.dischargeKm3)} →{' '}
                    {formatKm3(s.flowKm3)}/yr
                  </span>
                  <span className={`river-pill ${s.stress}`}>
                    {STRESS_LABEL[s.stress]}
                  </span>
                </span>
                {active && (
                  <span className="river-detail">
                    <span className="river-region">{s.river.region}</span>
                    <span>{s.river.note}</span>
                    <span className="river-driver">{s.driver}</span>
                    <span className="river-people">
                      ~{s.river.peopleM}M people in the basin ·{' '}
                      {Math.round(s.river.glacierFrac * 100)}% glacier-fed ·{' '}
                      {Math.round(s.river.snowFrac * 100)}% snow-fed
                    </span>
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>

      <button
        type="button"
        className="text-btn river-more"
        onClick={() => setShowAll((v) => !v)}
      >
        {showAll ? 'Show fewer rivers' : `Show all ${ranked.length} rivers`}
      </button>

      <details className="ice-details">
        <summary>Why warming changes rivers</summary>
        <ul>
          {RIVER_EXPLAINERS.map((item) => (
            <li key={item.title}>
              <strong>{item.title}.</strong> {item.body}
            </li>
          ))}
        </ul>
      </details>
    </section>
  )
}
