import './globals.css'

const catalog = [
  {
    title: 'UFC',
    text: 'Fight information, evidence, form, matchup context and historical results.',
    cta: 'Explore UFC',
    href: '/ufc'
  },
  {
    title: 'Boxing',
    text: 'Bout context, fighter records, styles, form and historical comparisons.',
    cta: 'Explore Boxing',
    href: '/boxing'
  },
  {
    title: 'Fighters',
    text: 'Clean fighter profiles built from documented records and source-backed facts.',
    cta: 'Browse Fighters',
    href: '/fighters'
  },
  {
    title: 'Events',
    text: 'Upcoming and completed cards with matchup details and result history.',
    cta: 'View Events',
    href: '/events'
  },
  {
    title: 'Analysis',
    text: 'Evidence-led breakdowns that separate facts, attributed views and uncertainty.',
    cta: 'Read Analysis',
    href: '/analysis'
  },
  {
    title: 'Results',
    text: 'Post-fight outcomes, method of victory and retrospective audits.',
    cta: 'View Results',
    href: '/results'
  }
]

const actions = [
  { title: 'Upcoming fights', text: 'See the next MMA and boxing cards in one place.', href: '/events' },
  { title: 'Fighter files', text: 'Open a clean evidence-led profile.', href: '/fighters' },
  { title: 'Fight analysis', text: 'Read matchup context before the bell.', href: '/analysis' },
  { title: 'Results & history', text: 'Track what happened after the event.' }
]

export default function Home() {
  return (
    <main className="site-shell">
      <section className="hero">
        <p className="eyebrow">Fight Edge - MMA/Boxing</p>
        <h1>Fight information without the noise.</h1>
        <p className="lede">
          Evidence-led fight information, analysis, discussion and historical context.
        </p>
        <div className="cta-row">
          <a className="primary-cta" href="#catalog">Explore the catalog</a>
          <a className="secondary-cta" href="#analysis">Latest analysis</a>
        </div>
      </section>

      <section id="catalog" className="section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Catalog</p>
            <h2>Explore Fight Edge</h2>
          </div>
          <p className="scroll-hint">Swipe or shift-scroll horizontally</p>
        </div>

        <div className="carousel" aria-label="Fight Edge catalog">
          {catalog.map((item) => (
            <article className="catalog-card" key={item.title}>
              <div>
                <span className="card-kicker">Fight Edge</span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </div>
              <a className="card-cta" href={item.href}>{item.cta}<span>→</span></a>
            </article>
          ))}
        </div>
      </section>

      <section id="analysis" className="section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Quick access</p>
            <h2>Start here</h2>
          </div>
        </div>

        <div className="cta-carousel" aria-label="Fight Edge quick actions">
          {actions.map((item) => (
            <a className="action-card" href={item.href} key={item.title}>
              <span className="action-title">{item.title}</span>
              <span className="action-text">{item.text}</span>
              <span className="action-arrow">→</span>
            </a>
          ))}
        </div>
      </section>

      <footer>
        <span>Fight Edge - MMA/Boxing</span>
        <span>Information first. Context over noise.</span>
      </footer>
    </main>
  )
}
