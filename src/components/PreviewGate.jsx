import { useState } from 'react'
import AuthShell from './AuthShell'
import { apiFetch } from '../lib/api'

export default function PreviewGate({ onGenerated, onBack }) {
  const [matric, setMatric] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await apiFetch('/api/solve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matric }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onGenerated({ matric, result: data })
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <AuthShell eyebrow="Free preview">
      <button className="back-link" onClick={onBack}>← Back</button>
      <h2 className="gate-title">See your notebook first</h2>
      <p className="gate-sub">
        Enter your matriculation number to generate a free preview — no payment needed yet.
        Question 1 is fully visible; Question 2 unlocks once you pay.
      </p>
      <form onSubmit={handleSubmit} className="gate-form">
        <label htmlFor="preview-matric" className="field-label">Matriculation number</label>
        <input
          id="preview-matric"
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
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Generating…' : 'Generate preview →'}
        </button>
      </form>
    </AuthShell>
  )
}
