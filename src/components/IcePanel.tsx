import type { IceState } from '../data/ice'
import { ARCTIC_ICE_FREE_M_KM2, ARCTIC_SIA_REF_M_KM2, ICE_EXPLAINERS } from '../data/ice'

interface IcePanelProps {
  ice: IceState
  year: number
  warmingC: number
}

export function IcePanel({ ice, year, warmingC }: IcePanelProps) {
  const arcticPct = Math.min(100, ice.arcticFractionOf1979 * 100)
  const greenlandPct = ice.greenlandRemaining * 100
  const antarcticPct = ice.antarcticRemaining * 100
  const iceFreeMark = (ARCTIC_ICE_FREE_M_KM2 / ARCTIC_SIA_REF_M_KM2) * 100

  const riskLabel = {
    low: 'Low sheet risk',
    elevated: 'Elevated sheet risk',
    high: 'High sheet risk',
    extreme: 'Extreme sheet risk',
  }[ice.sheetRisk]

  const bars = [
    {
      key: 'arctic',
      label: 'Arctic summer sea ice',
      value: `${ice.arcticSeaIceMkm2.toFixed(1)} M km²`,
      pct: arcticPct,
      tone: 'arctic' as const,
      foot: ice.arcticIceFreeSummer
        ? 'Practically ice-free September'
        : `${Math.round(arcticPct)}% of late-1970s`,
      warn: ice.arcticIceFreeSummer,
      mark: iceFreeMark,
    },
    {
      key: 'greenland',
      label: 'Greenland ice sheet',
      value: `${greenlandPct.toFixed(0)}% left`,
      pct: greenlandPct,
      tone: 'sheet' as const,
      foot: 'Volume remaining',
      warn: false,
      mark: null as number | null,
    },
    {
      key: 'antarctic',
      label: 'Antarctic ice sheet',
      value: `${antarcticPct.toFixed(0)}% left`,
      pct: antarcticPct,
      tone: 'sheet' as const,
      foot: 'Volume remaining',
      warn: false,
      mark: null as number | null,
    },
  ]

  return (
    <section className="panel ice-panel">
      <header className="panel-head">
        <p className="eyebrow">Cryosphere</p>
        <h2>Polar ice</h2>
      </header>

      <div className="ice-bars" role="img" aria-label="Ice remaining as bars">
        {bars.map((b) => (
          <div key={b.key} className="ice-bar-col">
            <div className="ice-bar-shaft">
              {b.mark != null && (
                <span
                  className="ice-bar-threshold"
                  style={{ bottom: `${b.mark}%` }}
                  title="Ice-free threshold"
                />
              )}
              <div
                className={`ice-bar-fill ${b.tone}${b.warn ? ' warn' : ''}`}
                style={{ height: `${Math.max(2, b.pct)}%` }}
              />
            </div>
            <div className="ice-bar-meta">
              <strong>{b.value}</strong>
              <span>{b.label}</span>
              <em className={b.warn ? 'warn' : undefined}>{b.foot}</em>
            </div>
          </div>
        ))}
      </div>

      <p className="ice-pace">{ice.paceNote}</p>

      <dl className="ice-meta">
        <div>
          <dt>Global warming now</dt>
          <dd>+{warmingC.toFixed(2)}°C</dd>
        </div>
        <div>
          <dt>Sheet tipping outlook</dt>
          <dd className={`risk-${ice.sheetRisk}`}>{riskLabel}</dd>
        </div>
        <div>
          <dt>First ice-free Sept. (path)</dt>
          <dd>
            {ice.arcticFirstIceFreeYear
              ? ice.arcticFirstIceFreeYear <= year
                ? `~${ice.arcticFirstIceFreeYear} (reached)`
                : `~${ice.arcticFirstIceFreeYear}`
              : 'Not locked in'}
          </dd>
        </div>
      </dl>

      <details className="ice-details">
        <summary>How fast does the ice go?</summary>
        <ul>
          {ICE_EXPLAINERS.map((item) => (
            <li key={item.title}>
              <strong>{item.title}.</strong> {item.body}
            </li>
          ))}
        </ul>
      </details>
    </section>
  )
}
