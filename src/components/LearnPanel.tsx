import {
  DATA_SOURCES,
  LIMITS_NOTE,
  MODEL_NOTES,
  READING_GROUPS,
} from '../data/sources'

export function LearnPanel() {
  return (
    <section className="panel learn-panel">
      <header className="panel-head">
        <p className="eyebrow">Go deeper</p>
        <h2>Learn & sources</h2>
      </header>

      <p className="learn-intro">
        Everything here is a simplified model. These are the places that do it
        properly — start with the simulators if you want to turn the dials
        yourself.
      </p>

      {READING_GROUPS.map((group) => (
        <div key={group.heading} className="reading-group">
          <h3 className="reading-heading">{group.heading}</h3>
          <p className="reading-intro">{group.intro}</p>
          <ul className="reading-list">
            {group.links.map((link) => (
              <li key={link.href}>
                <a
                  className="reading-card"
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className="reading-card-top">
                    <span className="reading-title">{link.title}</span>
                    <span className={`reading-kind kind-${link.kind.toLowerCase()}`}>
                      {link.kind}
                    </span>
                  </span>
                  <span className="reading-blurb">{link.blurb}</span>
                  <span className="reading-go" aria-hidden>
                    {new URL(link.href).hostname.replace(/^www\./, '')} ↗
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <details className="scenario-details">
        <summary>How this model works</summary>
        <ul className="note-list">
          {MODEL_NOTES.map((n) => (
            <li key={n.title}>
              <strong>{n.title}.</strong> {n.body}
            </li>
          ))}
        </ul>
      </details>

      <details className="scenario-details">
        <summary>Data behind the map</summary>
        <ul className="note-list">
          {DATA_SOURCES.map((n) => (
            <li key={n.title}>
              <strong>{n.title}.</strong> {n.body}
            </li>
          ))}
        </ul>
      </details>

      <p className="limits-note">{LIMITS_NOTE}</p>
    </section>
  )
}
