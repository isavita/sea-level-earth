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
  onScenario: (id: ScenarioId) => void
  onYear: (year: number) => void
  onTogglePlay: () => void
}

export function ControlPanel({
  scenarioId,
  year,
  seaLevelM,
  warmingC,
  playing,
  onScenario,
  onYear,
  onTogglePlay,
}: ControlPanelProps) {
  const scenario = SCENARIOS[scenarioId]
  const atEnd = year >= YEAR_MAX

  return (
    <section className="panel controls">
      <header className="panel-head">
        <p className="eyebrow">Projection</p>
        <h2>Warming pathway</h2>
      </header>

      <div className="scenario-switch multi" role="tablist" aria-label="Climate scenario">
        {SCENARIO_ORDER.map((id) => {
          const s = SCENARIOS[id]
          const active = id === scenarioId
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              className={active ? 'scenario active' : 'scenario'}
              onClick={() => onScenario(id)}
              style={{ ['--sc' as string]: s.color }}
            >
              <span className="scenario-label">{s.shortLabel}</span>
              <span className="scenario-warm">{s.warmingLabel}</span>
            </button>
          )
        })}
      </div>

      <p className="scenario-desc">{scenario.description}</p>

      <div
        className="what-it-takes"
        style={{ ['--sc' as string]: scenario.color }}
      >
        <p className="what-it-takes-title">What it takes for this to happen</p>
        <ul>
          {scenario.whatItTakes.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

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
        />
        <div className="year-ticks">
          <span>{YEAR_MIN}</span>
          <span>2100</span>
          <span>2200</span>
          <span>{YEAR_MAX}</span>
        </div>
      </div>

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
    </section>
  )
}
