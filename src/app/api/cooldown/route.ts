import { NextRequest, NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'

const client = new MongoClient(process.env.MONGODB_URI!)
let connected = false

async function getDb() {
  if (!connected) { await client.connect(); connected = true }
  return client.db('sdhq').collection('cooldowns')
}

const COOLDOWNS: Record<string, number> = {
  thumbnail: 60,        // 60 seconds
  'clip-analyzer': 3600 // 60 minutes
}

// GET /api/cooldown?userId=xxx&tool=thumbnail
// Returns { onCooldown: bool, secondsRemaining: number }
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')
  const tool = searchParams.get('tool')
  console.log('[API Cooldown] GET received:', { userId, tool })

  if (!userId || !tool || !COOLDOWNS[tool]) {
    console.log('[API Cooldown] Invalid params, returning no cooldown')
    return NextResponse.json({ onCooldown: false, secondsRemaining: 0 })
  }

  const col = await getDb()
  const record = await col.findOne({ userId, tool })
  console.log('[API Cooldown] Record found:', record)

  if (!record) {
    console.log('[API Cooldown] No record found for', userId, tool)
    return NextResponse.json({ onCooldown: false, secondsRemaining: 0 })
  }

  const elapsed = (Date.now() - record.lastUsed) / 1000
  const cooldownSecs = COOLDOWNS[tool]
  const remaining = Math.ceil(cooldownSecs - elapsed)
  console.log('[API Cooldown] Calculation:', { elapsed, cooldownSecs, remaining, now: Date.now(), lastUsed: record.lastUsed })

  if (remaining <= 0) {
    return NextResponse.json({ onCooldown: false, secondsRemaining: 0 })
  }

  return NextResponse.json({ onCooldown: true, secondsRemaining: remaining })
}

// POST /api/cooldown
// Body: { userId, tool, skipWithAd? }
// Sets or clears cooldown
export async function POST(req: NextRequest) {
  const body = await req.json()
  console.log('[API Cooldown] POST received:', body)
  const { userId, tool, skipWithAd } = body

  if (!userId || !tool || !COOLDOWNS[tool]) {
    console.log('[API Cooldown] Invalid params:', { userId, tool })
    return NextResponse.json({ ok: true })
  }

  const col = await getDb()
  console.log('[API Cooldown] DB connected')

  if (skipWithAd) {
    // User watched an ad — clear their cooldown
    await col.deleteOne({ userId, tool })
    console.log('[API Cooldown] Cooldown cleared for', userId, tool)
    return NextResponse.json({ ok: true, cleared: true })
  }

  // Set cooldown after use
  const now = Date.now()
  console.log('[API Cooldown] Setting cooldown:', { userId, tool, lastUsed: now })
  await col.updateOne(
    { userId, tool },
    { $set: { userId, tool, lastUsed: now } },
    { upsert: true }
  )
  console.log('[API Cooldown] Cooldown set successfully')

  return NextResponse.json({ ok: true, lastUsed: now })
}
