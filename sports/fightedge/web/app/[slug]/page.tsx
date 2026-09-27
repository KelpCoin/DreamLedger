import Link from 'next/link'

const pages: Record<string, { title: string; description: string }> = {
  ufc: { title: 'UFC', description: 'MMA fight information, matchup context, documented records and results.' },
  boxing: { title: 'Boxing', description: 'Boxing bout context, fighter records, styles, form and historical comparisons.' },
  fighters: { title: 'Fighters', description: 'Evidence-led fighter files built from documented records and source-backed facts.' },
  events: { title: 'Events', description: 'Upcoming and completed fight cards with matchup details and result history.' },
  analysis: { title: 'Analysis', description: 'Evidence-led breakdowns separating facts, attributed views and uncertainty.' },
  results: { title: 'Results', description: 'Post-fight outcomes, methods of victory and retrospective history.' },
}

export default async function FightEdgeSection({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const page = pages[slug] ?? { title: 'Fight Edge', description: 'Fight information without the noise.' }

  return (
    <main className="site-shell">
      <section className="hero">
        <p className="eyebrow">Fight Edge - MMA/Boxing</p>
        <h1>{page.title}</h1>
        <p className="lede">{page.description}</p>
        <div className="cta-row">
          <Link className="primary-cta" href="/">Back to Fight Edge</Link>
        </div>
      </section>
      <section className="section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Live section</p>
            <h2>{page.title}</h2>
          </div>
        </div>
        <article className="catalog-card">
          <div>
            <span className="card-kicker">Fight Edge</span>
            <h3>Section is live</h3>
            <p>This route is deployed as part of the Fight Edge public surface. Data integrations can be attached without replacing the public shell.</p>
          </div>
        </article>
      </section>
      <footer>
        <span>Fight Edge - MMA/Boxing</span>
        <span>Information first. Context over noise.</span>
      </footer>
    </main>
  )
}
