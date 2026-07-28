import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import crypto from 'crypto'
import { spawn, execSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
app.set('trust proxy', 1) // Render sits behind a proxy — needed for accurate req.ip
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
}))
app.use('/api/pay/webhook', express.raw({ type: 'application/json' }))
app.use(express.json())

// ─── Simple in-memory rate limiter ─────────────────────────────────────────
// /api/solve is reachable without payment now (free preview), so it needs a
// basic guard against being hammered for free compute. Per-instance only —
// fine at this scale, no need for a shared store.
const rateLimitHits = new Map()
function rateLimit({ windowMs, max }) {
  return (req, res, next) => {
    const key = req.ip
    const now = Date.now()
    const hits = (rateLimitHits.get(key) ?? []).filter((t) => now - t < windowMs)
    if (hits.length >= max) {
      return res.status(429).json({ error: 'Too many requests. Please try again in a few minutes.' })
    }
    hits.push(now)
    rateLimitHits.set(key, hits)
    next()
  }
}

// Lazy Supabase client — only created on first request, not at import time
let _supabase = null
function db() {
  if (!_supabase) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in backend/.env')
    }
    _supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  }
  return _supabase
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeMatric(m) {
  return String(m).trim().toUpperCase()
}

async function paystackRequest(endpoint, options = {}) {
  const res = await fetch(`https://api.paystack.co${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  })
  return res.json()
}

async function sendBrevoEmail({ to, toName, matricNumber }) {
  await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender: { email: process.env.BREVO_SENDER_EMAIL, name: process.env.BREVO_SENDER_NAME },
      to: [{ email: to, name: toName }],
      subject: 'Payment Confirmed — GET 210 Numerical ODE Solver',
      htmlContent: `<p>Hi ${toName},</p><p>Your payment is confirmed.</p><p>Your access key: <strong>${matricNumber}</strong></p><p>Use this on the "Already paid?" link to get back in.</p>`,
    }),
  })
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const DISCOUNT_NOTIFY_EMAIL = 'yabvil25@gmail.com'

async function sendDiscountRequestEmail({ requesterEmail, amount, reason }) {
  await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender: { email: process.env.BREVO_SENDER_EMAIL, name: process.env.BREVO_SENDER_NAME },
      to: [{ email: DISCOUNT_NOTIFY_EMAIL }],
      subject: 'Discount Request — GET 210 ODE Solver',
      htmlContent: `
        <p>Somebody requested a discount.</p>
        <p><strong>Requested discount:</strong> ${escapeHtml(amount)}</p>
        <p><strong>Requester email:</strong> ${escapeHtml(requesterEmail)}</p>
        ${reason ? `<p><strong>Message:</strong> ${escapeHtml(reason)}</p>` : ''}
      `,
    }),
  })
}

// ─── Payment: Initialise ──────────────────────────────────────────────────────

app.post('/api/pay/init', async (req, res) => {
  const { email: rawEmail } = req.body ?? {}
  if (!rawEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
    return res.status(400).json({ error: 'A valid email address is required.' })
  }
  const email = rawEmail.toLowerCase().trim()

  // Check if this email already has a confirmed payment
  const { data: existingUser } = await db().from('users')
    .select('matric, name, payment_status')
    .eq('email', email)
    .single()

  if (existingUser?.payment_status === 'confirmed') {
    return res.json({ already_paid: true, matric: existingUser.matric, name: existingUser.name })
  }

  const data = await paystackRequest('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify({
      email,
      amount: 160000,
      currency: 'NGN',
      callback_url: `${process.env.FRONTEND_URL}?payment=success`,
      metadata: { email },
    }),
  })

  if (!data.status) {
    return res.status(502).json({ error: 'Could not initialise payment. Please try again.' })
  }

  const { error: pendingErr } = await db().from('users').upsert(
    { email, paystack_ref: data.data.reference, payment_status: 'pending' },
    { onConflict: 'email', ignoreDuplicates: false }
  )
  if (pendingErr) console.error('[pay/init] pending upsert failed:', pendingErr.message)

  res.json({ url: data.data.authorization_url, reference: data.data.reference })
})

// ─── Payment: Webhook ─────────────────────────────────────────────────────────

app.post('/api/pay/webhook', async (req, res) => {
  const sig = req.headers['x-paystack-signature']
  const hash = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
    .update(req.body)
    .digest('hex')

  if (hash !== sig) return res.sendStatus(401)

  const event = JSON.parse(req.body.toString())
  if (event.event !== 'charge.success') return res.sendStatus(200)

  const status = event.data.status === 'success' ? 'confirmed' : 'failed'
  await db().from('users').update({ payment_status: status }).eq('paystack_ref', event.data.reference)

  res.sendStatus(200)
})

// ─── Payment: Verify ──────────────────────────────────────────────────────────

app.post('/api/pay/verify', async (req, res) => {
  const { reference } = req.body ?? {}
  if (!reference) return res.status(400).json({ error: 'Reference required.' })

  const data = await paystackRequest(`/transaction/verify/${reference}`)
  if (!data.status || !data.data || data.data.status !== 'success') {
    await db().from('users').update({ payment_status: 'failed' }).eq('paystack_ref', reference)
    return res.status(402).json({ error: 'Payment not confirmed. Please try again.' })
  }

  // Upsert — handles case where webhook fired before redirect and row already exists,
  // or where pay/init row was never created
  const email = data.data.customer?.email?.toLowerCase().trim() ?? null
  const { error: confirmErr } = await db().from('users').upsert(
    { email, paystack_ref: reference, payment_status: 'confirmed' },
    { onConflict: 'email' }
  )
  if (confirmErr) console.error('[pay/verify] confirmed upsert failed:', confirmErr.message)

  // If this payment was initiated via a promo code, claim it now that
  // payment is actually confirmed — conditional update guards against two
  // concurrent verifies claiming the same code.
  const promoCode = data.data.metadata?.promo_code
  if (promoCode) {
    const { data: promo } = await db().from('promo_codes').select('id, used').eq('code', promoCode).single()
    if (promo && !promo.used) {
      const { error: claimErr } = await db().from('promo_codes')
        .update({ used: true, used_by_email: email, used_at: new Date().toISOString() })
        .eq('id', promo.id)
        .eq('used', false)
      if (claimErr) console.error('[pay/verify] promo code claim failed:', claimErr.message)
    }
  }

  res.json({ ok: true })
})

// ─── User: Register ───────────────────────────────────────────────────────────

app.post('/api/user/register', async (req, res) => {
  const { reference, name, matric } = req.body ?? {}
  if (!reference || !name?.trim() || !matric) {
    return res.status(400).json({ error: 'reference, name, and matric are required.' })
  }

  const norm = normalizeMatric(matric)
  if (!/^\d{9}$/.test(norm)) {
    return res.status(400).json({ error: 'Matriculation number must be exactly 9 digits.' })
  }

  // Re-verify with Paystack directly — don't rely solely on DB state
  const verification = await paystackRequest(`/transaction/verify/${reference}`)
  if (!verification.status || !verification.data || verification.data.status !== 'success') {
    return res.status(402).json({ error: 'Payment not confirmed for this reference.' })
  }
  const email = verification.data.customer?.email?.toLowerCase().trim() ?? null

  // Check matric not already taken by a different reference
  const { data: existing } = await db().from('users').select('paystack_ref').eq('matric', norm).single()
  if (existing && existing.paystack_ref !== reference) {
    return res.status(409).json({ error: 'This matric number is already registered.' })
  }

  // Upsert the full confirmed record — conflict-target on email, not
  // paystack_ref: a retried/abandoned payment attempt with the same email
  // generates a new paystack_ref each time, and since email is also unique,
  // targeting paystack_ref here would collide with that earlier row instead
  // of updating it.
  const { error } = await db().from('users').upsert(
    { email, paystack_ref: reference, payment_status: 'confirmed', matric: norm, name: name.trim() },
    { onConflict: 'email' }
  )
  if (error) {
    console.error('[user/register] upsert failed:', error.message)
    return res.status(500).json({ error: 'Failed to save your details.' })
  }

  res.json({ ok: true, matric: norm, email })
})

// ─── User: Lookup ─────────────────────────────────────────────────────────────

app.post('/api/user/lookup', async (req, res) => {
  const { matric } = req.body ?? {}
  if (!matric) return res.status(400).json({ error: 'Matric number required.' })

  const norm = normalizeMatric(matric)
  const { data: row } = await db().from('users')
    .select('matric, name, payment_status, result')
    .eq('matric', norm)
    .single()

  if (!row || row.payment_status !== 'confirmed') {
    return res.status(404).json({ error: 'No confirmed payment found for this matric number.' })
  }

  res.json({ matric: row.matric, name: row.name, result: row.result ?? null })
})

// ─── Solve ────────────────────────────────────────────────────────────────────

// Each solve spawns a Python process that imports numpy/sympy/matplotlib —
// memory-heavy just to import. Render's instance only has 512MB, so we cap
// how many can run at once regardless of how many different people are
// hitting it (the per-IP rate limiter above doesn't protect against that —
// it only slows down a single IP over time, not total concurrency).
let activeSolves = 0
const MAX_CONCURRENT_SOLVES = 2

app.post('/api/solve', rateLimit({ windowMs: 10 * 60 * 1000, max: 10 }), async (req, res) => {
  const { matric } = req.body ?? {}
  const norm = normalizeMatric(matric ?? '')

  if (!/^\d{9}$/.test(norm)) {
    return res.status(400).json({ error: 'Matriculation number must be exactly 9 digits.' })
  }

  if (activeSolves >= MAX_CONCURRENT_SOLVES) {
    return res.status(503).json({ error: 'Server is busy right now — please try again in a moment.' })
  }
  activeSolves++
  let finished = false
  function done() {
    if (finished) return
    finished = true
    activeSolves--
  }

  const scriptPath = path.join(__dirname, 'compute.py')
  const pythonCmd = process.platform === 'win32' ? 'py' : 'python3'
  const pyModulesPath = path.join(__dirname, 'py_modules')
  console.log(`[solve] spawning ${pythonCmd} with matric=${norm} (active: ${activeSolves})`)
  const py = spawn(pythonCmd, [scriptPath, norm], {
    env: {
      ...process.env,
      PYTHONPATH: [pyModulesPath, process.env.PYTHONPATH].filter(Boolean).join(path.delimiter),
    },
  })

  let stdout = ''
  let stderr = ''
  let responded = false
  py.stdout.on('data', (chunk) => { stdout += chunk })
  py.stderr.on('data', (chunk) => { stderr += chunk })
  py.on('error', (err) => {
    responded = true
    done()
    console.error(`[solve] spawn error:`, err.message)
    res.status(500).json({ error: 'Failed to start computation engine.', details: err.message })
  })

  py.on('close', async (code) => {
    done()
    if (responded) return
    console.log(`[solve] python exited with code ${code}`)
    if (stderr) console.error(`[solve] stderr:`, stderr)
    if (code !== 0) return res.status(500).json({ error: 'Computation failed.', details: stderr || stdout })
    try {
      const result = JSON.parse(stdout)
      if (result.error) return res.status(400).json({ error: result.error })
      await db().from('users').update({ result }).eq('matric', norm)
      res.json(result)
    } catch {
      res.status(500).json({ error: 'Failed to parse computation output.', details: stdout })
    }
  })
})

// ─── Email: Confirmation ──────────────────────────────────────────────────────

app.post('/api/email/confirm', async (req, res) => {
  const { email, name, matric } = req.body ?? {}
  if (!email || !name || !matric) return res.status(400).json({ error: 'email, name, matric required.' })
  try {
    await sendBrevoEmail({ to: email, toName: name, matricNumber: matric })
    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: 'Failed to send confirmation email.' })
  }
})

// ─── Discount request ───────────────────────────────────────────────────────
// Relayed straight to email — never written to the database, so the
// requester's address is never stored anywhere.

app.post('/api/discount/request', async (req, res) => {
  const { email, amount, reason } = req.body ?? {}
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'A valid email address is required.' })
  }
  if (!amount || !String(amount).trim()) {
    return res.status(400).json({ error: 'Let us know how much discount you\'d like.' })
  }

  try {
    await sendDiscountRequestEmail({
      requesterEmail: email.trim(),
      amount: String(amount).trim(),
      reason: reason?.trim(),
    })
    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: 'Failed to send your request. Please try again.' })
  }
})

// ─── Promo codes ──────────────────────────────────────────────────────────────
// One-time codes that unlock a discounted ₦600 price instead of the full
// ₦1,600 — they still go through a real Paystack payment, just tagged with
// the code via metadata. The code is only marked "used" once that payment is
// actually confirmed at /api/pay/verify, not here at init time — so an
// abandoned checkout never burns the code.

const PROMO_AMOUNT = 60000 // ₦600, in kobo

app.post('/api/promo/init', async (req, res) => {
  const { code, email: rawEmail } = req.body ?? {}
  if (!code || !String(code).trim()) {
    return res.status(400).json({ error: 'Promo code required.' })
  }
  if (!rawEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
    return res.status(400).json({ error: 'A valid email address is required.' })
  }

  const normCode = String(code).trim().toUpperCase()
  const email = rawEmail.toLowerCase().trim()

  const { data: promo } = await db().from('promo_codes')
    .select('id, used')
    .eq('code', normCode)
    .single()

  if (!promo) return res.status(404).json({ error: 'Invalid promo code.' })
  if (promo.used) return res.status(409).json({ error: 'This promo code has already been used.' })

  // Check if this email already has a confirmed payment
  const { data: existingUser } = await db().from('users')
    .select('matric, name, payment_status')
    .eq('email', email)
    .single()

  if (existingUser?.payment_status === 'confirmed') {
    return res.json({ already_paid: true, matric: existingUser.matric, name: existingUser.name })
  }

  const data = await paystackRequest('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify({
      email,
      amount: PROMO_AMOUNT,
      currency: 'NGN',
      callback_url: `${process.env.FRONTEND_URL}?payment=success`,
      metadata: { email, promo_code: normCode },
    }),
  })

  if (!data.status) {
    return res.status(502).json({ error: 'Could not initialise payment. Please try again.' })
  }

  const { error: pendingErr } = await db().from('users').upsert(
    { email, paystack_ref: data.data.reference, payment_status: 'pending' },
    { onConflict: 'email', ignoreDuplicates: false }
  )
  if (pendingErr) console.error('[promo/init] pending upsert failed:', pendingErr.message)

  res.json({ url: data.data.authorization_url, reference: data.data.reference })
})

app.get('/api/health', (_req, res) => {
  let pyVersion = 'not found'
  try { pyVersion = execSync('python3 --version 2>&1').toString().trim() } catch (e) { pyVersion = e.message }
  res.json({ status: 'ok', python: pyVersion })
})

const PORT = process.env.PORT || 5000
app.listen(PORT, () => console.log(`Backend listening on http://localhost:${PORT}`))
