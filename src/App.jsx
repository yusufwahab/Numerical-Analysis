import { useState, useEffect } from 'react'
import { CodeCell, MarkdownCell, OutputCell } from './components/Cells'
import { Q1Discussion, Q2Discussion } from './lib/analysis'
import LandingPage from './components/LandingPage'
import PaymentGate from './components/PaymentGate'
import PostPayment from './components/PostPayment'
import ReturningUser from './components/ReturningUser'
import PreviewGate from './components/PreviewGate'
import ContactButton from './components/ContactButton'
import { apiFetch } from './lib/api'

function formatFormula(expr) {
  if (!expr) return ''
  return expr.replace(/\*\*/g, '^').replace(/\*/g, '·').replace(/exp/g, 'e^')
}

function StatCard({ label, value, accent = false }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${accent ? 'stat-accent' : ''}`}>{value}</div>
    </div>
  )
}

function ErrorTable({ q1 }) {
  const rows = [
    { h: '0.2', euler: q1.errors['h0.2'].euler, heun: q1.errors['h0.2'].heun },
    { h: '0.1', euler: q1.errors['h0.1'].euler, heun: q1.errors['h0.1'].heun },
  ]
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Step size h</th>
            <th>Euler abs. error @ t=2</th>
            <th>Heun abs. error @ t=2</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.h}>
              <td className="font-mono">{r.h}</td>
              <td className="font-mono">{r.euler.toFixed(6)}</td>
              <td className="font-mono">{r.heun.toFixed(6)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>Empirical order p</td>
            <td className="font-mono accent">{q1.convergence_order.euler?.toFixed(3) ?? 'n/a'}</td>
            <td className="font-mono accent">{q1.convergence_order.heun?.toFixed(3) ?? 'n/a'}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

// ─── Notebook view ───────────────────────────────────────────────────────────

function NotebookView({ fullName, matric, result, locked, onReset, onUnlock }) {
  const [loading, setLoading] = useState(!result)
  const [data, setData] = useState(result)
  const [error, setError] = useState('')

  useEffect(() => {
    if (result) return
    async function solve() {
      try {
        const res = await apiFetch('/api/solve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ matric }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error)
        setData(json)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    solve()
  }, [matric, result])

  // Block the Ctrl/Cmd+P shortcut while locked. This is a mild deterrent, not
  // real protection — the actual safeguard is the blurred Question 2 content
  // below, which stays blurred even if print is triggered another way.
  useEffect(() => {
    if (!locked) return
    function blockPrint(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', blockPrint)
    return () => window.removeEventListener('keydown', blockPrint)
  }, [locked])

  const q1CodeParams = data
    ? `matric = "${data.params.matric}"\nD = int(matric[4:6])\nS = int(matric[6:9])\nY0 = D + S / 1000\nprint(f"D = {data.params.D}, S = {data.params.S}, Y0 = {data.params.Y0}")`
    : ''

  const q1CodeMethods = `def f1(t, y):\n    return y - t**2 + 1\n\ndef euler(f, y0, t0, tend, h):\n    n = int(round((tend - t0) / h))\n    t, y = t0, y0\n    ts, ys = [t], [y]\n    for _ in range(n):\n        y = y + h * f(t, y)\n        t = t + h\n        ts.append(t); ys.append(y)\n    return np.array(ts), np.array(ys)\n\ndef heun(f, y0, t0, tend, h):\n    n = int(round((tend - t0) / h))\n    t, y = t0, y0\n    ts, ys = [t], [y]\n    for _ in range(n):\n        k1 = f(t, y)\n        y_pred = y + h * k1\n        k2 = f(t + h, y_pred)\n        y = y + (h / 2) * (k1 + k2)\n        t = t + h\n        ts.append(t); ys.append(y)\n    return np.array(ts), np.array(ys)`

  const q1CodeRun = data
    ? `exact1 = lambda t: ${formatFormula(data.q1.exact_formula)}\n\nfor h in (0.2, 0.1):\n    _, y_euler = euler(f1, Y0, 0, 2, h)\n    _, y_heun  = heun(f1, Y0, 0, 2, h)\n    err_euler = abs(exact1(2.0) - y_euler[-1])\n    err_heun  = abs(exact1(2.0) - y_heun[-1])\n    print(f"h={h}:  Euler error={err_euler:.6f}   Heun error={err_heun:.6f}")`
    : ''

  const q1CodePlot = `t_fine = np.linspace(0, 2, 400)\nplt.plot(t_fine, exact1(t_fine), 'k-', linewidth=2, label='Exact')\nplt.plot(t_euler_h01, y_euler_h01, 'o--', markersize=3, label='Euler (h=0.1)')\nplt.plot(t_heun_h01, y_heun_h01, 's--', markersize=3, label='Heun (h=0.1)')\nplt.xlabel('t'); plt.ylabel('y'); plt.legend(); plt.grid(alpha=0.3)\nplt.title('Question 1: dy/dt = y - t^2 + 1')\nplt.show()`

  const q2CodeExact = data
    ? `import sympy as sp\n\nK = D\nt_sym = sp.symbols('t')\ny = sp.Function('y')\n\node2 = sp.Eq(y(t_sym).diff(t_sym), -K*y(t_sym) - t_sym**2 + 1)\nsol2 = sp.dsolve(ode2, y(t_sym), ics={y(0): Y0})\nprint(sol2)\n\n# y(t) = ${formatFormula(data.q2.exact_formula)}`
    : ''

  const q2CodeRun = `f2 = lambda t, y: -K*y - t**2 + 1\nt_h2, y_h2 = heun(f2, Y0, 0, 2, 0.2)\n\nexact2 = sp.lambdify(t_sym, sol2.rhs, 'numpy')\nt_fine2 = np.linspace(0, 2, 400)\nplt.plot(t_fine2, exact2(t_fine2), 'k-', linewidth=2, label='Exact')\nplt.plot(t_h2, y_h2, 'o--', color='tab:red', markersize=4, label='Heun (h=0.2)')\nplt.xlabel('t'); plt.ylabel('y'); plt.legend(); plt.grid(alpha=0.3)\nplt.title(f'Question 2: dy/dt = -Ky - t^2 + 1')\nplt.show()`

  return (
    <div className="app-shell">
      <div className="app-inner">
        {/* Toolbar */}
        <div className="toolbar no-print">
          <div className="toolbar-left">
            <span className="eyebrow">GET 210 · Engineering Mathematics II</span>
            {locked && <span className="preview-badge">Preview</span>}
          </div>
          <div className="toolbar-right">
            {data && locked && (
              <button className="btn-primary" onClick={onUnlock}>
                Unlock Full Access — ₦1,600 →
              </button>
            )}
            {data && !locked && (
              <button className="btn-outline" onClick={() => window.print()}>
                Export PDF
              </button>
            )}
            <button className="btn-ghost-sm" onClick={onReset}>Sign out</button>
          </div>
        </div>

        {loading && (
          <div className="status-msg no-print">Generating your notebook…</div>
        )}
        {error && (
          <div className="alert-error no-print">{error}</div>
        )}
        {data && locked && (
          <div className="notice no-print">
            This is a free preview — Question 1 is fully worked out below. Pay once to unlock
            Question 2 and export a submission-ready PDF.
          </div>
        )}
        {data && !locked && (
          <div className="notice no-print">
            The assessment requires a hard copy printed from an executed Jupyter Notebook — use
            this as a working reference, then transcribe into your own <code>.ipynb</code>.
          </div>
        )}

        {data && (
          <article className="notebook">
            <MarkdownCell className="nb-header">
              <h1>Numerical Solutions to ODEs: Code Assessment</h1>
              <p className="nb-meta">GET 210 — Dr. John Ogbemhe</p>
              <p className="mt-4">
                {fullName && <><strong>Name:</strong> {fullName}<br /></>}
                <strong>Matriculation Number:</strong> {data.params.matric}
              </p>
            </MarkdownCell>

            <MarkdownCell>
              <h2>Parameters</h2>
              <p>D (digits 5–6) = {data.params.D}, S (digits 7–9) = {data.params.S}, so Y₀ = D + S/1000 = {data.params.Y0}.</p>
            </MarkdownCell>
            <CodeCell index={1} code={q1CodeParams} />
            <OutputCell index={1}>
              <div className="stat-grid">
                <StatCard label="Department (D)" value={data.params.D} />
                <StatCard label="Student No. (S)" value={data.params.S} />
                <StatCard label="Y₀ = D + S/1000" value={data.params.Y0} accent />
                <StatCard label="Matric No." value={data.params.matric} />
              </div>
            </OutputCell>

            <MarkdownCell className="mt-10">
              <h2>Question 1 — dy/dt = y − t² + 1</h2>
              <p>Solved on 0 ≤ t ≤ 2 with y(0) = Y₀ = {data.params.Y0}, using Euler's and Heun's methods at h = 0.1 and h = 0.2.</p>
            </MarkdownCell>
            <CodeCell index={2} code={q1CodeMethods} />
            <CodeCell index={3} code={q1CodeRun} />
            <OutputCell index={3}>
              <div className="stat-grid mb-4">
                <StatCard label="Exact y(2)" value={data.q1.exact_final.toFixed(6)} />
                <StatCard label="Euler y(2), h=0.1" value={data.q1.final_values['h0.1'].euler.toFixed(6)} />
                <StatCard label="Heun y(2), h=0.1" value={data.q1.final_values['h0.1'].heun.toFixed(6)} />
              </div>
              <ErrorTable q1={data.q1} />
            </OutputCell>
            <CodeCell index={4} code={q1CodePlot} />
            <OutputCell index={4}>
              <img
                src={`data:image/png;base64,${data.q1.plot}`}
                alt="Question 1 plot"
                className="nb-plot"
              />
            </OutputCell>

            <MarkdownCell className="mt-6">
              <h3>Discussion: Local Truncation Error &amp; Convergence</h3>
              <Q1Discussion result={data} />
            </MarkdownCell>

            <div className={locked ? 'locked-section' : undefined}>
              <div className={locked ? 'locked-content' : undefined}>
                <MarkdownCell className="mt-10">
                  <h2>Question 2 — dy/dt = −{data.q2.K}y − t² + 1</h2>
                  <p>Damped system with K = D = {data.q2.K}, solved with Heun's method at h = 0.2.</p>
                </MarkdownCell>
                <CodeCell index={5} code={q2CodeExact} />
                <OutputCell index={5}>
                  <p className="formula-display">y(t) = {formatFormula(data.q2.exact_formula)}</p>
                </OutputCell>
                <CodeCell index={6} code={q2CodeRun} />
                <OutputCell index={6}>
                  <div className="stat-grid mb-4">
                    <StatCard label="Damping K = D" value={data.q2.K} />
                    <StatCard label="Max abs. error" value={data.q2.max_error.toFixed(6)} />
                    <StatCard label="Final abs. error @ t=2" value={data.q2.final_error.toFixed(6)} />
                  </div>
                  <img
                    src={`data:image/png;base64,${data.q2.plot}`}
                    alt="Question 2 plot"
                    className="nb-plot"
                  />
                </OutputCell>

                <MarkdownCell className="mt-6">
                  <h3>Discussion: Numerical Stability</h3>
                  <Q2Discussion result={data} />
                </MarkdownCell>
              </div>

              {locked && (
                <div className="locked-overlay no-print">
                  <div className="locked-overlay-card">
                    <span className="locked-icon" aria-hidden="true">🔒</span>
                    <h3>Unlock the full notebook</h3>
                    <p>Question 2 — the damped system, its plot, and the full stability discussion — unlocks with a one-time payment.</p>
                    <button className="btn-primary w-full" onClick={onUnlock}>
                      Unlock Full Access — ₦1,600 →
                    </button>
                  </div>
                </div>
              )}
            </div>
          </article>
        )}
      </div>
    </div>
  )
}

// ─── Root router ─────────────────────────────────────────────────────────────

export default function App() {
  // Paystack appends ?reference=xxx and ?trxref=xxx on redirect
  const params = new URLSearchParams(window.location.search)
  const psRef = params.get('payment') === 'success'
    ? (params.get('reference') || params.get('trxref'))
    : null

  const [view, setView] = useState(psRef ? 'post-payment' : 'landing')
  const [reference, setReference] = useState(psRef)
  const [pendingMatric, setPendingMatric] = useState('')
  const [user, setUser] = useState(null) // { matric, name, result?, locked? }

  function handlePromoRedeemed(promoReference) {
    setReference(promoReference)
    setView('post-payment')
  }

  function handlePreviewGenerated({ matric, result }) {
    setPendingMatric(matric)
    setUser({ matric, name: '', result, locked: true })
    setView('notebook')
  }

  function handleFound({ matric, name, result }) {
    setUser({ matric, name, result, locked: false })
    setView('notebook')
  }

  function handleRegistered({ matric, name }) {
    // Clear ?payment=success from URL
    window.history.replaceState({}, '', '/')
    setUser({ matric, name, result: null, locked: false })
    setView('notebook')
  }

  let screen = null

  if (view === 'landing') {
    screen = (
      <LandingPage
        onGetStarted={() => setView('preview')}
      />
    )
  } else if (view === 'preview') {
    screen = (
      <PreviewGate
        onGenerated={handlePreviewGenerated}
        onBack={() => setView('landing')}
      />
    )
  } else if (view === 'payment') {
    screen = <PaymentGate
      onBack={() => setView(pendingMatric ? 'notebook' : 'landing')}
      onAlreadyPaid={handleFound}
      onReturning={() => setView('returning')}
      onPromoRedeemed={handlePromoRedeemed}
    />
  } else if (view === 'post-payment') {
    screen = (
      <PostPayment
        reference={reference}
        initialMatric={pendingMatric}
        onComplete={handleRegistered}
      />
    )
  } else if (view === 'returning') {
    screen = (
      <ReturningUser
        onFound={handleFound}
        onNotFound={() => setView('payment')}
        onBack={() => setView('landing')}
      />
    )
  } else if (view === 'notebook' && user) {
    screen = (
      <NotebookView
        fullName={user.name}
        matric={user.matric}
        result={user.result}
        locked={user.locked}
        onUnlock={() => setView('payment')}
        onReset={() => { setUser(null); setPendingMatric(''); setView('landing') }}
      />
    )
  }

  return (
    <>
      {screen}
      <ContactButton />
    </>
  )
}
