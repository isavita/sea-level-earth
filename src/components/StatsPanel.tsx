import { useMemo, useState } from 'react'
import {
  computeLoss,
  formatArea,
  formatPct,
} from '../lib/landLoss'
import { useCountries } from '../lib/CountriesContext'
import type { CountryFeature } from '../lib/countries'
import {
  estimateCountryTemp,
  formatAbsoluteC,
  formatDeltaC,
} from '../lib/warming'
import {
  estimateCountryRain,
  formatDeltaFrac,
  formatDeltaMm,
  formatMm,
} from '../lib/rain'
import {
  rankByImpact,
  type ImpactSortKey,
  type SeaLevelContext,
} from '../lib/impact'
import { localSeaLevel, seaLevelNote } from '../lib/regionalSeaLevel'
import {
  estimateCountryFire,
  formatBurnedArea,
  formatSeasonDays,
} from '../lib/fire'
import {
  droughtBandLabel,
  dryQuarterLabel,
  estimateCountryDrought,
  formatAnomaly,
  formatAridity,
  formatBalanceMm,
} from '../lib/drought'
import {
  estimateCountryHumidHeat,
  formatHeatDays,
  formatPeopleM,
  formatWetBulbC,
  habitabilityBlurb,
  habitabilityColor,
  habitabilityLabel,
  monthName,
  HABITABILITY_ORDER,
  type HabitabilityBand,
} from '../lib/humidHeat'
import type { MapMode } from './EarthGlobe'

interface StatsPanelProps {
  sea: SeaLevelContext
  warmingC: number
  mapMode: MapMode
  onMapMode: (mode: MapMode) => void
  selected: CountryFeature | null
  onSelectId: (id: string) => void
}

export function StatsPanel({
  sea,
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
    () => rankByImpact(features, sea, warmingC, 30, sortBy),
    [features, sea, warmingC, sortBy],
  )

  const totals = useMemo(() => {
    let lost = 0
    let base = 0
    let hottest = 0
    let worstFire = 0
    let burnedKm2 = 0
    let wettestDelta = -Infinity
    let driestDelta = Infinity
    let worstDrying = Infinity
    let dryland = 0
    let counted = 0
    let worstWetBulb = -Infinity
    // People are counted into the band their country's yearly peak falls in —
    // a country-level statement, not a claim about where anyone lives.
    const peopleByBand = Object.fromEntries(
      HABITABILITY_ORDER.map((band) => [band, 0]),
    ) as Record<HabitabilityBand, number>
    for (const f of features) {
      if (!f.__areaKm2) continue
      const temp = estimateCountryTemp(f, warmingC, sea.physics)
      const rain = estimateCountryRain(f, warmingC, sea.physics)
      hottest = Math.max(hottest, temp.absoluteC)
      const fire = estimateCountryFire(f, warmingC, sea.physics)
      worstFire = Math.max(worstFire, fire.index)
      burnedKm2 += fire.burnedKm2
      wettestDelta = Math.max(wettestDelta, rain.deltaFrac)
      driestDelta = Math.min(driestDelta, rain.deltaFrac)
      const water = estimateCountryDrought(f, warmingC, sea.physics)
      worstDrying = Math.min(worstDrying, water.anomaly)
      const humid = estimateCountryHumidHeat(f, warmingC, sea.physics)
      worstWetBulb = Math.max(worstWetBulb, humid.peakWetBulbC)
      peopleByBand[humid.band] += humid.populationM
      // Dryland share is counted by country, not by area — the panel is a
      // country leaderboard and an area weighting would just restate Russia.
      counted += 1
      if (water.aridityClass !== 'humid') dryland += 1
      if (!f.__risk) continue
      const local = localSeaLevel(
        f,
        sea.globalMeanM,
        sea.year,
        sea.iceSheetInstability,
        sea.physics.amocWeakening,
      )
      const row = computeLoss(f.__risk, local.riseM, f.__areaKm2)
      if (!row) continue
      base += row.areaKm2
      lost += row.areaLostKm2
    }
    return {
      lost,
      pct: base > 0 ? lost / base : 0,
      hottest,
      worstFire,
      burnedKm2,
      wettestDelta: Number.isFinite(wettestDelta) ? wettestDelta : 0,
      driestDelta: Number.isFinite(driestDelta) ? driestDelta : 0,
      worstDrying: Number.isFinite(worstDrying) ? worstDrying : 0,
      drylandPct: counted > 0 ? dryland / counted : 0,
      worstWetBulb: Number.isFinite(worstWetBulb) ? worstWetBulb : 0,
      peopleByBand,
      // The headline number for this layer: people in countries whose yearly
      // peak has passed the point where rest in the shade stops being safe.
      peopleAtRisk:
        peopleByBand['rest-limited'] + peopleByBand['beyond-survivable'],
    }
  }, [features, sea, warmingC])

  const selectedSea = useMemo(() => {
    if (!selected) return null
    return localSeaLevel(
      selected,
      sea.globalMeanM,
      sea.year,
      sea.iceSheetInstability,
      sea.physics.amocWeakening,
    )
  }, [selected, sea])

  const selectedLoss = useMemo(() => {
    if (!selected?.__risk || !selectedSea) return null
    return computeLoss(selected.__risk, selectedSea.riseM, selected.__areaKm2)
  }, [selected, selectedSea])

  const selectedTemp = useMemo(() => {
    if (!selected) return null
    return estimateCountryTemp(selected, warmingC, sea.physics)
  }, [selected, warmingC, sea])

  const selectedFire = useMemo(() => {
    if (!selected) return null
    return estimateCountryFire(selected, warmingC, sea.physics)
  }, [selected, warmingC, sea])

  const selectedDrought = useMemo(() => {
    if (!selected) return null
    return estimateCountryDrought(selected, warmingC, sea.physics)
  }, [selected, warmingC, sea])

  const selectedHumidHeat = useMemo(() => {
    if (!selected) return null
    return estimateCountryHumidHeat(selected, warmingC, sea.physics)
  }, [selected, warmingC, sea])

  const selectedRain = useMemo(() => {
    if (!selected) return null
    return estimateCountryRain(selected, warmingC, sea.physics)
  }, [selected, warmingC, sea])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return ranking
    // Search every country, including ones the land sorts would hide — a
    // landlocked country must still be findable by name.
    return rankByImpact(features, sea, warmingC, 500, sortBy, false)
      .filter((r) => r.name.toLowerCase().includes(q))
      .slice(0, 30)
  }, [query, ranking, features, sea, warmingC, sortBy])

  return (
    <section className="panel stats">
      <header className="panel-head">
        <p className="eyebrow">Territory</p>
        <h2>Land, heat & water</h2>
      </header>

      {/* Radiogroup: picks the globe colouring, does not reveal panels. */}
      <div className="map-mode-switch six" role="radiogroup" aria-label="Map colour">
        <button
          type="button"
          role="radio"
          aria-checked={mapMode === 'temp'}
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
          role="radio"
          aria-checked={mapMode === 'rain'}
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
          role="radio"
          aria-checked={mapMode === 'drought'}
          className={mapMode === 'drought' ? 'active' : undefined}
          onClick={() => {
            onMapMode('drought')
            setSortBy('drought')
          }}
        >
          Drought
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={mapMode === 'humidheat'}
          className={mapMode === 'humidheat' ? 'active' : undefined}
          onClick={() => {
            onMapMode('humidheat')
            setSortBy('humidHeat')
          }}
        >
          Humid heat
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={mapMode === 'fire'}
          className={mapMode === 'fire' ? 'active' : undefined}
          onClick={() => {
            onMapMode('fire')
            setSortBy('fire')
          }}
        >
          Fire
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={mapMode === 'loss'}
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
            {mapMode === 'rain'
              ? 'Largest rain swings'
              : mapMode === 'fire'
                ? 'Land burning per year'
                : mapMode === 'drought'
                  ? 'Sharpest drying'
                  : mapMode === 'humidheat'
                    ? 'People past the rest limit'
                    : 'Hottest local warming'}
          </span>
          <strong>
            {mapMode === 'rain'
              ? `${formatDeltaFrac(totals.wettestDelta)} / ${formatDeltaFrac(totals.driestDelta)}`
              : mapMode === 'fire'
                ? formatArea(totals.burnedKm2)
                : mapMode === 'drought'
                  ? formatAnomaly(totals.worstDrying)
                  : mapMode === 'humidheat'
                    ? formatPeopleM(totals.peopleAtRisk)
                    : `${formatAbsoluteC(totals.hottest)}°C`}
          </strong>
          <em>
            {mapMode === 'rain'
              ? 'wettest / driest Δ%'
              : mapMode === 'fire'
                ? `modelled burned area; worst fire weather ${totals.worstFire.toFixed(0)} / 100`
                : mapMode === 'drought'
                  ? `${formatPct(totals.drylandPct)} of countries are drylands`
                  : mapMode === 'humidheat'
                    ? `in countries past 31°C wet bulb; worst peak ${formatWetBulbC(totals.worstWetBulb)}`
                    : 'vs pre-industrial'}
          </em>
        </div>
      </div>

      {/* The whole point of this layer is the headcount, and a single headline
          band hides where the rest of the world sits — so the full ladder is
          shown, worst first. Only in this mode: it would be noise in the other
          five. */}
      {mapMode === 'humidheat' && (
        <ul className="exposure-bands">
          {[...HABITABILITY_ORDER].reverse().map((band) => (
            <li key={band}>
              <i
                className="exposure-swatch"
                style={{ background: habitabilityColor(band) }}
                aria-hidden
              />
              <span className="exposure-label">{habitabilityLabel(band)}</span>
              <strong>{formatPeopleM(totals.peopleByBand[band])}</strong>
            </li>
          ))}
        </ul>
      )}

      {selected && selectedTemp && selectedRain && (
        <article className="country-card">
          <div className="country-card-top">
            <h3>{selected.properties.name}</h3>
            <button type="button" className="text-btn" onClick={() => onSelectId('')}>
              Clear
            </button>
          </div>
          <dl className="country-metrics twelve">
            <div>
              <dt>Land lost</dt>
              <dd className="danger">
                {formatArea(selectedLoss?.areaLostKm2 ?? 0)}
                <span>{formatPct(selectedLoss?.fractionLost ?? 0)}</span>
              </dd>
            </div>
            <div>
              <dt>Local warming</dt>
              {/*
                Both references are named. The headline is measured from
                pre-industrial, the same baseline the global figure at the top of
                the panel uses, and the second number from the 2020s. Only the
                second used to be labelled, which made the pair read as though a
                country warmed *less* than the world: beside a global +2.7°C the
                United Kingdom showed "+3.4°C / +2.0°C since 2020s", and the eye
                lands on the labelled number. It warms more than the world, not
                less — 3.4 against 2.7.
              */}
              <dd className={selectedTemp.absoluteC < 0 ? 'cold' : undefined}>
                {formatAbsoluteC(selectedTemp.absoluteC)}°C
                <span>
                  vs pre-industrial ·{' '}
                  {formatDeltaC(selectedTemp.deltaSince2020C)} since 2020s
                </span>
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
            {selectedDrought && (
              <div>
                <dt>Water balance</dt>
                <dd
                  className={
                    selectedDrought.anomaly <= -1 ? 'danger' : undefined
                  }
                >
                  {formatBalanceMm(selectedDrought.balanceMm)}
                  <span>
                    rain minus demand ·{' '}
                    {formatAnomaly(selectedDrought.anomaly)},{' '}
                    {droughtBandLabel(selectedDrought.band)}
                  </span>
                </dd>
              </div>
            )}
            {selectedDrought && (
              <div>
                <dt>Aridity</dt>
                <dd>
                  {formatAridity(selectedDrought.aridity)}
                  <span>
                    {selectedDrought.frozenGround
                      ? 'polar ground — a soil column is the wrong model here'
                      : `${selectedDrought.aridityClass}, from ${formatAridity(selectedDrought.baselineAridity)}`}
                  </span>
                </dd>
              </div>
            )}
            {selectedHumidHeat && (
              <div>
                <dt>Humid heat</dt>
                <dd
                  className={
                    selectedHumidHeat.peakWetBulbC >= 31 ? 'danger' : undefined
                  }
                >
                  {formatWetBulbC(selectedHumidHeat.peakWetBulbC)}
                  <span>
                    wet bulb once a year ·{' '}
                    {habitabilityLabel(selectedHumidHeat.band).toLowerCase()}
                  </span>
                </dd>
              </div>
            )}
            {selectedHumidHeat && (
              <div>
                <dt>Dangerous days</dt>
                <dd
                  className={
                    selectedHumidHeat.daysAbove31 >= 1 ? 'danger' : undefined
                  }
                >
                  {formatHeatDays(selectedHumidHeat.daysAbove28)}
                  <span>
                    above 28°C wet bulb ·{' '}
                    {formatHeatDays(selectedHumidHeat.daysAbove31)} above 31°C ·{' '}
                    {formatHeatDays(selectedHumidHeat.daysAbove35)} above 35°C
                  </span>
                </dd>
              </div>
            )}
            {selectedFire && (
              <div>
                <dt>Fire weather</dt>
                <dd className={selectedFire.index >= 42 ? 'danger' : undefined}>
                  {selectedFire.index.toFixed(0)}
                  <span>
                    {selectedFire.fuelLimited
                      ? 'too little to burn'
                      : `${selectedFire.deltaIndex >= 0 ? '+' : '−'}${Math.abs(selectedFire.deltaIndex).toFixed(0)} since 2020s`}
                  </span>
                </dd>
              </div>
            )}
            {selectedFire && (
              <div>
                <dt>Burned area</dt>
                <dd
                  className={
                    selectedFire.burnedKm2 > selectedFire.baselineBurnedKm2 * 1.25
                      ? 'danger'
                      : undefined
                  }
                >
                  {formatBurnedArea(selectedFire.burnedKm2)}
                  <span>
                    {selectedFire.burnedKm2 < 5
                      ? 'nothing here to carry a fire'
                      : `${formatPct(selectedFire.burnedFraction)} of the country · from ${formatBurnedArea(selectedFire.baselineBurnedKm2)} today`}
                  </span>
                </dd>
              </div>
            )}
            {selectedFire && (
              <div>
                <dt>Fire season</dt>
                <dd>
                  {formatSeasonDays(selectedFire.seasonDays)}
                  <span>
                    {selectedFire.seasonDays < 1
                      ? 'the fuel bed never joins up'
                      : `from ${formatSeasonDays(selectedFire.baselineSeasonDays)} in the 2020s`}
                  </span>
                </dd>
              </div>
            )}
            {selectedSea && (
              <div>
                <dt>Sea level here</dt>
                <dd
                  className={
                    selectedSea.riseM > sea.globalMeanM ? 'danger' : undefined
                  }
                >
                  {selectedSea.riseM >= 0 ? '+' : '−'}
                  {Math.abs(selectedSea.riseM).toFixed(2)} m
                  <span>
                    {selectedSea.riseM < 0
                      ? 'sea falling relative to the land'
                      : sea.globalMeanM > 0
                        ? `${Math.round(selectedSea.ratio * 100)}% of global mean`
                        : 'vs 1995–2014'}
                  </span>
                </dd>
              </div>
            )}
          </dl>
          {selectedSea && seaLevelNote(selectedSea) && (
            <p className="hint sea-note">{seaLevelNote(selectedSea)}</p>
          )}
          <p className="hint">
            Rain baseline from World Bank where available; change is a
            latitude-pattern sketch scaled by warming (subtropics often drier,
            high latitudes / deep tropics wetter) — not a full climate model.
            {selectedDrought &&
              ` Driest quarter ${dryQuarterLabel(selectedDrought.dryQuarterStartMonth)}, when the land falls ${Math.round(selectedDrought.dryQuarterDeficitMm)} mm short of evaporative demand against ${Math.round(selectedDrought.baselineDryQuarterDeficitMm)} mm today.`}
            {selectedDrought?.wetterButDrier &&
              ' More rain arrives here and the water balance still falls, because evaporative demand rises faster.'}
            {selectedFire && selectedFire.peatBurnedKm2 > 5 &&
              ` About ${formatBurnedArea(selectedFire.peatBurnedKm2)} of the burned area is peat and permafrost ground, where fire releases carbon banked since the ice left rather than carbon the next season takes back — a pathway whose carbon sinks are failing thaws more of it and burns more of it.`}
            {selectedHumidHeat &&
              ` Humid heat peaks in ${monthName(selectedHumidHeat.peakMonth)}${
                selectedHumidHeat.humidPeakOffHottest
                  ? `, not in ${monthName(selectedHumidHeat.hottestMonth)} when the thermometer does`
                  : ''
              }: about ${Math.round(selectedHumidHeat.peakDryBulbC)}°C at ${Math.round(selectedHumidHeat.peakHumidity * 100)}% humidity, which sweat can only cool to ${formatWetBulbC(selectedHumidHeat.peakWetBulbC)}. ${habitabilityBlurb(selectedHumidHeat.band)}${
                // Says only what the flag actually tests — more than half the
                // vapour off the sea, at the country's middle, in that month.
                // The old wording implied this identified every sea-fed
                // country, which it does not: it holds for eight, and misses
                // Oman and Iran because their centroids are too far inland and
                // Bangladesh because its own ground is wet.
                selectedHumidHeat.marineFed
                  ? ' More than half that moisture blows in off the sea rather than rising out of the ground, so the humidity here holds up through a dry summer that the land itself could not supply.'
                  : ''
              }${
                // The headline is the country's worst inhabited zone, so where
                // that zone is the shoreline the reader has to be told, or the
                // number reads as a claim about the whole country. No population
                // gate here any more: the old one hid this sentence behind the
                // share of people below 5 m, which is a flood contour, and it
                // therefore stayed hidden for exactly the countries whose coast
                // is the story — Saudi Arabia at 3.2%, Iran at 0.9%.
                selectedHumidHeat.worstIsCoast &&
                selectedHumidHeat.peakWetBulbC -
                  selectedHumidHeat.landPeakWetBulbC >=
                  0.2
                  ? ` That peak is on the coast; inland the yearly peak is ${formatWetBulbC(selectedHumidHeat.landPeakWetBulbC)}. The country is scored on the worse of the two, because these bands describe places rather than averages.`
                  : ''
              }`}
            {selectedFire && selectedFire.observedBurnedKm2 != null &&
              ` Satellites measured about ${formatBurnedArea(selectedFire.observedBurnedKm2)} here over 2001–2020. The model is calibrated against that record as a whole rather than country by country, so this is a check on it rather than an input to it, and single years vary by several times either figure.`}
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
                  className={
                    sortBy === 'drought' ? 'sort-btn active' : 'sort-btn'
                  }
                  onClick={() => setSortBy('drought')}
                  aria-pressed={sortBy === 'drought'}
                >
                  Dry{sortBy === 'drought' ? ' ↓' : ''}
                </button>
              </th>
              <th>
                <button
                  type="button"
                  className={
                    sortBy === 'humidHeat' ? 'sort-btn active' : 'sort-btn'
                  }
                  onClick={() => setSortBy('humidHeat')}
                  aria-pressed={sortBy === 'humidHeat'}
                >
                  Wet bulb{sortBy === 'humidHeat' ? ' ↓' : ''}
                </button>
              </th>
              <th>
                <button
                  type="button"
                  className={sortBy === 'fire' ? 'sort-btn active' : 'sort-btn'}
                  onClick={() => setSortBy('fire')}
                  aria-pressed={sortBy === 'fire'}
                >
                  Fire{sortBy === 'fire' ? ' ↓' : ''}
                </button>
              </th>
              <th>
                <button
                  type="button"
                  className={
                    sortBy === 'burnedArea' ? 'sort-btn active' : 'sort-btn'
                  }
                  onClick={() => setSortBy('burnedArea')}
                  aria-pressed={sortBy === 'burnedArea'}
                >
                  Burned{sortBy === 'burnedArea' ? ' ↓' : ''}
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
                  <td className="temp-cell">{formatAbsoluteC(row.absoluteC)}</td>
                  <td className={row.deltaMm < 0 ? 'rain-dry' : 'rain-wet'}>
                    {formatDeltaFrac(row.deltaFrac)}
                  </td>
                  <td
                    className={
                      row.droughtAnomaly < -0.45 ? 'rain-dry' : 'drought-cell'
                    }
                    title={row.aridityClass}
                  >
                    {formatAnomaly(row.droughtAnomaly)}
                  </td>
                  <td
                    className={
                      row.peakWetBulbC >= 31 ? 'rain-dry' : 'wetbulb-cell'
                    }
                    title={`${habitabilityLabel(row.habitability)} — ${Math.round(row.daysAbove28)} days a year above 28°C wet bulb, ${Math.round(row.daysAbove31)} above 31°C`}
                  >
                    {row.peakWetBulbC.toFixed(1)}
                  </td>
                  <td className="fire-cell">{row.fireIndex.toFixed(0)}</td>
                  <td className="fire-cell" title={`${Math.round(row.fireSeasonDays)} flammable days a year`}>
                    {formatArea(row.fireBurnedKm2)}
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr className="empty-row">
                <td colSpan={8}>
                  No country matches “{query.trim()}”.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="footnote">
        Δ°C vs pre-industrial; Δ rain is vs the ~2020s baseline. Dry is the
        change in rainfall minus evaporative demand, in that country’s own
        standard deviations, so −1 means a shift of one normal year’s spread
        toward drought. Wet bulb is the temperature sweat can reach on the
        worst day of a typical year — 28°C stops safe outdoor work, 31°C is
        dangerous at rest and 35°C is the survivability limit; hover a cell for
        its day-counts. Burned is the modelled area burning each year, in km²;
        hover a cell for that country’s fire-season length. Sort any column. Map
        colours follow the toggle.
      </p>
    </section>
  )
}
