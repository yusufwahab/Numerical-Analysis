import { useState } from 'react'
import AuthShell from './AuthShell'
import { apiFetch } from '../lib/api'

export default function ReturningUser({ onFound, onNotFound, onBack }) {
  const [matric, setMatric] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLookup(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await apiFetch('/api/user/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matric }),
      })
      const data = await res.json()
      if (res.status === 404) {
        onNotFound()
        return
      }
      if (!res.ok) throw new Error(data.error)
      onFound({ matric: data.matric, name: data.name, result: data.result })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell eyebrow="Returning user">
      <button className="back-link" onClick={onBack}>← Back</button>
      <h2 className="gate-title">Access your work</h2>
      <p className="gate-sub">Enter the matric number you registered with.</p>
      <form onSubmit={handleLookup} className="gate-form">
        <label htmlFor="ret-matric" className="field-label">Matriculation number</label>
        <input
          id="ret-matric"
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
          {loading ? 'Looking up…' : 'Access →'}
        </button>
      </form>
    </AuthShell>
  )
}
