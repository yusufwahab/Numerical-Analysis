export default function LandingPage({ onGetStarted }) {
  return (
    <div className="landing">

      {/* Nav */}
      <nav className="landing-nav">
        <div className="nav-left">
          <span className="nav-mark" aria-hidden="true">∫</span>
          <span className="nav-brand">GET 210 <span className="nav-brand-dot">·</span> ODE Solver</span>
        </div>
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
        <div className="hero-glow-a" aria-hidden="true" />
        <div className="hero-glow-b" aria-hidden="true" />

        <div className="hero-inner">
          <div className="hero-content reveal reveal-1">
            <span className="hero-badge">Engineering Mathematics II — GET 210</span>
            <h1 className="hero-title">
              Stop guessing.
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
              <span className="trust-item"><strong>✓</strong> One-time payment</span>
              <span className="trust-item"><strong>✓</strong> Instant access</span>
              <span className="trust-item"><strong>✓</strong> PDF-ready output</span>
            </div>
          </div>

          <div className="hero-visual reveal reveal-3" aria-hidden="true">
            <div className="hero-visual-glow" />
            <div className="mock-window">
              <div className="mock-bar">
                <span className="mock-dot" />
                <span className="mock-dot" />
                <span className="mock-dot" />
              </div>
              <div className="mock-body">
                <div className="mock-eyebrow">Out[3] — Question 1 Results</div>
                <div className="mock-stats">
                  <div className="mock-stat"><span>Y₀</span><strong>7.209</strong></div>
                  <div className="mock-stat"><span>Euler err</span><strong>0.0243</strong></div>
                  <div className="mock-stat"><span>Heun err</span><strong>0.0019</strong></div>
                </div>
                <div className="mock-chart-wrap">
                  <svg className="mock-chart" viewBox="0 0 300 110" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="mockLine" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0" stopColor="#7dc2ff" />
                        <stop offset="1" stopColor="#1d4ed8" />
                      </linearGradient>
                    </defs>
                    <polyline
                      points="0,88 30,74 60,78 90,52 120,58 150,32 180,38 210,18 240,24 270,8 300,14"
                      fill="none"
                      stroke="url(#mockLine)"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <polyline
                      points="0,88 30,70 60,64 90,44 120,46 150,26 180,30 210,12 240,16 270,4 300,10"
                      fill="none"
                      stroke="rgba(255,255,255,0.22)"
                      strokeWidth="2"
                      strokeDasharray="4 4"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
                <div className="mock-code">
                  <span className="tok-kw">def</span> <span className="tok-fn">heun</span>(f, y0, t0, tend, h=<span className="tok-num">0.1</span>):
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

    </div>
  )
}
