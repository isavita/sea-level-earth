import { useMemo, useState } from 'react'
import { ControlPanel } from './components/ControlPanel'
import { EarthGlobe } from './components/EarthGlobe'
import { IcePanel } from './components/IcePanel'
import { StatsPanel } from './components/StatsPanel'
import {
  SCENARIOS,
  seaLevelAt,
  warmingAt,
  type ScenarioId,
} from './data/scenarios'
import { iceState } from './data/ice'
import { CountriesProvider, useCountries } from './lib/CountriesContext'
import type { CountryFeature } from './lib/countries'
import './App.css'

function AppShell() {
  const { getById } = useCountries()
  const [scenarioId, setScenarioId] = useState<ScenarioId>('ssp245')
  const [year, setYear] = useState(2100)
  const [selected, setSelected] = useState<CountryFeature | null>(null)

  const scenario = SCENARIOS[scenarioId]
  const seaLevelM = useMemo(
    () => seaLevelAt(scenario, year),
    [scenario, year],
  )
  const warmingC = useMemo(
    () => warmingAt(scenario, year),
    [scenario, year],
  )
  const ice = useMemo(() => iceState(scenario, year), [scenario, year])

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">Meridian</span>
          <span className="brand-sub">Sea level, ice & borders</span>
        </div>
        <p className="lede">
          Six pathways from “no further change” to catastrophic ~8°C — with what
          each would take, ice as bars, and country land & temperature.
        </p>
      </header>

      <main className="layout">
        <aside className="sidebar left">
          <div className="stack">
            <ControlPanel
              scenarioId={scenarioId}
              year={year}
              seaLevelM={seaLevelM}
              warmingC={warmingC}
              onScenario={setScenarioId}
              onYear={setYear}
            />
            <IcePanel ice={ice} year={year} warmingC={warmingC} />
          </div>
        </aside>

        <div className="stage">
          <EarthGlobe
            seaLevelM={seaLevelM}
            selectedId={selected?.properties.id ?? null}
            onSelect={setSelected}
          />
          <div className="stage-caption">
            <span className="swatch" style={{ background: scenario.color }} />
            {scenario.shortLabel} · {year} · +{seaLevelM.toFixed(2)} m · +
            {warmingC.toFixed(1)}°C
          </div>
        </div>

        <aside className="sidebar right">
          <StatsPanel
            seaLevelM={seaLevelM}
            warmingC={warmingC}
            selected={selected}
            onSelectId={(id) => {
              if (!id) {
                setSelected(null)
                return
              }
              setSelected(getById(id) ?? null)
            }}
          />
        </aside>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <CountriesProvider>
      <AppShell />
    </CountriesProvider>
  )
}
