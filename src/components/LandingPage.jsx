export default function LandingPage({ onGetStarted, onReturning }) {
  return (
    <div className="landing">

      {/* Nav */}
      <nav className="landing-nav">
        <span className="nav-brand">GET 210 <span className="nav-brand-dot">·</span> ODE Solver</span>
        <button className="nav-returning" onClick={onReturning}>Already paid? →</button>
      </nav>

      {/* Hero */}
      <section className="hero">
        <img
          src="https://images.unsplash.com/photo-1509228468518-180dd4864904?w=1800&q=85&auto=format&fit=crop"
          alt=""
          className="hero-img"
          aria-hidden="true"
        />
        <div className="hero-overlay" />

        <div className="hero-content">
          <div className="hero-badge">Engineering Mathematics II — GET 210</div>
          <h1 className="hero-title">
            Stop guessing.<br />
            <span className="hero-title-accent">Get your exact answers.</span>
          </h1>
          <p className="hero-sub">
            Your personalised ODE notebook — Euler, Heun, exact symbolic solutions,
            convergence analysis and plots — all generated from your matric number
            and formatted for submission.
          </p>

          <div className="hero-actions">
            <button className="btn-hero" onClick={onGetStarted}>
              Generate My Notebook — ₦1,500
            </button>
          </div>

          <div className="hero-trust">
            <span className="trust-item">✓ One-time payment</span>
            <span className="trust-item">✓ Instant access</span>
            <span className="trust-item">✓ PDF-ready output</span>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <div className="stats-bar">
        {[
          { value: '2', label: 'Questions solved' },
          { value: '4', label: 'Step sizes compared' },
          { value: '100%', label: 'Personalised to you' },
          { value: 'PDF', label: 'Export-ready format' },
        ].map(({ value, label }) => (
          <div key={label} className="stat-bar-item">
            <span className="stat-bar-value">{value}</span>
            <span className="stat-bar-label">{label}</span>
          </div>
        ))}
      </div>

      {/* What you get */}
      <section className="what-section">
        <div className="what-inner">
          <p className="section-eyebrow">What's included</p>
          <h2 className="section-title">Everything you need, nothing you don't</h2>

          <div className="what-grid">
            {[
              {
                icon: '⚡',
                title: 'Personalised parameters',
                desc: 'D and S extracted from your matric number. Your Y₀, your equations, your results — not a copy-paste from someone else.',
              },
              {
                icon: '📐',
                title: 'Exact symbolic solutions',
                desc: 'SymPy solves the ODEs analytically. You get the closed-form exact answer, not just a numerical approximation.',
              },
              {
                icon: '📊',
                title: 'Euler & Heun comparison',
                desc: 'Both methods run at h = 0.1 and h = 0.2. Error tables, convergence order, and side-by-side plots included.',
              },
              {
                icon: '🖨️',
                title: 'Submission-ready PDF',
                desc: 'Jupyter notebook layout with cell numbers, code blocks, and output sections. Print straight from the browser.',
              },
              {
                icon: '🔒',
                title: 'Your work is saved',
                desc: 'Come back any time with your matric number. Your results are stored — no need to regenerate or pay again.',
              },
              {
                icon: '📝',
                title: 'Full discussion included',
                desc: 'LTE analysis, convergence order, and numerical stability discussion written out — tailored to your specific values.',
              },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="what-card">
                <span className="what-icon">{icon}</span>
                <h3 className="what-title">{title}</h3>
                <p className="what-desc">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="how-section">
        <div className="how-inner">
          <p className="section-eyebrow">How it works</p>
          <h2 className="section-title">Three steps to your notebook</h2>
          <div className="how-steps">
            {[
              { n: '01', title: 'Pay once', desc: 'One-time ₦1,500 via Paystack. Secure, instant.' },
              { n: '02', title: 'Enter your matric', desc: 'Your matric number drives all the personalised parameters.' },
              { n: '03', title: 'Export & submit', desc: 'Print to PDF directly from your browser. Done.' },
            ].map(({ n, title, desc }) => (
              <div key={n} className="how-step">
                <span className="how-n">{n}</span>
                <h3 className="how-title">{title}</h3>
                <p className="how-desc">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="cta-section">
        <div className="cta-inner">
          <h2 className="cta-title">Ready to generate your notebook?</h2>
          <p className="cta-sub">One payment. Instant access. Your results, your name, your matric number.</p>
          <button className="btn-hero" onClick={onGetStarted}>
            Get Started — ₦1,500
          </button>
          <button className="cta-returning" onClick={onReturning}>
            Already paid? Access your work →
          </button>
        </div>
      </section>

    </div>
  )
}
