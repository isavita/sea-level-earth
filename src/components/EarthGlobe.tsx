import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import Globe, { type GlobeMethods } from 'react-globe.gl'
import { geoCentroid } from 'd3-geo'
import { fractionLostAtRise } from '../lib/landLoss'
import { lossColor } from '../lib/countries'
import { useCountries } from '../lib/CountriesContext'
import type { CountryFeature } from '../lib/countries'
import {
  estimateCountryTemp,
  formatAbsoluteC,
  tempColor,
  TEMP_LEGEND,
} from '../lib/warming'
import {
  estimateCountryRain,
  formatDeltaFrac,
  rainDeltaColor,
  RAIN_LEGEND,
} from '../lib/rain'
import { useIsMobile } from '../lib/useIsMobile'
import { localSeaLevel } from '../lib/regionalSeaLevel'
import type { SeaLevelContext } from '../lib/impact'
import {
  allRiverStates,
  riverFlowColor,
  RIVERS,
  type RiverState,
} from '../data/rivers'

export type MapMode = 'temp' | 'loss' | 'rain'

interface EarthGlobeProps {
  sea: SeaLevelContext
  warmingC: number
  mapMode: MapMode
  /** True while the timeline is auto-playing — labels are thinned for speed. */
  playing: boolean
  selectedId: string | null
  onSelect: (feature: CountryFeature | null) => void
  selectedRiverId: string | null
  onSelectRiver: (id: string | null) => void
}

interface RiverPath {
  id: string
  name: string
  /** [lat, lng] pairs — react-globe.gl reads points in that order. */
  coords: [number, number][]
  color: string
  deltaFrac: number
}

interface MapLabel {
  id: string
  name: string
  lat: number
  lng: number
  text: string
  areaKm2: number
  /**
   * Contrast decision, resolved to a boolean here rather than kept as the raw
   * metric. A continuous value would differ on literally every timeline commit
   * and so defeat the identity reuse in `mapLabels`.
   */
  light: boolean
}

/** True when the fill is dark enough to need light text. */
const isLightText = (weight: number) => weight >= 2.8

function sameLabel(a: MapLabel, b: MapLabel): boolean {
  return (
    a.text === b.text &&
    a.light === b.light &&
    a.lat === b.lat &&
    a.lng === b.lng &&
    a.areaKm2 === b.areaKm2
  )
}

interface GeoMeta {
  lat: number
  lng: number
  areaKm2: number
}

function formatLossLabel(
  frac: number,
  areaLostKm2: number,
  detailed: boolean,
  coarse: boolean,
): string {
  const pct = frac * 100
  const pctText =
    pct <= 0
      ? '0%'
      : coarse
        ? `${pct.toFixed(0)}%`
        : pct < 0.1
          ? '<0.1%'
          : pct < 10
            ? `${pct.toFixed(1)}%`
            : `${pct.toFixed(0)}%`

  if (!detailed) return pctText

  let areaText: string
  if (areaLostKm2 >= 1_000_000) areaText = `${(areaLostKm2 / 1_000_000).toFixed(1)}M`
  else if (areaLostKm2 >= 1_000) areaText = `${(areaLostKm2 / 1_000).toFixed(0)}k`
  else if (areaLostKm2 >= 10) areaText = `${areaLostKm2.toFixed(0)}`
  else areaText = `${areaLostKm2.toFixed(1)}`

  return `${pctText} · ${areaText} km²`
}

const LOSS_LEGEND = [
  { label: 'Little / none', color: 'rgb(196, 206, 192)' },
  { label: 'Moderate', color: 'rgb(210, 150, 90)' },
  { label: 'High share lost', color: 'rgb(176, 70, 40)' },
] as const

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/* Constant accessors, hoisted to module scope. Inline arrows get a fresh
   identity on every React render, which makes globe.gl re-run them across all
   ~241 polygons and re-set their materials on every timeline commit — for
   values that never change. */
const TRANSPARENT_SIDE = () => 'rgba(0,0,0,0)'
const POLYGON_STROKE = () => 'rgba(22, 32, 30, 0.5)'
const PATH_POINT_LAT = (p: unknown) => (p as [number, number])[0]
const PATH_POINT_LNG = (p: unknown) => (p as [number, number])[1]

export function EarthGlobe({
  sea,
  warmingC,
  mapMode,
  playing,
  selectedId,
  onSelect,
  selectedRiverId,
  onSelectRiver,
}: EarthGlobeProps) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined)
  const containerRef = useRef<HTMLDivElement>(null)
  const { features, loading } = useCountries()
  const isMobile = useIsMobile()
  /**
   * Null until the stage has been measured. Mounting the globe at a guessed
   * size and letting the observer correct it left the first frame rendered
   * against the wrong viewport — the Earth sat half off the right edge until
   * something else triggered a resize. Measuring in a layout effect means the
   * globe is built once, at the size it will actually occupy.
   */
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null)
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [labelsReady, setLabelsReady] = useState(false)

  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    // Floor kept below the narrowest phone (320px minus page padding) so the
    // canvas never forces its container to overflow and crop the globe.
    const measure = (width: number, height: number) => {
      const next = { w: Math.max(240, width), h: Math.max(240, height) }
      setDims((prev) =>
        prev && prev.w === next.w && prev.h === next.h ? prev : next,
      )
    }
    const rect = el.getBoundingClientRect()
    measure(rect.width, rect.height)
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      measure(width, height)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // One-time camera + controls setup once the globe + data are ready.
  useEffect(() => {
    const g = globeRef.current
    if (!g || features.length === 0) return
    const controls = g.controls()
    controls.autoRotate = !prefersReducedMotion()
    controls.autoRotateSpeed = 0.28
    controls.enableDamping = true
    // Closer on phones so the (smaller) globe fills the frame and per-country
    // labels render large enough to read.
    g.pointOfView({ lat: 20, lng: 10, altitude: isMobile ? 2.1 : 2.15 }, 0)
  }, [features.length, isMobile])

  // Cap the device pixel ratio — the single biggest GPU win on phones, where
  // devicePixelRatio is often 3. Re-apply whenever the canvas is resized.
  useEffect(() => {
    const g = globeRef.current
    if (!g || !dims) return
    const renderer = g.renderer()
    if (!renderer) return
    const cap = isMobile ? 1.5 : 2
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap))
    // setPixelRatio resizes the drawing buffer but leaves the CSS size alone,
    // so re-apply the size (default updateStyle=true, matching react-globe.gl)
    // to keep buffer and element in step.
    renderer.setSize(dims.w, dims.h)
    // setSize does not touch the camera, and a stale aspect skews the globe.
    const camera = g.camera() as { aspect?: number; updateProjectionMatrix?: () => void }
    if (typeof camera.aspect === 'number') {
      camera.aspect = dims.w / dims.h
      camera.updateProjectionMatrix?.()
    }
  }, [dims, isMobile, features.length])

  /**
   * Hold the labels back until the globe itself is on screen.
   *
   * Every label is extruded 3D text, and three-globe builds all of them in the
   * same task that triangulates the countries. Letting the first paint carry
   * both put the whole set behind one long block; deferring to the first idle
   * slot gets the map up first and fills the numbers in a beat later, which is
   * also the order a reader wants them.
   */
  useEffect(() => {
    if (!dims || features.length === 0) return
    const show = () => setLabelsReady(true)
    // A timer cannot interrupt the geometry build — it can only run once that
    // task yields — so this already lands in the right order. It is the backstop
    // rather than the mechanism because idle callbacks are suspended outright in
    // a background tab, and the labels must still arrive there.
    const timer = window.setTimeout(show, 400)
    const handle = window.requestIdleCallback?.(show, { timeout: 1200 })
    return () => {
      window.clearTimeout(timer)
      if (handle !== undefined) window.cancelIdleCallback?.(handle)
    }
  }, [dims, features.length])

  // Pause the render loop entirely when the tab is hidden (battery saver).
  useEffect(() => {
    const onVisibility = () => {
      const g = globeRef.current
      if (!g) return
      if (document.hidden) {
        g.pauseAnimation()
      } else {
        g.resumeAnimation()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  // Fly to a country when it is selected from the table/search.
  useEffect(() => {
    const g = globeRef.current
    if (!g || !selectedId) return
    const meta = geoMetaById.get(selectedId)
    if (!meta || !Number.isFinite(meta.lat) || !Number.isFinite(meta.lng)) return
    g.controls().autoRotate = false
    g.pointOfView(
      { lat: meta.lat, lng: meta.lng, altitude: isMobile ? 1.8 : 1.55 },
      900,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  // Fly to a river basin when one is picked in the freshwater panel.
  useEffect(() => {
    const g = globeRef.current
    if (!g || !selectedRiverId) return
    const river = RIVERS.find((r) => r.id === selectedRiverId)
    if (!river) return
    const mid = river.path[Math.floor(river.path.length / 2)]
    g.controls().autoRotate = false
    g.pointOfView(
      { lat: mid[1], lng: mid[0], altitude: isMobile ? 1.9 : 1.7 },
      900,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRiverId])

  // Centroids + areas never change with the scenario — compute them once so
  // the per-frame animation work stays cheap.
  const geoMetaById = useMemo(() => {
    const m = new Map<string, GeoMeta>()
    for (const f of features) {
      const [lng, lat] = geoCentroid(f)
      m.set(f.properties.id, { lat, lng, areaKm2: f.__areaKm2 ?? 0 })
    }
    return m
  }, [features])

  // Label priority: largest countries first, so a capped budget keeps the
  // most legible ones.
  const labelOrder = useMemo(
    () =>
      [...features].sort(
        (a, b) => (b.__areaKm2 ?? 0) - (a.__areaKm2 ?? 0),
      ),
    [features],
  )

  const metricsById = useMemo(() => {
    const m = new Map<
      string,
      {
        frac: number
        absoluteC: number
        areaLostKm2: number
        futureMm: number
        deltaMm: number
        deltaFrac: number
      }
    >()
    for (const f of features) {
      const localM = localSeaLevel(
        f,
        sea.globalMeanM,
        sea.year,
        sea.iceSheetInstability,
        sea.physics.amocWeakening,
      ).riseM
      const frac = f.__risk ? fractionLostAtRise(f.__risk, localM) : 0
      const areaKm2 = f.__areaKm2 ?? 0
      const rain = estimateCountryRain(f, warmingC, sea.physics)
      m.set(f.properties.id, {
        frac,
        absoluteC: estimateCountryTemp(f, warmingC, sea.physics).absoluteC,
        areaLostKm2: areaKm2 * frac,
        futureMm: rain.futureMm,
        deltaMm: rain.deltaMm,
        deltaFrac: rain.deltaFrac,
      })
    }
    return m
  }, [features, sea, warmingC])

  /**
   * How many numeric labels to draw. Each is extruded 3D text whose geometry
   * three-globe rebuilds on every update, so cost is essentially linear in the
   * count: measured over a play-through, 70 labels cost ~9.4 ms per simulated
   * year with 340 ms stalls, against ~1.4 ms and 59 ms with none. Paused, the
   * set is built once and costs nothing, so the full 150 come back.
   *
   * 24 keeps the largest countries counting up — the ones whose labels are
   * legible at play-through zoom anyway — for roughly a third of the cost.
   */
  const labelBudget = !labelsReady ? 0 : playing ? (isMobile ? 0 : 24) : 150

  /**
   * Label geometry dominates the frame budget: measured over a play-through,
   * 70 labels cost ~9.4 ms per simulated year against ~1.4 ms with labels off,
   * and produced 340 ms digests. three-globe rebuilds every label's extruded
   * text geometry on each digest regardless of datum identity, so the only
   * real lever is *not running the digest*. It runs whenever `labelsData`
   * changes identity — hence the array-level reuse below.
   */
  const labelCacheRef = useRef(new Map<string, MapLabel>())
  const prevLabelsRef = useRef<MapLabel[]>([])

  /**
   * While the timeline plays, round the numbers harder. Fewer distinct strings
   * means the label set is genuinely unchanged across most commits, which is
   * what lets the array reuse below skip the digest entirely. Paused, where a
   * rebuild is a one-off, full precision comes back.
   */
  const coarse = playing

  const mapLabels = useMemo((): MapLabel[] => {
    const labels: MapLabel[] = []
    const pushLabel = (f: CountryFeature) => {
      const meta = geoMetaById.get(f.properties.id)
      if (!meta || !Number.isFinite(meta.lat) || !Number.isFinite(meta.lng)) return
      const metrics = metricsById.get(f.properties.id)
      const detailed =
        f.properties.id === selectedId || f.properties.id === hoverId

      if (mapMode === 'temp') {
        const absoluteC = metrics?.absoluteC ?? warmingC
        labels.push({
          id: f.properties.id,
          name: f.properties.name,
          lat: meta.lat,
          lng: meta.lng,
          text: `${formatAbsoluteC(absoluteC, coarse ? 0 : 1)}°`,
          areaKm2: meta.areaKm2,
          light: isLightText(absoluteC),
        })
      } else if (mapMode === 'rain') {
        const deltaFrac = metrics?.deltaFrac ?? 0
        const futureMm = metrics?.futureMm ?? 0
        const pct = coarse
          ? `${deltaFrac >= 0 ? '+' : ''}${(deltaFrac * 100).toFixed(0)}%`
          : formatDeltaFrac(deltaFrac)
        labels.push({
          id: f.properties.id,
          name: f.properties.name,
          lat: meta.lat,
          lng: meta.lng,
          text: detailed ? `${pct} · ${futureMm.toFixed(0)} mm` : pct,
          areaKm2: meta.areaKm2,
          light: isLightText(
            Math.abs(deltaFrac) * 20 + (deltaFrac < 0 ? 1 : 0),
          ),
        })
      } else {
        const frac = metrics?.frac ?? 0
        const areaLostKm2 = metrics?.areaLostKm2 ?? 0
        labels.push({
          id: f.properties.id,
          name: f.properties.name,
          lat: meta.lat,
          lng: meta.lng,
          text: formatLossLabel(frac, areaLostKm2, detailed, coarse),
          areaKm2: meta.areaKm2,
          light: isLightText(frac * 20),
        })
      }
    }

    for (let i = 0; i < labelOrder.length && labels.length < labelBudget; i++) {
      pushLabel(labelOrder[i])
    }
    // Always keep the selected / hovered country labelled, even past budget.
    for (const id of [selectedId, hoverId]) {
      if (!id || labels.some((l) => l.id === id)) continue
      const f = features.find((x) => x.properties.id === id)
      if (f) pushLabel(f)
    }

    // Reuse the previous object wherever nothing visible changed…
    const cache = labelCacheRef.current
    const seen = new Set<string>()
    const reconciled = labels.map((l) => {
      seen.add(l.id)
      const prev = cache.get(l.id)
      if (prev && sameLabel(prev, l)) return prev
      cache.set(l.id, l)
      return l
    })
    // Labels that dropped out of budget would otherwise leak entries forever.
    for (const id of cache.keys()) {
      if (!seen.has(id)) cache.delete(id)
    }

    // …and if *every* label was reused, hand back the very same array. That
    // keeps the `labelsData` prop identical, so globe.gl skips the labels
    // digest — the whole point. A fresh array of identical objects would still
    // rebuild all 70 text geometries.
    const prev = prevLabelsRef.current
    if (
      prev.length === reconciled.length &&
      reconciled.every((l, i) => l === prev[i])
    ) {
      return prev
    }
    prevLabelsRef.current = reconciled
    return reconciled
  }, [
    labelOrder,
    features,
    geoMetaById,
    metricsById,
    mapMode,
    warmingC,
    selectedId,
    hoverId,
    labelBudget,
    coarse,
  ])

  /* Label accessors, memoised on what they actually read. Inline arrows get a
     new identity on every timeline commit, which re-dirties the labels layer
     and undoes the array reuse above. None of these depend on the year. */
  const labelSizeAccessor = useCallback(
    (d: object) => {
      const label = d as MapLabel
      if (label.id === selectedId) return isMobile ? 0.92 : 0.72
      if (label.id === hoverId) return isMobile ? 0.82 : 0.62
      const a = Math.max(8_000, label.areaKm2)
      // Bigger floor on phones so small countries stay legible.
      const base = Math.sqrt(a) * (isMobile ? 0.00045 : 0.0003)
      return isMobile
        ? Math.min(0.78, Math.max(0.46, base))
        : Math.min(0.55, Math.max(0.28, base))
    },
    [selectedId, hoverId, isMobile],
  )

  const labelColorAccessor = useCallback(
    (d: object) => {
      const label = d as MapLabel
      if (label.id === selectedId || label.id === hoverId) return '#fffdf6'
      // Prefer high-contrast light labels; dark only on very pale fills
      return label.light ? '#fff8ef' : '#1a1612'
    },
    [selectedId, hoverId],
  )

  const handleLabelClick = useCallback(
    (d: object) => {
      const label = d as MapLabel
      const f = features.find((x) => x.properties.id === label.id)
      if (f) onSelect(f)
    },
    [features, onSelect],
  )

  const handleLabelHover = useCallback(
    (d: object | null) => {
      const label = d as MapLabel | null
      setHoverId(label?.id ?? null)
      const controls = globeRef.current?.controls()
      if (controls && !prefersReducedMotion()) {
        controls.autoRotate = !label && !selectedId
      }
    },
    [selectedId],
  )

  // Rivers ride along with the rain map — 17 short polylines, negligible next
  // to ~180 country polygons, so they stay on even while the timeline plays.
  const riverPaths = useMemo((): RiverPath[] => {
    if (mapMode !== 'rain') return []
    return allRiverStates(warmingC).map((s: RiverState) => ({
      id: s.river.id,
      name: s.river.name,
      coords: s.river.path.map(([lng, lat]) => [lat, lng] as [number, number]),
      color: riverFlowColor(s.deltaFrac),
      deltaFrac: s.deltaFrac,
    }))
  }, [mapMode, warmingC])

  return (
    <div ref={containerRef} className="globe-stage">
      {loading || features.length === 0 || !dims ? (
        <div className="globe-loading">Loading Earth…</div>
      ) : (
        <Globe
          ref={globeRef}
          width={dims.w}
          height={dims.h}
          backgroundColor="#07161c"
          globeImageUrl="/earth-ocean.png"
          showGraticules={false}
          showAtmosphere
          atmosphereColor="#6fa9b8"
          atmosphereAltitude={0.12}
          polygonsData={features}
          polygonGeoJsonGeometry="geometry"
          polygonCapColor={(d: object) => {
            const f = d as CountryFeature
            const id = f.properties.id
            const metrics = metricsById.get(id)
            const hovered = id === hoverId
            if (id === selectedId) return 'rgba(255, 236, 200, 0.98)'
            if (mapMode === 'temp') {
              return tempColor(metrics?.absoluteC ?? warmingC, hovered)
            }
            if (mapMode === 'rain') {
              return rainDeltaColor(metrics?.deltaFrac ?? 0, hovered)
            }
            return lossColor(metrics?.frac ?? 0, hovered)
          }}
          polygonSideColor={TRANSPARENT_SIDE}
          polygonStrokeColor={POLYGON_STROKE}
          polygonAltitude={0.006}
          polygonsTransitionDuration={0}
          onPolygonHover={(d: object | null) => {
            const f = d as CountryFeature | null
            setHoverId(f?.properties.id ?? null)
            const controls = globeRef.current?.controls()
            if (controls && !prefersReducedMotion()) {
              controls.autoRotate = !f && !selectedId
            }
          }}
          onPolygonClick={(d: object) => {
            onSelect(d as CountryFeature)
          }}
          pathsData={riverPaths}
          pathPoints="coords"
          pathPointLat={PATH_POINT_LAT}
          pathPointLng={PATH_POINT_LNG}
          pathColor={(d: object) => (d as RiverPath).color}
          pathStroke={(d: object) =>
            (d as RiverPath).id === selectedRiverId ? 2.4 : 1.2
          }
          pathPointAlt={0.012}
          pathTransitionDuration={0}
          onPathClick={(d: object) => {
            const p = d as RiverPath
            onSelectRiver(p.id === selectedRiverId ? null : p.id)
          }}
          labelsData={mapLabels}
          labelLat="lat"
          labelLng="lng"
          labelText="text"
          labelAltitude={0.022}
          labelIncludeDot={false}
          labelResolution={2}
          labelsTransitionDuration={0}
          labelSize={labelSizeAccessor}
          labelColor={labelColorAccessor}
          onLabelClick={handleLabelClick}
          onLabelHover={handleLabelHover}
          rendererConfig={{
            antialias: !isMobile,
            alpha: false,
            powerPreference: 'high-performance',
          }}
        />
      )}
      <div className="temp-legend" aria-hidden>
        {mapMode === 'temp' ? (
          <>
            <span className="temp-legend-title">Local warming vs pre-industrial</span>
            <div className="temp-legend-scale">
              {TEMP_LEGEND.map((s) => (
                <span key={s.label} className="temp-legend-stop">
                  <i style={{ background: s.color }} />
                  {s.label}
                </span>
              ))}
            </div>
            <span className="temp-legend-note">
              Labels = each country’s Δ°C
            </span>
          </>
        ) : mapMode === 'rain' ? (
          <>
            <span className="temp-legend-title">Rainfall change vs ~2020s</span>
            <div className="temp-legend-scale">
              {RAIN_LEGEND.map((s) => (
                <span key={s.label} className="temp-legend-stop">
                  <i style={{ background: s.color }} />
                  {s.label}
                </span>
              ))}
            </div>
            <span className="temp-legend-note">
              Labels = Δ rain % (hover for mm/yr). Lines are major rivers,
              blue = more flow, rust = less.
            </span>
          </>
        ) : (
          <>
            <span className="temp-legend-title">Land lost to sea-level rise</span>
            <div className="temp-legend-scale">
              {LOSS_LEGEND.map((s) => (
                <span key={s.label} className="temp-legend-stop">
                  <i style={{ background: s.color }} />
                  {s.label}
                </span>
              ))}
            </div>
            <span className="temp-legend-note">
              Labels = % land lost (hover for km²)
            </span>
          </>
        )}
      </div>
    </div>
  )
}
