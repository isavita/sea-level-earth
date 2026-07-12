import { useCallback, useEffect, useRef, useState } from 'react'

/** Simulated years advanced per real second while playing. */
const YEARS_PER_SEC = 28
/**
 * Minimum gap between committed year updates. The globe re-colours ~180
 * polygons per update, so we commit ~14×/s instead of every animation frame —
 * smooth to the eye, far lighter on a phone GPU. requestAnimationFrame also
 * auto-pauses on hidden tabs, so playback never drains a backgrounded phone.
 */
const COMMIT_MS = 70

interface Playback {
  year: number
  /** Manual set (slider / jumps) — always pauses playback. */
  setYear: (year: number) => void
  playing: boolean
  togglePlay: () => void
}

export function useTimelinePlayback(
  min: number,
  max: number,
  initial: number,
): Playback {
  const [year, setYearState] = useState(initial)
  const [playing, setPlaying] = useState(false)
  const yearRef = useRef(year)
  yearRef.current = year

  const setYear = useCallback(
    (y: number) => {
      setPlaying(false)
      setYearState(Math.min(max, Math.max(min, y)))
    },
    [min, max],
  )

  useEffect(() => {
    if (!playing) return
    let raf = 0
    let last = performance.now()
    let acc = 0
    const tick = (now: number) => {
      acc += now - last
      last = now
      if (acc >= COMMIT_MS) {
        const next = yearRef.current + (YEARS_PER_SEC * acc) / 1000
        acc = 0
        if (next >= max) {
          setYearState(max)
          setPlaying(false)
          return
        }
        setYearState(next)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, max])

  const togglePlay = useCallback(() => {
    setPlaying((p) => {
      // Restart from the beginning if we're paused at the very end.
      if (!p && yearRef.current >= max) setYearState(min)
      return !p
    })
  }, [min, max])

  return { year, setYear, playing, togglePlay }
}
