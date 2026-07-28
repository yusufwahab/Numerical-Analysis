import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

// Excludes 0/O/1/I to avoid visual ambiguity when codes are read aloud or typed.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function randomCode(length = 6) {
  let out = ''
  for (let i = 0; i < length; i++) {
    out += ALPHABET[crypto.randomInt(ALPHABET.length)]
  }
  return `ODE-${out}`
}

async function main() {
  const count = Number(process.argv[2] ?? 20)

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in backend/.env')
    process.exit(1)
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

  const codes = new Set()
  while (codes.size < count) codes.add(randomCode())
  const rows = [...codes].map((code) => ({ code }))

  const { error } = await supabase.from('promo_codes').insert(rows)
  if (error) {
    console.error('Failed to insert promo codes:', error.message)
    process.exit(1)
  }

  console.log(`Generated ${count} one-time promo codes:\n`)
  rows.forEach((r) => console.log(r.code))
}

main()
