export default function AuthShell({ eyebrow, children }) {
  return (
    <div className="auth-shell">
      <aside className="auth-panel" aria-hidden="true">
        <img
          src="https://images.unsplash.com/photo-1509228468518-180dd4864904?w=1200&q=85&auto=format&fit=crop"
          alt=""
          className="auth-panel-img"
        />
        <div className="auth-panel-overlay" />
        <div className="auth-panel-content">
          <span className="nav-brand">GET 210 <span className="nav-brand-dot">·</span> ODE Solver</span>
          <p className="auth-panel-quote">
            Every value in this notebook — Y₀, D, S, the plots, the error tables — is derived
            from your own matriculation number.
          </p>
        </div>
      </aside>

      <main className="auth-main">
        <div className="auth-main-inner">
          <div className="auth-card">
            {eyebrow && <span className="eyebrow auth-eyebrow">{eyebrow}</span>}
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}
