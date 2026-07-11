import { useEffect, useMemo, useRef, useState } from 'react'
import Globe, { type GlobeMethods } from 'react-globe.gl'
import { geoCentroid } from 'd3-geo'
import { fractionLostAtRise } from '../lib/landLoss'
import { lossColor } from '../lib/countries'
import { useCountries } from '../lib/CountriesContext'
import type { CountryFeature } from '../lib/countries'

interface EarthGlobeProps {
  seaLevelM: number
  selectedId: string | null
  onSelect: (feature: CountryFeature | null) => void
}

export function EarthGlobe({
  seaLevelM,
  selectedId,
  onSelect,
}: EarthGlobeProps) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined)
  const containerRef = useRef<HTMLDivElement>(null)
  const { features, loading } = useCountries()
  const [dims, setDims] = useState({ w: 800, h: 600 })
  const [hoverId, setHoverId] = useState<string | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setDims({ w: Math.max(320, width), h: Math.max(320, height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const g = globeRef.current
    if (!g || features.length === 0) return
    g.controls().autoRotate = true
    g.controls().autoRotateSpeed = 0.28
    g.controls().enableDamping = true
    g.pointOfView({ lat: 20, lng: 10, altitude: 2.15 }, 0)
  }, [features.length])

  useEffect(() => {
    const g = globeRef.current
    if (!g || !selectedId) return
    const f = features.find((x) => x.properties.id === selectedId)
    if (!f) return
    const [lng, lat] = geoCentroid(f)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
    g.controls().autoRotate = false
    g.pointOfView({ lat, lng, altitude: 1.55 }, 900)
  }, [selectedId, features])

  const fracById = useMemo(() => {
    const m = new Map<string, number>()
    for (const f of features) {
      m.set(
        f.properties.id,
        f.__risk ? fractionLostAtRise(f.__risk, seaLevelM) : 0,
      )
    }
    return m
  }, [features, seaLevelM])

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
            const frac = fracById.get(id) ?? 0
            if (id === selectedId) return 'rgba(232, 168, 92, 0.98)'
            if (id === hoverId) return lossColor(Math.max(frac, 0.02), true)
            return lossColor(frac, false)
          }}
          polygonSideColor={() => 'rgba(0,0,0,0)'}
          polygonStrokeColor={() => 'rgba(22, 32, 30, 0.45)'}
          polygonAltitude={0.006}
          polygonsTransitionDuration={0}
          onPolygonHover={(d: object | null) => {
            const f = d as CountryFeature | null
            setHoverId(f?.properties.id ?? null)
            const controls = globeRef.current?.controls()
            if (controls) controls.autoRotate = !f && !selectedId
          }}
          onPolygonClick={(d: object) => {
            onSelect(d as CountryFeature)
          }}
          rendererConfig={{
            antialias: true,
            alpha: false,
            preserveDrawingBuffer: true,
            powerPreference: 'high-performance',
          }}
        />
      )}
    </div>
  )
}
