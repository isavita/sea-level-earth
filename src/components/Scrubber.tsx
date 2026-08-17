import { YEAR_MAX, YEAR_MIN } from '../data/scenarios'

interface ScrubberProps {
  year: number
  playing: boolean
  seaLevelM: number
  warmingC: number
  onYear: (year: number) => void
  onTogglePlay: () => void
}

/**
 * Phone transport, docked in the sheet header rather than inside the Pathway
 * panel: the timeline is the app's primary control, so it has to stay reachable
 * from every tab while the globe is still on screen. ControlPanel drops its own
 * copy on mobile so there is only ever one year slider in the DOM.
 */
export function Scrubber({
  year,
  playing,
  seaLevelM,
  warmingC,
  onYear,
  onTogglePlay,
}: ScrubberProps) {
  const atEnd = year >= YEAR_MAX
  const pct = ((year - YEAR_MIN) / (YEAR_MAX - YEAR_MIN)) * 100

  return (
    <div className="scrubber">
      <button
        type="button"
        className={`scrub-play${playing ? ' playing' : ''}`}
        onClick={onTogglePlay}
        aria-label={
          playing ? 'Pause timeline' : atEnd ? 'Replay timeline' : 'Play timeline'
        }
        aria-pressed={playing}
      >
        <span aria-hidden>{playing ? '❙❙' : atEnd ? '↺' : '▶'}</span>
      </button>
      <div className="scrub-main">
        <div className="scrub-head">
          <span className="scrub-year">{year}</span>
          <span className="scrub-note">
            +{seaLevelM.toFixed(2)} m · +{warmingC.toFixed(1)}°C
          </span>
        </div>
        <input
          type="range"
          min={YEAR_MIN}
          max={YEAR_MAX}
          step={5}
          value={year}
          aria-label="Year"
          onChange={(e) => onYear(Number(e.target.value))}
          /* Drives the filled portion of the custom track. */
          style={{ ['--pct' as string]: `${pct}%` }}
        />
      </div>
    </div>
  )
}
