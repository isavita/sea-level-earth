import { useEffect, useMemo, useRef, useState } from 'react'
import Globe, { type GlobeMethods } from 'react-globe.gl'
import { geoCentroid } from 'd3-geo'
import { fractionLostAtRise } from '../lib/landLoss'
import { lossColor } from '../lib/countries'
import { useCountries } from '../lib/CountriesContext'
import type { CountryFeature } from '../lib/countries'
import { estimateCountryTemp, tempColor, TEMP_LEGEND } from '../lib/warming'
import { useIsMobile } from '../lib/useIsMobile'

export type MapMode = 'temp' | 'loss'

interface EarthGlobeProps {
  seaLevelM: number
  warmingC: number
  mapMode: MapMode
  /** True while the timeline is auto-playing — labels are thinned for speed. */
  playing: boolean
  selectedId: string | null
  onSelect: (feature: CountryFeature | null) => void
}

interface MapLabel {
  id: string
  name: string
  lat: number
  lng: number
  text: string
  areaKm2: number
  /** Used for contrast: higher = darker fill → lighter text */
  weight: number
}

interface GeoMeta {
  lat: number
  lng: number
  areaKm2: number
}

function formatLossLabel(frac: number, areaLostKm2: number, detailed: boolean): string {
  const pct = frac * 100
  const pctText =
    pct <= 0
      ? '0%'
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

export function EarthGlobe({
  seaLevelM,
  warmingC,
  mapMode,
  playing,
  selectedId,
  onSelect,
}: EarthGlobeProps) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined)
  const containerRef = useRef<HTMLDivElement>(null)
  const { features, loading } = useCountries()
  const isMobile = useIsMobile()
  const [dims, setDims] = useState({ w: 800, h: 600 })
  const [hoverId, setHoverId] = useState<string | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setDims({ w: Math.max(300, width), h: Math.max(300, height) })
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
    if (!g) return
    const renderer = g.renderer()
    if (!renderer) return
    const cap = isMobile ? 1.5 : 2
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap))
    // Re-apply size (default updateStyle=true, matching react-globe.gl) so the
    // capped pixel ratio takes effect on the current buffer without desyncing
    // the canvas CSS size.
    renderer.setSize(dims.w, dims.h)
  }, [dims, isMobile, features.length])

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
      { frac: number; absoluteC: number; areaLostKm2: number }
    >()
    for (const f of features) {
      const frac = f.__risk ? fractionLostAtRise(f.__risk, seaLevelM) : 0
      const areaKm2 = f.__areaKm2 ?? 0
      m.set(f.properties.id, {
        frac,
        absoluteC: estimateCountryTemp(f, warmingC).absoluteC,
        areaLostKm2: areaKm2 * frac,
      })
    }
    return m
  }, [features, seaLevelM, warmingC])

  // How many numeric labels to draw. Labels are 3D text whose geometry is
  // rebuilt whenever their text changes — costly *per frame* while animating,
  // but nearly free when the globe is paused (built once). So we drop them on
  // mobile only while playing, and otherwise show the full set on every device
  // (react-globe.gl hides the back-facing half, and you can pinch to zoom in).
  const labelBudget = playing ? (isMobile ? 0 : 70) : 150

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
          text: `+${absoluteC.toFixed(1)}°`,
          areaKm2: meta.areaKm2,
          weight: absoluteC,
        })
      } else {
        const frac = metrics?.frac ?? 0
        const areaLostKm2 = metrics?.areaLostKm2 ?? 0
        labels.push({
          id: f.properties.id,
          name: f.properties.name,
          lat: meta.lat,
          lng: meta.lng,
          text: formatLossLabel(frac, areaLostKm2, detailed),
          areaKm2: meta.areaKm2,
          weight: frac * 20,
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
    return labels
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
  ])

  return (
    <div ref={containerRef} className="globe-stage">
      {loading || features.length === 0 ? (
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
            return lossColor(metrics?.frac ?? 0, hovered)
          }}
          polygonSideColor={() => 'rgba(0,0,0,0)'}
          polygonStrokeColor={() => 'rgba(22, 32, 30, 0.5)'}
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
          labelsData={mapLabels}
          labelLat="lat"
          labelLng="lng"
          labelText="text"
          labelAltitude={0.022}
          labelIncludeDot={false}
          labelResolution={2}
          labelsTransitionDuration={0}
          labelSize={(d: object) => {
            const label = d as MapLabel
            if (label.id === selectedId) return isMobile ? 0.92 : 0.72
            if (label.id === hoverId) return isMobile ? 0.82 : 0.62
            const a = Math.max(8_000, label.areaKm2)
            // Bigger floor on phones so small countries stay legible.
            const base = Math.sqrt(a) * (isMobile ? 0.00045 : 0.0003)
            return isMobile
              ? Math.min(0.78, Math.max(0.46, base))
              : Math.min(0.55, Math.max(0.28, base))
          }}
          labelColor={(d: object) => {
            const label = d as MapLabel
            if (label.id === selectedId || label.id === hoverId) {
              return '#fffdf6'
            }
            // Prefer high-contrast light labels; dark only on very pale fills
            return label.weight >= 2.8 ? '#fff8ef' : '#1a1612'
          }}
          onLabelClick={(d: object) => {
            const label = d as MapLabel
            const f = features.find((x) => x.properties.id === label.id)
            if (f) onSelect(f)
          }}
          onLabelHover={(d: object | null) => {
            const label = d as MapLabel | null
            setHoverId(label?.id ?? null)
            const controls = globeRef.current?.controls()
            if (controls && !prefersReducedMotion()) {
              controls.autoRotate = !label && !selectedId
            }
          }}
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
