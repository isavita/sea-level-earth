import { lazy, Suspense, useMemo, useState } from 'react'
import { ControlPanel } from './components/ControlPanel'
import type { MapMode } from './components/EarthGlobe'
import { IcePanel } from './components/IcePanel'
import { LearnPanel } from './components/LearnPanel'
import { RiverPanel } from './components/RiverPanel'
import { Scrubber } from './components/Scrubber'
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
import { useIsMobile } from './lib/useIsMobile'
import { useTheme } from './lib/useTheme'
import { ThemeToggle } from './components/ThemeToggle'
import './App.css'

type PanelTabId = 'pathway' | 'ice' | 'rivers' | 'countries' | 'learn'

/** Stroke icons for the bottom bar — inline so there is no icon dependency. */
const ICONS: Record<PanelTabId, string> = {
  pathway: 'M3 17.5 9 11l4 4 8-9',
  countries:
    'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M3.5 9h17M3.5 15h17M12 3c2.5 2.6 2.5 15.4 0 18M12 3c-2.5 2.6-2.5 15.4 0 18',
  ice: 'M12 2v20M4 7l16 10M20 7 4 17M12 6.5 9.5 4M12 6.5 14.5 4M12 17.5 9.5 20M12 17.5l2.5 2.5',
  rivers: 'M3 8c3-2 5 2 8 0s5-2 8 0M3 13c3-2 5 2 8 0s5-2 8 0M3 18c3-2 5 2 8 0s5-2 8 0',
  learn: 'M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5zM19 18v3H6.5',
}

const PANEL_TABS: { id: PanelTabId; label: string }[] = [
  { id: 'pathway', label: 'Pathway' },
  { id: 'countries', label: 'Countries' },
  { id: 'ice', label: 'Ice' },
  { id: 'rivers', label: 'Rivers' },
  { id: 'learn', label: 'Learn' },
]

function TabIcon({ id }: { id: PanelTabId }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden focusable="false">
      <path
        d={ICONS[id]}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

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
  const [panelTab, setPanelTab] = useState<PanelTabId>('pathway')
  /**
   * Phones can drop the sheet to a peek so the globe gets the screen. The
   * scrubber stays visible either way — collapsing to look at the map is
   * exactly when scrubbing the year is most useful.
   */
  const [deckOpen, setDeckOpen] = useState(true)
  const theme = useTheme()

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
  const isMobile = useIsMobile()

  // Bundled so land loss can be resolved per coast rather than from the global
  // mean — the fingerprint pattern depends on which ice is melting, so the
  // scenario's instability flag is part of the context.
  const sea = useMemo(
    () => ({
      globalMeanM: seaLevelM,
      year,
      iceSheetInstability: scenario.iceSheetInstability,
      physics: scenario.physics,
    }),
    [seaLevelM, year, scenario.iceSheetInstability, scenario.physics],
  )

  // Rivers only draw on the globe in the rain view, so picking one switches
  // the map there — and on mobile brings its panel to the front.
  const selectRiver = (id: string | null) => {
    setSelectedRiverId(id)
    if (!id) return
    setMapMode('rain')
    setPanelTab('rivers')
    setDeckOpen(true)
  }

  // Tapping a country on the globe should reveal its numbers, which on mobile
  // live behind the Countries tab.
  const selectCountry = (feature: CountryFeature | null) => {
    setSelected(feature)
    if (feature) {
      setPanelTab('countries')
      setDeckOpen(true)
    }
  }

  const panels = {
    pathway: (
      <ControlPanel
        scenarioId={scenarioId}
        year={displayYear}
        seaLevelM={seaLevelM}
        warmingC={warmingC}
        playing={playing}
        showTimeline={!isMobile}
        onScenario={setScenarioId}
        onYear={setYear}
        onTogglePlay={togglePlay}
      />
    ),
    ice: <IcePanel ice={ice} year={displayYear} warmingC={warmingC} />,
    rivers: (
      <RiverPanel
        warmingC={warmingC}
        year={displayYear}
        selectedRiverId={selectedRiverId}
        onSelectRiver={selectRiver}
      />
    ),
    learn: <LearnPanel />,
    countries: (
      <StatsPanel
        sea={sea}
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
    ),
  }

  // Rivers are only drawn on the globe in the rain view, so picking one from
  // the panel switches the map there — otherwise the camera flies to a basin
  // the user cannot actually see.
  return (
    /* --sc carries the pathway colour to the slider, sheet and live dot. */
    <div
      className="app"
      data-deck={isMobile && !deckOpen ? 'peek' : 'open'}
      style={{ ['--sc' as string]: scenario.color }}
    >
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">Meridian</span>
          <span className="brand-sub">Sea level, ice, water & borders</span>
        </div>
        <p className="lede">
          Pick a warming pathway and press play to watch seas rise, ice retreat,
          rivers run dry, and every country warm through 2300.
        </p>
        <div className="topbar-end">
          {/* Phone app-bar readout — the masthead copy is hidden at that size. */}
          <div className={`live-chip${playing ? ' is-playing' : ''}`}>
            <span className="live-dot" aria-hidden />
            <b>{displayYear}</b>
            <span>+{warmingC.toFixed(1)}°C</span>
          </div>
          <ThemeToggle
            choice={theme.choice}
            resolved={theme.resolved}
            onCycle={theme.cycle}
          />
        </div>
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
              sea={sea}
              theme={theme.resolved}
              warmingC={warmingC}
              mapMode={mapMode}
              playing={playing}
              selectedId={selected?.properties.id ?? null}
              onSelect={selectCountry}
              selectedRiverId={selectedRiverId}
              onSelectRiver={selectRiver}
            />
          </Suspense>
          {/* Split into spans so the phone can drop the parts the app-bar chip
              already shows, and still fit on one line over the globe. */}
          <div className="stage-caption">
            <span className="swatch" style={{ background: scenario.color }} />
            <span className="cap-strong">{scenario.shortLabel}</span>
            <span className="cap-sep cap-dup">·</span>
            <span className="cap-dup">{displayYear}</span>
            <span className="cap-sep">·</span>
            <span className="cap-strong">+{seaLevelM.toFixed(2)} m</span>
            <span className="cap-sep cap-dup">·</span>
            <span className="cap-dup">+{warmingC.toFixed(1)}°C</span>
            <span className="cap-sep">·</span>
            <span>
              {mapMode === 'temp'
                ? 'temperature'
                : mapMode === 'rain'
                  ? 'rain'
                  : 'land loss'}
            </span>
          </div>
        </div>

        {isMobile ? (
          /* Phones get one panel at a time behind the bottom bar. Stacking all
             of them produced a 4.4-screen scroll that buried the controls. */
          <div className="deck">
            <button
              type="button"
              className="deck-grip"
              aria-expanded={deckOpen}
              aria-controls={`panel-${panelTab}`}
              onClick={() => setDeckOpen((v) => !v)}
            >
              <span className="deck-grip-bar" aria-hidden />
              <span className="sr-only">
                {deckOpen ? 'Hide panel and show more map' : 'Show panel'}
              </span>
            </button>
            <Scrubber
              year={displayYear}
              playing={playing}
              seaLevelM={seaLevelM}
              warmingC={warmingC}
              onYear={setYear}
              onTogglePlay={togglePlay}
            />
            {/* key remounts the panel so it animates in on every tab change */}
            <div
              className="deck-body"
              key={panelTab}
              id={`panel-${panelTab}`}
              role="tabpanel"
              aria-labelledby={`tab-${panelTab}`}
              tabIndex={-1}
            >
              {panels[panelTab]}
            </div>
          </div>
        ) : (
          <>
            <aside className="sidebar left">
              <div className="stack">
                {panels.pathway}
                {panels.ice}
                {panels.rivers}
              </div>
            </aside>
            <aside className="sidebar right">
              <div className="stack">
                {panels.countries}
                {panels.learn}
              </div>
            </aside>
          </>
        )}
      </main>

      {isMobile && (
        <nav className="tabbar" role="tablist" aria-label="Panels">
          {PANEL_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              /* Only the active panel is mounted, so pointing the other tabs
                 at absent element ids would be a dangling ARIA reference. */
              aria-controls={
                panelTab === t.id ? `panel-${t.id}` : undefined
              }
              aria-selected={panelTab === t.id}
              className={panelTab === t.id ? 'tabbar-btn active' : 'tabbar-btn'}
              onClick={() => {
                setPanelTab(t.id)
                setDeckOpen(true)
              }}
            >
              <TabIcon id={t.id} />
              <span>{t.label}</span>
            </button>
          ))}
        </nav>
      )}
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
