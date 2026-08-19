/**
 * Hover cue for an opaque map fill.
 *
 * Hover used to be expressed as a small alpha change, which is no longer
 * available now that the fills are opaque — and which was the reason every
 * country sat in the transparent render pass. Lifting the colour toward white
 * reads more clearly anyway.
 */
export function lift(r: number, g: number, b: number, hovered: boolean): string {
  if (!hovered) return `rgb(${r}, ${g}, ${b})`
  const m = (v: number) => Math.round(v + (255 - v) * 0.22)
  return `rgb(${m(r)}, ${m(g)}, ${m(b)})`
}
