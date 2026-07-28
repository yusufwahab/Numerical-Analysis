import { useState } from 'react'

export default function PaymentGate({ onBack, onAlreadyPaid }) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/pay/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      if (data.already_paid) {
        // Email already has a confirmed payment — skip Paystack entirely
        onAlreadyPaid({ matric: data.matric, name: data.name })
        return
      }

      window.location.href = data.url
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="gate-wrap">
      <div className="gate-card">
        <button className="back-link" onClick={onBack}>← Back</button>
        <h2 className="gate-title">One-time access</h2>
        <p className="gate-sub">
          Pay ₦1,500 once. Your work is saved — come back any time with your email or matric number.
        </p>
        <form onSubmit={handleSubmit} className="gate-form">
          <label htmlFor="email" className="field-label">Email address</label>
          <input
            id="email"
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field-input"
          />
          <p className="field-hint">Already paid? Enter the same email to access your work.</p>
          {error && <p className="form-error">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Checking…' : 'Continue →'}
          </button>
        </form>
      </div>
    </div>
  )
}
