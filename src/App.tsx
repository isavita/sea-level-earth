import { lazy, Suspense, useMemo, useState } from 'react'
import { ControlPanel } from './components/ControlPanel'
import type { MapMode } from './components/EarthGlobe'
import { IcePanel } from './components/IcePanel'
import { RiverPanel } from './components/RiverPanel'
import { StatsPanel } from './components/StatsPanel'
import {
  SCENARIOS,
  YEAR_MAX,
  YEAR_MIN,
  seaLevelAt,
  warmingAt,
  type ScenarioId,
} from './data/scenarios'
import { iceState } from './data/ice'
import { CountriesProvider, useCountries } from './lib/CountriesContext'
import type { CountryFeature } from './lib/countries'
import { useTimelinePlayback } from './lib/useTimelinePlayback'
import './App.css'

// Three.js is ~1.5 MB — split it into its own chunk so the shell + controls
// paint immediately while the globe streams in.
const EarthGlobe = lazy(() =>
  import('./components/EarthGlobe').then((m) => ({ default: m.EarthGlobe })),
)

function AppShell() {
  const { getById } = useCountries()
  const [scenarioId, setScenarioId] = useState<ScenarioId>('ssp245')
  const { year, setYear, playing, togglePlay } = useTimelinePlayback(
    YEAR_MIN,
    YEAR_MAX,
    2100,
  )
  const [selected, setSelected] = useState<CountryFeature | null>(null)
  const [mapMode, setMapMode] = useState<MapMode>('temp')
  const [selectedRiverId, setSelectedRiverId] = useState<string | null>(null)

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
  const displayYear = Math.round(year)

  // Rivers are only drawn on the globe in the rain view, so picking one from
  // the panel switches the map there — otherwise the camera flies to a basin
  // the user cannot actually see.
  const selectRiver = (id: string | null) => {
    setSelectedRiverId(id)
    if (id) setMapMode('rain')
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">Meridian</span>
          <span className="brand-sub">Sea level, ice, water & borders</span>
        </div>
        <p className="lede">
          Pick a warming pathway and press play to watch seas rise, ice retreat,
          rivers run dry, and every country warm through 2300.
        </p>
      </header>

      <main className="layout">
        <div className="stage">
          <Suspense
            fallback={
              <div className="globe-stage">
                <div className="globe-loading">Loading Earth…</div>
              </div>
            }
          >
            <EarthGlobe
              seaLevelM={seaLevelM}
              warmingC={warmingC}
              mapMode={mapMode}
              playing={playing}
              selectedId={selected?.properties.id ?? null}
              onSelect={setSelected}
              selectedRiverId={selectedRiverId}
              onSelectRiver={selectRiver}
            />
          </Suspense>
          <div className="stage-caption">
            <span className="swatch" style={{ background: scenario.color }} />
            {scenario.shortLabel} · {displayYear} · +{seaLevelM.toFixed(2)} m · +
            {warmingC.toFixed(1)}°C global · map{' '}
            {mapMode === 'temp'
              ? 'temperature'
              : mapMode === 'rain'
                ? 'rain'
                : 'land loss'}
          </div>
        </div>

        <aside className="sidebar left">
          <div className="stack">
            <ControlPanel
              scenarioId={scenarioId}
              year={displayYear}
              seaLevelM={seaLevelM}
              warmingC={warmingC}
              playing={playing}
              onScenario={setScenarioId}
              onYear={setYear}
              onTogglePlay={togglePlay}
            />
            <IcePanel ice={ice} year={displayYear} warmingC={warmingC} />
            <RiverPanel
              warmingC={warmingC}
              year={displayYear}
              selectedRiverId={selectedRiverId}
              onSelectRiver={selectRiver}
            />
          </div>
        </aside>

        <aside className="sidebar right">
          <StatsPanel
            seaLevelM={seaLevelM}
            warmingC={warmingC}
            mapMode={mapMode}
            onMapMode={setMapMode}
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
