import {
  SCENARIOS,
  SCENARIO_ORDER,
  YEAR_MAX,
  YEAR_MIN,
  type ScenarioId,
} from '../data/scenarios'

interface ControlPanelProps {
  scenarioId: ScenarioId
  year: number
  seaLevelM: number
  warmingC: number
  playing: boolean
  /**
   * Phones render the transport in the sheet header instead, so this panel
   * omits its own. Two year sliders would mean a duplicate `year-slider` id.
   */
  showTimeline?: boolean
  onScenario: (id: ScenarioId) => void
  onYear: (year: number) => void
  onTogglePlay: () => void
}

/** Hottest 2100 value across pathways, for scaling the comparison bars. */
const MAX_2100_C = Math.max(
  ...SCENARIO_ORDER.map((id) => SCENARIOS[id].warmingByYear[2100]),
)

export function ControlPanel({
  scenarioId,
  year,
  seaLevelM,
  warmingC,
  playing,
  showTimeline = true,
  onScenario,
  onYear,
  onTogglePlay,
}: ControlPanelProps) {
  const scenario = SCENARIOS[scenarioId]
  const atEnd = year >= YEAR_MAX
  const yearPct = ((year - YEAR_MIN) / (YEAR_MAX - YEAR_MIN)) * 100

  return (
    <section className="panel controls">
      <header className="panel-head">
        <p className="eyebrow">Projection</p>
        <h2>Warming pathway</h2>
      </header>

      {/* Radiogroup, not a tablist: these pick a value, they don't reveal
          panels, and role="tab" without a tabpanel is an invalid pattern. */}
      <div
        className="scenario-switch multi"
        role="radiogroup"
        aria-label="Climate scenario"
      >
        {SCENARIO_ORDER.map((id) => {
          const s = SCENARIOS[id]
          const active = id === scenarioId
          const share = (s.warmingByYear[2100] / MAX_2100_C) * 100
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={active}
              className={active ? 'scenario active' : 'scenario'}
              onClick={() => onScenario(id)}
              style={{ ['--sc' as string]: s.color }}
            >
              <span className="scenario-label">{s.shortLabel}</span>
              <span className="scenario-warm">{s.warmingLabel}</span>
              <span className="scenario-bar" aria-hidden>
                <i style={{ width: `${share}%` }} />
              </span>
            </button>
          )
        })}
      </div>

      {/* Controls come before the reading material: on a phone the play button
          used to sit below two long bullet lists. */}
      {showTimeline && (
      <div className="year-block">
        <div className="year-row">
          <button
            type="button"
            className={`play-btn${playing ? ' playing' : ''}`}
            onClick={onTogglePlay}
            aria-label={
              playing ? 'Pause timeline' : atEnd ? 'Replay timeline' : 'Play timeline'
            }
            aria-pressed={playing}
          >
            <span className="play-icon" aria-hidden>
              {playing ? '❙❙' : atEnd ? '↺' : '▶'}
            </span>
            <span className="play-text">
              {playing ? 'Pause' : atEnd ? 'Replay' : 'Play'}
            </span>
          </button>
          <div className="year-readout">
            <label htmlFor="year-slider">Year</label>
            <strong>{year}</strong>
          </div>
        </div>
        <input
          id="year-slider"
          type="range"
          min={YEAR_MIN}
          max={YEAR_MAX}
          step={5}
          value={year}
          onChange={(e) => onYear(Number(e.target.value))}
          /* Drives the filled portion of the custom track. */
          style={{ ['--pct' as string]: `${yearPct}%` }}
        />
        <div className="year-ticks">
          <span>{YEAR_MIN}</span>
          <span>2100</span>
          <span>2200</span>
          <span>{YEAR_MAX}</span>
        </div>
      </div>
      )}

      <dl className="metrics">
        <div>
          <dt>Global mean sea level</dt>
          <dd>
            +{seaLevelM.toFixed(2)} m
            <span>vs 1995–2014</span>
          </dd>
        </div>
        <div>
          <dt>Global warming</dt>
          <dd>
            +{warmingC.toFixed(2)}°C
            <span>vs pre-industrial</span>
          </dd>
        </div>
      </dl>

      <div className="scenario-detail" style={{ ['--sc' as string]: scenario.color }}>
        <div className="scenario-detail-top">
          <h3>{scenario.label}</h3>
          <span className={`plausibility ${scenario.plausibilityTone}`}>
            {scenario.plausibility}
          </span>
        </div>
        <p className="scenario-desc">{scenario.description}</p>
      </div>

      <details className="scenario-details" open>
        <summary>What this world looks like by 2100</summary>
        <ul className="at-a-glance">
          {scenario.atAGlance.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </details>

      <details className="scenario-details">
        <summary>What it takes to get here</summary>
        <ul>
          {scenario.whatItTakes.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </details>
    </section>
  )
}
