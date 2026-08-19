import {
  DATA_SOURCES,
  LIMITS_NOTE,
  MODEL_EXPLAINERS,
  MODEL_NOTES,
  READING_GROUPS,
} from '../data/sources'

export function LearnPanel() {
  return (
    <section className="panel learn-panel">
      <header className="panel-head">
        <p className="eyebrow">Go deeper</p>
        <h2>How this works</h2>
      </header>

      <p className="learn-intro">
        Every number on this globe is computed in your browser from a handful of
        curves and patterns. Nothing is looked up from a forecast. This is the
        whole chain, layer by layer — including where each one stops being
        trustworthy.
      </p>

      {/* The calculation itself, before the reading list: someone asking "how
          is this worked out" should not have to scroll past a link farm. */}
      <div className="explainers">
        {MODEL_EXPLAINERS.map((m, i) => (
          <details className="explainer" key={m.id}>
            <summary>
              <span className="explainer-step" aria-hidden>
                {i + 1}
              </span>
              <span className="explainer-title">{m.title}</span>
            </summary>
            <p className="explainer-question">{m.question}</p>
            <ol className="explainer-steps">
              {m.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            {m.formula && (
              <p className="explainer-formula">
                <code>{m.formula}</code>
              </p>
            )}
            <p className="explainer-limits">
              <strong>What it cannot tell you.</strong> {m.limits}
            </p>
          </details>
        ))}
      </div>

      <p className="limits-note">{LIMITS_NOTE}</p>

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
        <summary>Every layer in one line</summary>
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
    </section>
  )
}
