import { geoArea, geoBounds } from 'd3-geo'
import type { Geometry, Polygon, MultiPolygon, Position } from 'geojson'

/**
 * Reshapes country outlines so the globe renderer never hits its quadratic
 * fallback.
 *
 * three-conic-polygon-geometry triangulates a country in flat lng/lat space
 * with delaunator — which is fast, but wrong for any polygon that wraps the
 * antimeridian or encloses a pole. For those it falls back to d3-geo-voronoi,
 * whose cost grows with the square of the vertex count. Measured on the 1:50m
 * Natural Earth outlines, exactly **three of 1,616 polygons** take that path,
 * and they cost 4.7 s of the 5.2 s spent building every country on the globe:
 *
 *     Russia (mainland, 4,894 pts)  3,531 ms
 *     Antarctica     (2,796 pts)      958 ms
 *     everything else (91,806 pts)    450 ms
 *
 * Halving Russia's vertices quartered its cost (3,531 → 931 → 245 → 69 ms),
 * which is the signature of the quadratic path rather than of the data being
 * large. So the fix is to stop taking that path, not to ship coarser outlines.
 */

/** Longitude jump that can only mean the ring wrapped across ±180°. */
const WRAP = 180

/**
 * Rings that cross the antimeridian are cut into an eastern and a western half.
 * This is exact — no vertex moves, the seam runs down 180° where the globe has
 * no visible edge, and `geoArea` is unchanged to 6 decimal places. Both halves
 * then triangulate on the fast path.
 */
function unwrapRing(ring: Position[]): Position[] {
  const out: Position[] = [ring[0].slice()]
  let offset = 0
  for (let i = 1; i < ring.length; i++) {
    const step = ring[i][0] - ring[i - 1][0]
    if (step > WRAP) offset -= 360
    else if (step < -WRAP) offset += 360
    out.push([ring[i][0] + offset, ring[i][1]])
  }
  return out
}

/** Sutherland–Hodgman clip against a meridian half-plane. */
function clipToMeridian(
  ring: Position[],
  bound: number,
  keepWest: boolean,
): Position[] {
  const inside = (p: Position) => (keepWest ? p[0] <= bound : p[0] >= bound)
  const out: Position[] = []
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]
    const b = ring[(i + 1) % ring.length]
    const aIn = inside(a)
    if (aIn) out.push(a)
    if (aIn !== inside(b)) {
      const t = (bound - a[0]) / (b[0] - a[0])
      out.push([bound, a[1] + t * (b[1] - a[1])])
    }
  }
  return out
}

function closeRing(ring: Position[]): Position[] {
  const first = ring[0]
  const last = ring[ring.length - 1]
  if (!first) return ring
  return first[0] === last[0] && first[1] === last[1] ? ring : [...ring, first]
}

function crossesAntimeridian(ring: Position[]): boolean {
  for (let i = 1; i < ring.length; i++) {
    if (Math.abs(ring[i][0] - ring[i - 1][0]) > WRAP) return true
  }
  return false
}

/** A ring with fewer than three distinct vertices encloses nothing. */
function isDrawable(ring: Position[]): boolean {
  if (ring.length < 4) return false
  const seen = new Set(ring.map((p) => `${p[0]},${p[1]}`))
  return seen.size >= 3
}

function lngRange(ring: Position[]): { min: number; max: number } {
  let min = Infinity
  let max = -Infinity
  for (const p of ring) {
    if (p[0] < min) min = p[0]
    if (p[0] > max) max = p[0]
  }
  return { min, max }
}

/** Shift a ring by whole turns so `min` lands in [-180, 180). */
function normaliseTurn(ring: Position[], min: number): Position[] {
  const shift = -360 * Math.floor((min + 180) / 360)
  return shift === 0 ? ring : ring.map((p) => [p[0] + shift, p[1]])
}

/** Clamp float drift from the clip back inside the valid lng domain. */
function clampLng(ring: Position[]): Position[] {
  return ring.map((p) => [Math.max(-180, Math.min(180, p[0])), p[1]])
}

/**
 * Splits one polygon (outer ring + holes) into the parts that sit either side
 * of the antimeridian. Holes are carried into whichever half they land in, so a
 * lake near the seam stays a lake.
 */
function splitPolygon(rings: Position[][]): Position[][][] {
  const outer = rings[0]
  if (!outer || !crossesAntimeridian(outer)) return [rings]

  const unwrappedOuter = unwrapRing(outer)
  const outerRange = lngRange(unwrappedOuter)

  // A ring that encircles a pole runs through every meridian, so unwrapping it
  // never terminates in a single 360° window and cutting it at 180° would open
  // the shape up. Antarctica is the one case; leave it whole and let the
  // vertex budget below deal with its cost.
  if (outerRange.max - outerRange.min >= 359) return [rings]

  // Put every ring in the same turn as the outer ring, so a hole cannot end up
  // a full revolution away from the polygon that contains it.
  const normalised = rings.map((ring, i) => {
    const unwrapped = i === 0 ? unwrappedOuter : unwrapRing(ring)
    return normaliseTurn(unwrapped, i === 0 ? outerRange.min : lngRange(unwrapped).min)
  })

  const shiftedOuter = normalised[0]
  if (lngRange(shiftedOuter).max <= WRAP) {
    // Unwrapping alone resolved the wrap — no cut needed.
    return [normalised.map((r) => closeRing(clampLng(r)))]
  }

  const halves: Position[][][] = []
  for (const keepWest of [true, false]) {
    const clipped = normalised
      .map((ring) => clipToMeridian(ring, WRAP, keepWest))
      .map((ring) =>
        closeRing(clampLng(keepWest ? ring : ring.map((p) => [p[0] - 360, p[1]]))),
      )
      .filter(isDrawable)
    // An outer ring entirely on the other side leaves nothing to draw.
    if (clipped.length > 0) halves.push(clipped)
  }
  return halves.length > 0 ? halves : [rings]
}

/**
 * Douglas–Peucker, in degrees. Only ever applied to polygons that must use the
 * quadratic path anyway (in practice Antarctica alone), so no shared border is
 * ever touched and no country can drift away from its neighbour.
 */
function simplifyRing(ring: Position[], epsilon: number): Position[] {
  if (ring.length < 4) return ring
  const keep = new Uint8Array(ring.length)
  keep[0] = 1
  keep[ring.length - 1] = 1
  const stack: [number, number][] = [[0, ring.length - 1]]

  while (stack.length > 0) {
    const [lo, hi] = stack.pop()!
    if (hi - lo < 2) continue
    const [ax, ay] = ring[lo]
    const [bx, by] = ring[hi]
    const dx = bx - ax
    const dy = by - ay
    const norm = Math.hypot(dx, dy)
    let worst = -1
    let worstIdx = -1
    for (let i = lo + 1; i < hi; i++) {
      const [px, py] = ring[i]
      const dist =
        norm === 0
          ? Math.hypot(px - ax, py - ay)
          : Math.abs(dy * px - dx * py + bx * ay - by * ax) / norm
      if (dist > worst) {
        worst = dist
        worstIdx = i
      }
    }
    if (worst > epsilon && worstIdx > 0) {
      keep[worstIdx] = 1
      stack.push([lo, worstIdx], [worstIdx, hi])
    }
  }

  const out = ring.filter((_, i) => keep[i] === 1)
  return out.length >= 4 ? out : ring
}

/**
 * True when the renderer will be forced onto the slow triangulation.
 *
 * `geoBounds` is the authority — it is what the renderer itself consults, and
 * it correctly reports a pole-enclosing ring as reaching ±90° even when no
 * vertex does. It is also far too slow to run on all 1,600 polygons, so a plain
 * latitude scan rules out the ~99% that come nowhere near a pole first.
 */
function needsSlowPath(rings: Position[][]): boolean {
  let minLat = Infinity
  let maxLat = -Infinity
  for (const p of rings[0]) {
    if (p[1] < minLat) minLat = p[1]
    if (p[1] > maxLat) maxLat = p[1]
  }
  if (maxLat < 80 && minLat > -80) return false

  const [[minLng, minLat2], [maxLng, maxLat2]] = geoBounds({
    type: 'Polygon',
    coordinates: rings,
  })
  return minLng > maxLng || maxLat2 >= 89 || minLat2 <= -89
}

/**
 * Vertex budget for a polygon that genuinely encircles a pole and so cannot
 * avoid the quadratic path. Antarctica at ~700 points still reads as Antarctica
 * at any zoom this globe allows, and costs ~70 ms instead of ~960 ms.
 */
const POLAR_VERTEX_BUDGET = 700

function simplifyPolar(rings: Position[][]): Position[][] {
  const count = rings.reduce((n, r) => n + r.length, 0)
  if (count <= POLAR_VERTEX_BUDGET) return rings
  // Coarsen until the ring fits the budget. Antarctica lands on the second or
  // third step; the loop is bounded so a pathological outline cannot hang.
  let epsilon = 0.02
  let out = rings
  for (let i = 0; i < 8; i++) {
    out = rings.map((r) => simplifyRing(r, epsilon))
    if (out.reduce((n, r) => n + r.length, 0) <= POLAR_VERTEX_BUDGET) break
    epsilon *= 2
  }
  return out
}

/**
 * Drops islands too small to occupy a pixel, for rendering only.
 *
 * three-globe builds one scene object per *part*, not per country, and draws
 * each one twice — once for the fill, once for the border. The 1:50m outlines
 * carry 1,619 parts, so the globe was issuing well over three thousand draw
 * calls a frame, and the great majority of them were for specks smaller than
 * one pixel. On a phone that is the whole performance problem, and the specks
 * were visible only as coastline noise.
 *
 * The largest part of every country is always kept, whatever its size, so no
 * country can disappear from the map — Bermuda is 65 km² and the app has real
 * exposure data for it. At the 600 km² default this hides 0.125% of the
 * world's land and removes 60% of the draw calls.
 *
 * Rendering only: the models keep reading the full geometry, so no centroid,
 * area or projection anywhere else in the app shifts because of this.
 */
export function dropSubPixelParts(
  geometry: Geometry,
  minAreaKm2: number,
): Geometry {
  if (geometry.type !== 'MultiPolygon') return geometry
  const parts = (geometry as MultiPolygon).coordinates
  if (parts.length < 2) return geometry

  const EARTH_R2 = 6371 * 6371
  const sized = parts.map((rings) => ({
    rings,
    km2: geoArea({ type: 'Polygon', coordinates: rings }) * EARTH_R2,
  }))
  let largest = 0
  for (let i = 1; i < sized.length; i++) {
    if (sized[i].km2 > sized[largest].km2) largest = i
  }
  const kept = sized
    .filter((p, i) => i === largest || p.km2 >= minAreaKm2)
    .map((p) => p.rings)

  return kept.length === parts.length
    ? geometry
    : { type: 'MultiPolygon', coordinates: kept }
}

/**
 * Rewrites a country's geometry into a form the globe can triangulate quickly.
 * Shape-preserving for every country that does not touch a pole.
 */
export function optimiseForGlobe(geometry: Geometry): Geometry {
  if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') {
    return geometry
  }

  const parts: Position[][][] =
    geometry.type === 'Polygon'
      ? [(geometry as Polygon).coordinates]
      : (geometry as MultiPolygon).coordinates

  const out: Position[][][] = []
  for (const part of parts) {
    for (const piece of splitPolygon(part)) {
      out.push(needsSlowPath(piece) ? simplifyPolar(piece) : piece)
    }
  }

  if (out.length === 1 && geometry.type === 'Polygon') {
    return { type: 'Polygon', coordinates: out[0] }
  }
  return { type: 'MultiPolygon', coordinates: out }
}
