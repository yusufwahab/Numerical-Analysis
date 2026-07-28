import { useState } from 'react'
import AuthShell from './AuthShell'
import { apiFetch } from '../lib/api'

export default function PaymentGate({ onBack, onAlreadyPaid, onReturning }) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [showDiscount, setShowDiscount] = useState(false)
  const [discountAmount, setDiscountAmount] = useState('')
  const [discountEmail, setDiscountEmail] = useState('')
  const [discountReason, setDiscountReason] = useState('')
  const [discountLoading, setDiscountLoading] = useState(false)
  const [discountError, setDiscountError] = useState('')
  const [discountSent, setDiscountSent] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await apiFetch('/api/pay/init', {
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

  async function handleDiscountSubmit(e) {
    e.preventDefault()
    setDiscountError('')
    setDiscountLoading(true)
    try {
      const res = await apiFetch('/api/discount/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: discountEmail, amount: discountAmount, reason: discountReason }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setDiscountSent(true)
    } catch (err) {
      setDiscountError(err.message)
    } finally {
      setDiscountLoading(false)
    }
  }

  return (
    <AuthShell eyebrow="Step 1 of 3">
      <div className="gate-top-row">
        <button className="back-link" onClick={onBack}>← Back</button>
        <button className="back-link" onClick={onReturning}>Already paid? →</button>
      </div>
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

      {!showDiscount && !discountSent && (
        <button type="button" className="btn-ghost-sm discount-toggle" onClick={() => setShowDiscount(true)}>
          Request a discount
        </button>
      )}

      {showDiscount && !discountSent && (
        <form onSubmit={handleDiscountSubmit} className="gate-form discount-form">
          <label htmlFor="discount-amount" className="field-label mt-3">How much discount would you like?</label>
          <input
            id="discount-amount"
            type="text"
            required
            placeholder="e.g. ₦500 or 20%"
            value={discountAmount}
            onChange={(e) => setDiscountAmount(e.target.value)}
            className="field-input"
          />

          <label htmlFor="discount-email" className="field-label mt-3">Your email</label>
          <input
            id="discount-email"
            type="email"
            required
            placeholder="you@example.com"
            value={discountEmail}
            onChange={(e) => setDiscountEmail(e.target.value)}
            className="field-input"
          />
          <p className="field-hint">
            We don't store your email — it's used only to reach you about this request.
          </p>

          <label htmlFor="discount-reason" className="field-label mt-3">Anything we should know? (optional)</label>
          <textarea
            id="discount-reason"
            rows={3}
            placeholder="e.g. I'm a student on a tight budget…"
            value={discountReason}
            onChange={(e) => setDiscountReason(e.target.value)}
            className="field-input"
          />

          {discountError && <p className="form-error">{discountError}</p>}
          <button type="submit" disabled={discountLoading} className="btn-outline w-full mt-2">
            {discountLoading ? 'Sending…' : 'Send request'}
          </button>
        </form>
      )}

      {discountSent && (
        <p className="field-hint discount-sent">
          Request sent — we'll be in touch at {discountEmail}.
        </p>
      )}
    </AuthShell>
  )
}
