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
import {
  estimateCountryFire,
  fireColor,
  formatBurnedArea,
  FIRE_LEGEND,
} from '../lib/fire'
import {
  droughtColor,
  DROUGHT_LEGEND,
  estimateCountryDrought,
  formatAnomaly,
  type AridityClass,
} from '../lib/drought'
import {
  estimateCountryHumidHeat,
  humidHeatColor,
  HUMID_HEAT_LEGEND,
} from '../lib/humidHeat'
import { useIsMobile } from '../lib/useIsMobile'
import { localSeaLevel } from '../lib/regionalSeaLevel'
import { dropSubPixelParts } from '../lib/globeGeometry'
import type { SeaLevelContext } from '../lib/impact'
import type { ResolvedTheme } from '../lib/useTheme'
import {
  allRiverStates,
  riverFlowColor,
  RIVERS,
  type RiverState,
} from '../data/rivers'

export type MapMode =
  | 'temp'
  | 'loss'
  | 'rain'
  | 'fire'
  | 'drought'
  | 'humidheat'

/**
 * The globe's own colours, per theme: the sky behind it, the glow around it,
 * and the ocean on it.
 *
 * The ocean matters more than it looks. `earth-ocean.png` is a single flat
 * near-black teal, which is what gives the dark theme its depth — and what made
 * the light theme read as a black blot dropped on a pale page. Since the
 * texture carries no detail, the light variant is a one-pixel PNG inlined as a
 * data URI: same result, no second request, nothing to keep in sync on disk.
 */
const SKY: Record<
  ResolvedTheme,
  { background: string; atmosphere: string; ocean: string }
> = {
  dark: {
    background: '#07161c',
    atmosphere: '#6fa9b8',
    ocean: '/earth-ocean.png',
  },
  light: {
    background: '#dbe8ee',
    atmosphere: '#3f8fa8',
    ocean:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR42mPo33YSAAPmAg89/GNkAAAAAElFTkSuQmCC',
  },
}

interface EarthGlobeProps {
  sea: SeaLevelContext
  theme: ResolvedTheme
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

/**
 * Shorter forms for the only names long enough to crowd their neighbours.
 *
 * Natural Earth already abbreviates most of the awkward ones — "Dem. Rep.
 * Congo", "Central African Rep.", "Bosnia and Herz." — so this covers the eight
 * that still run past thirteen characters inside the label budget. Every label
 * is extruded 3D text, so a long name is not only wide on the globe but costs
 * geometry per glyph.
 */
const SHORT_NAME: Record<string, string> = {
  'United States of America': 'USA',
  'United Kingdom': 'UK',
  'United Arab Emirates': 'UAE',
  'Central African Rep.': 'C.A.R.',
  'Dem. Rep. Congo': 'DR Congo',
  'Papua New Guinea': 'Papua N.G.',
  'Bosnia and Herz.': 'Bosnia',
  'Dominican Rep.': 'Dom. Rep.',
}

const shortName = (name: string) => SHORT_NAME[name] ?? name

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
/**
 * No side wall at all, rather than a transparent one.
 *
 * three-globe decides whether to build the extruded sides from whether this
 * accessor returns something truthy — and `'rgba(0,0,0,0)'` is a non-empty
 * string. So every country was getting a full torso generated from the globe's
 * centre out to its surface, invisible, and a second material group with it.
 * That doubled the draw calls for the polygon layer and put ~240 more
 * transparent objects into the per-frame depth sort. Returning an empty string
 * skips the geometry entirely; the caps are all that was ever visible.
 */
const NO_SIDE = () => ''
/**
 * Opaque, not 50% black.
 *
 * A translucent line material lands in the transparent pass, which three.js
 * re-sorts by depth every frame — so the draw order of ~640 outlines changed
 * continuously as the globe rotated. Worse, every internal border is drawn
 * twice, once by each neighbouring country, so the two coincident lines
 * blended to a darker value than a coastline and flickered against each other.
 * A solid colour renders in the opaque pass in a stable order and looks the
 * same whether a border is shared or not.
 */
const POLYGON_STROKE = () => 'rgb(64, 72, 62)'
/* Near plane, shared by the setup and resize paths so they cannot drift. It
   can only be this far out because the controls are held back from the surface
   by MIN_CAMERA_DISTANCE; the two numbers have to move together. */
const CAMERA_NEAR = 3

const PATH_POINT_LAT = (p: unknown) => (p as [number, number])[0]
const PATH_POINT_LNG = (p: unknown) => (p as [number, number])[1]

export function EarthGlobe({
  sea,
  theme,
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

  /**
   * One-time camera + controls setup, once the globe object actually exists.
   *
   * `dims` has to be in the dependencies. The globe is not rendered until the
   * stage has been measured, so on the pass where the countries arrive there is
   * no instance to configure yet — and without `dims` here this effect bailed
   * out and never ran again, leaving the globe on OrbitControls' defaults: no
   * auto-rotation, a rotate speed 7× too fast if anything did start it, and
   * none of the framing below.
   *
   * The ref guard keeps it to once per globe. `pointOfView` snaps the camera,
   * and re-running it on every resize would throw away the user's own rotation
   * every time the bottom sheet opened or closed.
   */
  const didSetupGlobe = useRef(false)
  const [globeReady, setGlobeReady] = useState(false)

  useEffect(() => {
    const g = globeRef.current
    if (!g || !dims || features.length === 0 || didSetupGlobe.current) return
    didSetupGlobe.current = true
    const controls = g.controls()
    controls.autoRotate = !prefersReducedMotion()
    controls.autoRotateSpeed = 0.28
    controls.enableDamping = true

    /**
     * Buy back depth precision, which is what makes the borders shimmer.
     *
     * three-globe draws each country's outline as a line lifted 0.01 world
     * units above its fill. Whether that lift survives depends entirely on the
     * depth buffer, and the default camera spans near 0.05 to far 125000 — a
     * 2,500,000:1 range that leaves roughly 0.053 units of depth resolution at
     * the globe's surface. The lift is five times smaller than one depth step,
     * so fill and outline land in the same bucket and fight for the pixel;
     * which one wins changes as the globe turns, and that reads as borders
     * crawling and smearing.
     *
     * The near plane is that low only because the controls allow zooming to
     * 0.055 units off the surface — a distance at which the globe is an
     * unreadable wall anyway. Holding the camera a little further out lets the
     * near plane move out with it, and the lift then clears the depth step by
     * more than an order of magnitude at every zoom level.
     */
    const MIN_CAMERA_DISTANCE = 115 // globe radius is 100 internally
    controls.minDistance = Math.max(controls.minDistance, MIN_CAMERA_DISTANCE)
    const camera = g.camera() as unknown as {
      near: number
      far: number
      updateProjectionMatrix?: () => void
    }
    // Only `near` is set. `far` stays at the library's 125000: it re-applies
    // that continuously, and pulling it in would have been worth about one
    // extra bit of depth on top of the order of magnitude `near` already buys.
    camera.near = CAMERA_NEAR
    camera.updateProjectionMatrix?.()
    setGlobeReady(true)
  }, [dims, features.length])

  // Framing is separate from setup so it can follow the phone/desktop switch
  // without being tied to `dims`, which changes every time the sheet moves.
  useEffect(() => {
    const g = globeRef.current
    if (!g || !globeReady) return
    // Closer on phones so the (smaller) globe fills the frame and per-country
    // labels render large enough to read.
    g.pointOfView({ lat: 20, lng: 10, altitude: isMobile ? 2.1 : 2.15 }, 0)
  }, [globeReady, isMobile])

  /**
   * Render resolution, chosen by watching the frame rate rather than by
   * guessing from the user agent.
   *
   * This used to be a flat cap of 1.5 on anything phone-sized. On a modern
   * phone with a 3× screen that draws a quarter of the pixels it could and
   * lets the browser upscale the result, which is exactly what makes coastlines
   * and label text look chewed. But raising the cap blindly would punish a
   * cheap device, and no user-agent string reliably separates the two.
   *
   * So: start where a capable device should be, measure real frame intervals,
   * and step down only if the device cannot hold the rate. It settles within a
   * couple of seconds and never steps back up, so it cannot oscillate.
   */
  const qualityRef = useRef(0)
  const [pixelRatio, setPixelRatio] = useState<number | null>(null)

  useEffect(() => {
    const ladder = isMobile ? [2.5, 2, 1.5, 1.25] : [2, 1.5, 1.25]
    qualityRef.current = 0
    setPixelRatio(Math.min(window.devicePixelRatio || 1, ladder[0]))

    let raf = 0
    let last = 0
    let samples: number[] = []
    let stop = false

    const tick = (now: number) => {
      if (stop) return
      // A hidden tab stops painting; its intervals say nothing about the GPU.
      if (last && !document.hidden) {
        const dt = now - last
        if (dt < 500) samples.push(dt)
      }
      last = now
      if (samples.length >= 90) {
        const sorted = [...samples].sort((a, b) => a - b)
        const median = sorted[sorted.length >> 1]
        samples = []
        // ~50 fps. Below that, drop a rung and measure again.
        if (median > 20 && qualityRef.current < ladder.length - 1) {
          qualityRef.current += 1
          setPixelRatio(
            Math.min(window.devicePixelRatio || 1, ladder[qualityRef.current]),
          )
        } else {
          stop = true
          return
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      stop = true
      cancelAnimationFrame(raf)
    }
  }, [isMobile, features.length])

  // Apply the chosen ratio, and keep buffer, element and camera in step.
  useEffect(() => {
    const g = globeRef.current
    if (!g || !dims || pixelRatio == null) return
    const renderer = g.renderer()
    if (!renderer) return
    renderer.setPixelRatio(pixelRatio)
    // setPixelRatio resizes the drawing buffer but leaves the CSS size alone,
    // so re-apply the size (default updateStyle=true, matching react-globe.gl)
    // to keep buffer and element in step.
    renderer.setSize(dims.w, dims.h)
    // setSize does not touch the camera, and a stale aspect skews the globe.
    const camera = g.camera() as unknown as {
      aspect?: number
      near: number
      far: number
      updateProjectionMatrix?: () => void
    }
    if (typeof camera.aspect === 'number') {
      camera.aspect = dims.w / dims.h
      // Re-assert the depth range here too: this is the effect that runs on
      // every resize, and a reset near plane brings the border shimmer back.
      // Re-assert the near plane here too: this is the effect that runs on
      // every resize, and a reset near plane brings the border shimmer back.
      camera.near = CAMERA_NEAR
      camera.updateProjectionMatrix?.()
    }
  }, [dims, pixelRatio, features.length])

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

  /**
   * What the globe actually draws. Same countries, minus the islands that
   * cannot occupy a pixel at the size the globe is rendered — a phone globe is
   * about 32 km per pixel, a desktop one about 21.
   *
   * Kept separate from `features` on purpose: every model in the app keeps
   * reading the full outlines, so nothing downstream moves. Only the scene is
   * lighter.
   */
  const displayFeatures = useMemo(() => {
    const minAreaKm2 = isMobile ? 600 : 200
    return features.map((f) => {
      const geometry = dropSubPixelParts(f.geometry, minAreaKm2)
      return geometry === f.geometry ? f : { ...f, geometry }
    })
  }, [features, isMobile])

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
        fireIndex: number
        fireBurnedKm2: number
        fireSeasonDays: number
        droughtAnomaly: number
        aridityClass: AridityClass
        frozenGround: boolean
        peakWetBulbC: number
        wetBulbDaysAbove28: number
        wetBulbDaysAbove31: number
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
      const fire = estimateCountryFire(f, warmingC, sea.physics)
      const water = estimateCountryDrought(f, warmingC, sea.physics)
      const humid = estimateCountryHumidHeat(f, warmingC, sea.physics)
      m.set(f.properties.id, {
        frac,
        absoluteC: estimateCountryTemp(f, warmingC, sea.physics).absoluteC,
        areaLostKm2: areaKm2 * frac,
        futureMm: rain.futureMm,
        deltaMm: rain.deltaMm,
        deltaFrac: rain.deltaFrac,
        fireIndex: fire.index,
        fireBurnedKm2: fire.burnedKm2,
        fireSeasonDays: fire.seasonDays,
        droughtAnomaly: water.anomaly,
        aridityClass: water.aridityClass,
        frozenGround: water.frozenGround,
        peakWetBulbC: humid.peakWetBulbC,
        wetBulbDaysAbove28: humid.daysAbove28,
        wetBulbDaysAbove31: humid.daysAbove31,
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
  /**
   * Each label is its own extruded-text mesh and its own draw call. 150 of them
   * is reasonable on a desktop globe; on a phone they overlap into illegible
   * speckle *and* cost as much as every country polygon combined, so the phone
   * gets the largest countries only — which are the only ones readable at that
   * size anyway.
   */
  const labelBudget = !labelsReady
    ? 0
    : playing
      ? isMobile
        ? 0
        : 24
      : isMobile
        ? 42
        : 150

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
  /** Country names ride along on the labels, except while the timeline plays. */
  const showNames = !playing
  /**
   * How many of them get a name. Fewer than the label budget, because the two
   * caps answer different questions: the budget is how many countries can show a
   * value, and this is how many are wide enough to carry a name beside it.
   *
   * The cost is glyph count. three-globe rebuilds every label's extruded text on
   * each digest, and a name roughly triples the string, so dragging the year
   * slider on a desktop globe measured a median commit of 90 ms with no names,
   * 143 ms at 60, 159 ms at 80 and 187 ms at all 150. 60 is where the curve stops
   * buying anything: barely half the world faces the camera at once, so the names
   * past it were on countries either hidden or too small to read them.
   *
   * The order is by area, so the names land on the countries a reader is actually
   * trying to identify, and the selected or hovered one is always named however
   * small it is. Nothing loses its value — the rest show the number alone, as
   * they did before.
   */
  const nameBudget = isMobile ? 42 : 60

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
      } else if (mapMode === 'drought') {
        const anomaly = metrics?.droughtAnomaly ?? 0
        const label = formatAnomaly(anomaly)
        labels.push({
          id: f.properties.id,
          name: f.properties.name,
          lat: meta.lat,
          lng: meta.lng,
          // On the ice sheets the aridity class is an artefact of running a
          // soil column over ice, so it is named rather than reported.
          text: detailed
            ? `${label} · ${metrics?.frozenGround ? 'polar ground' : (metrics?.aridityClass ?? 'humid')}`
            : label,
          areaKm2: meta.areaKm2,
          // The ramp darkens at both ends, so light text is needed for a strong
          // move in either direction and dark text only near the neutral
          // middle. The crossover sits near 0.8σ, which is where the rust and
          // the blue ends both get too dark to read against — and, unlike the
          // old 1.3σ, is a value countries on the default pathway reach.
          light: isLightText(Math.abs(anomaly) * 3.6),
        })
      } else if (mapMode === 'humidheat') {
        const wet = metrics?.peakWetBulbC ?? 0
        labels.push({
          id: f.properties.id,
          name: f.properties.name,
          lat: meta.lat,
          lng: meta.lng,
          // The wet bulb is what the ramp shows, so it stays the label. The
          // day-counts are the part a reader can act on and are far too long a
          // string to print on every country at once, so they wait for a hover.
          text: detailed
            ? `${wet.toFixed(1)}° · ${Math.round(metrics?.wetBulbDaysAbove28 ?? 0)}d>28 · ${Math.round(metrics?.wetBulbDaysAbove31 ?? 0)}d>31`
            : `${wet.toFixed(coarse ? 0 : 1)}°`,
          areaKm2: meta.areaKm2,
          // The ramp goes dark past 31°C, where the reds and violets start, and
          // stays pale below it. `isLightText` takes a 0-ish to 14-ish scale, so
          // the wet bulb is re-centred on 24°C rather than on zero — otherwise
          // every country on Earth reads as needing light text.
          light: isLightText((wet - 24) * 1.6),
        })
      } else if (mapMode === 'fire') {
        const fire = metrics?.fireIndex ?? 0
        labels.push({
          id: f.properties.id,
          name: f.properties.name,
          lat: meta.lat,
          lng: meta.lng,
          // The index is what the colour ramp shows, so it stays the label. The
          // quantity a reader can actually check is the burned area, and it is
          // too long a string to print on every country at once.
          text: detailed
            ? `${fire.toFixed(0)} · ${formatBurnedArea(metrics?.fireBurnedKm2 ?? 0)} · ${Math.round(metrics?.fireSeasonDays ?? 0)}d`
            : fire.toFixed(0),
          areaKm2: meta.areaKm2,
          // The fire ramp darkens fast, so light text is needed sooner.
          light: isLightText(fire / 14),
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

    /*
      Name the countries. Mutating here is safe and deliberate: `labels` holds
      objects built fresh this pass, and the reconciliation below compares them
      against the cache *after* this runs, so a cached object is never modified
      behind the comparison's back.

      Not while the timeline plays. Every label is extruded 3D text rebuilt on
      each digest, so cost scales with glyph count, and a name roughly triples
      the string — on the one path where labels are already thinned to 24 and
      coarsened to whole degrees precisely because that cost bites. A name
      flickering past at ten years a second is unreadable anyway.
    */
    if (showNames) {
      labels.forEach((l, i) => {
        if (i < nameBudget || l.id === selectedId || l.id === hoverId) {
          l.text = `${shortName(l.name)} ${l.text}`
        }
      })
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
    showNames,
    nameBudget,
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
          backgroundColor={SKY[theme].background}
          globeImageUrl={SKY[theme].ocean}
          showGraticules={false}
          showAtmosphere
          atmosphereColor={SKY[theme].atmosphere}
          atmosphereAltitude={0.12}
          polygonsData={displayFeatures}
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
            if (mapMode === 'fire') {
              return fireColor(metrics?.fireIndex ?? 0, hovered)
            }
            if (mapMode === 'drought') {
              return droughtColor(metrics?.droughtAnomaly ?? 0, hovered)
            }
            if (mapMode === 'humidheat') {
              return humidHeatColor(metrics?.peakWetBulbC ?? 0, hovered)
            }
            return lossColor(metrics?.frac ?? 0, hovered)
          }}
          polygonSideColor={NO_SIDE}
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
            // The datum is the trimmed display copy; hand the panels the real
            // feature so their centroids and areas stay exact.
            const id = (d as CountryFeature).properties.id
            onSelect(features.find((f) => f.properties.id === id) ?? null)
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
            /* On everywhere now: a 1px outline on a rotating sphere crawls
               without multisampling, and cutting the polygon layer's draw
               calls ~6x freed the bandwidth this costs. The adaptive pixel
               ratio above still backs off if a device cannot keep up. */
            antialias: true,
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
        ) : mapMode === 'drought' ? (
          <>
            <span className="temp-legend-title">
              Water balance vs ~2020s
            </span>
            <div className="temp-legend-scale">
              {DROUGHT_LEGEND.map((s) => (
                <span key={s.label} className="temp-legend-stop">
                  <i style={{ background: s.color }} />
                  {s.label}
                </span>
              ))}
            </div>
            <span className="temp-legend-note">
              Labels = change in rainfall minus evaporative demand, in that
              country’s own standard deviations. Hover for its aridity class.
            </span>
          </>
        ) : mapMode === 'humidheat' ? (
          <>
            <span className="temp-legend-title">
              Humid heat: yearly peak wet bulb
            </span>
            <div className="temp-legend-scale">
              {HUMID_HEAT_LEGEND.map((s) => (
                <span key={s.label} className="temp-legend-stop">
                  <i style={{ background: s.color }} />
                  {s.label}
                </span>
              ))}
            </div>
            <span className="temp-legend-note">
              Labels = the wet-bulb temperature reached on about one day a year;
              hover a country for the days above 28°C and 31°C. Wet bulb is what
              sweat can reach, so dry heat scores low however hot it is: the
              Sahara sits near 26°C and the Persian Gulf near 33°C. Past 35°C a
              resting human cannot shed heat at all.
            </span>
          </>
        ) : mapMode === 'fire' ? (
          <>
            <span className="temp-legend-title">Fire weather</span>
            <div className="temp-legend-scale">
              {FIRE_LEGEND.map((s) => (
                <span key={s.label} className="temp-legend-stop">
                  <i style={{ background: s.color }} />
                  {s.label}
                </span>
              ))}
            </div>
            <span className="temp-legend-note">
              Labels = fire-weather index 0–100; hover a country for the area it
              burns each year and how many days of the year it can. Fire needs
              fuel, dryness and heat together, so deserts and frozen ground stay
              low. Burned area is calibrated against the MODIS satellite record.
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
