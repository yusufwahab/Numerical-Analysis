import { useState } from 'react'
import AuthShell from './AuthShell'
import { apiFetch } from '../lib/api'

export default function PaymentGate({ onBack, onAlreadyPaid, onReturning, onPromoRedeemed }) {
  const [mode, setMode] = useState('pay') // 'pay' | 'promo' | 'discount'

  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [discountAmount, setDiscountAmount] = useState('')
  const [discountEmail, setDiscountEmail] = useState('')
  const [discountReason, setDiscountReason] = useState('')
  const [discountLoading, setDiscountLoading] = useState(false)
  const [discountError, setDiscountError] = useState('')
  const [discountSent, setDiscountSent] = useState(false)

  const [promoCode, setPromoCode] = useState('')
  const [promoEmail, setPromoEmail] = useState('')
  const [promoLoading, setPromoLoading] = useState(false)
  const [promoError, setPromoError] = useState('')

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

  async function handlePromoSubmit(e) {
    e.preventDefault()
    setPromoError('')
    setPromoLoading(true)
    try {
      const res = await apiFetch('/api/promo/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: promoCode, email: promoEmail }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onPromoRedeemed(data.reference)
    } catch (err) {
      setPromoError(err.message)
      setPromoLoading(false)
    }
  }

  // ─── Promo code — its own screen, no payment form in sight ────────────────
  if (mode === 'promo') {
    return (
      <AuthShell eyebrow="Step 1 of 3">
        <div className="gate-top-row">
          <button className="back-link" onClick={() => setMode('pay')}>← Back</button>
          <button className="back-link" onClick={onReturning}>Already paid? →</button>
        </div>
        <h2 className="gate-title">Redeem promo code</h2>
        <p className="gate-sub">
          Have a one-time code? Enter it below with your email to unlock full access — no payment needed.
        </p>
        <form onSubmit={handlePromoSubmit} className="gate-form">
          <label htmlFor="promo-code" className="field-label">Promo code</label>
          <input
            id="promo-code"
            type="text"
            required
            placeholder="e.g. ODE-7X2K9M"
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
            className="field-input font-mono tracking-widest"
          />

          <label htmlFor="promo-email" className="field-label mt-3">Your email</label>
          <input
            id="promo-email"
            type="email"
            required
            placeholder="you@example.com"
            value={promoEmail}
            onChange={(e) => setPromoEmail(e.target.value)}
            className="field-input"
          />

          {promoError && <p className="form-error">{promoError}</p>}
          <button type="submit" disabled={promoLoading} className="btn-primary w-full mt-2">
            {promoLoading ? 'Checking…' : 'Redeem code →'}
          </button>
        </form>
      </AuthShell>
    )
  }

  // ─── Discount request — its own screen, no payment form in sight ──────────
  if (mode === 'discount') {
    return (
      <AuthShell eyebrow="Step 1 of 3">
        <div className="gate-top-row">
          <button className="back-link" onClick={() => setMode('pay')}>← Back</button>
          <button className="back-link" onClick={onReturning}>Already paid? →</button>
        </div>
        <h2 className="gate-title">Request a discount</h2>
        <p className="gate-sub">
          Tell us how much you'd like off, and we'll be in touch.
        </p>

        {discountSent ? (
          <p className="field-hint discount-sent">
            Request sent — we'll be in touch at {discountEmail}.
          </p>
        ) : (
          <form onSubmit={handleDiscountSubmit} className="gate-form">
            <label htmlFor="discount-amount" className="field-label">How much discount would you like?</label>
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
      </AuthShell>
    )
  }

  // ─── Pay — the default screen ──────────────────────────────────────────────
  return (
    <AuthShell eyebrow="Step 1 of 3">
      <div className="gate-top-row">
        <button className="back-link" onClick={onBack}>← Back</button>
        <button className="back-link" onClick={onReturning}>Already paid? →</button>
      </div>
      <h2 className="gate-title">One-time access</h2>
      <p className="gate-sub">
        Enter your email below — we'll check whether you've already paid. If you have, you'll go
        straight through to your notebook, no need to pay twice. If not, you'll be taken to a
        secure checkout to complete the one-time ₦1,600 payment.
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
        {error && <p className="form-error">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Checking…' : 'Continue →'}
        </button>
      </form>

      <div className="gate-secondary-row">
        <button type="button" className="btn-ghost-sm" onClick={() => setMode('promo')}>
          Have a promo code?
        </button>
        <button type="button" className="btn-ghost-sm" onClick={() => setMode('discount')}>
          Request a discount
        </button>
      </div>
    </AuthShell>
  )
}
