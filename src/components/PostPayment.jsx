import { useState, useEffect } from 'react'

export default function PostPayment({ reference, onComplete }) {
  const [step, setStep] = useState('verifying') // verifying | form | error
  const [name, setName] = useState('')
  const [matric, setMatric] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function verify() {
      try {
        const res = await fetch('/api/pay/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reference }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        setStep('form')
      } catch (err) {
        setError(err.message)
        setStep('error')
      }
    }
    verify()
  }, [reference])

  async function handleRegister(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/user/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference, name, matric }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      // Send confirmation email using the email already on the payment record
      if (data.email) {
        fetch('/api/email/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: data.email, name, matric: data.matric }),
        })
      }

      onComplete({ matric: data.matric, name })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (step === 'verifying') {
    return (
      <div className="gate-wrap">
        <div className="gate-card">
          <p className="gate-sub">Confirming your payment…</p>
        </div>
      </div>
    )
  }

  if (step === 'error') {
    return (
      <div className="gate-wrap">
        <div className="gate-card">
          <h2 className="gate-title">Payment not confirmed</h2>
          <p className="form-error">{error}</p>
          <button className="btn-primary mt-4" onClick={() => window.location.replace('/')}>
            Try again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="gate-wrap">
      <div className="gate-card">
        <h2 className="gate-title">Almost there</h2>
        <p className="gate-sub">Payment confirmed. Enter your details to generate your notebook.</p>
        <form onSubmit={handleRegister} className="gate-form">
          <label htmlFor="reg-name" className="field-label">Full name</label>
          <input
            id="reg-name"
            type="text"
            required
            placeholder="e.g. Jane A. Okafor"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="field-input"
          />

          <label htmlFor="reg-matric" className="field-label mt-3">Matriculation number</label>
          <input
            id="reg-matric"
            type="text"
            inputMode="numeric"
            required
            maxLength={9}
            placeholder="e.g. 240403107"
            value={matric}
            onChange={(e) => setMatric(e.target.value.replace(/\D/g, '').slice(0, 9))}
            className="field-input font-mono tracking-widest"
          />

          {error && <p className="form-error">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
            {loading ? 'Saving…' : 'Continue →'}
          </button>
        </form>
      </div>
    </div>
  )
}
