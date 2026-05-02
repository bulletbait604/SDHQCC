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

  if (!userId || !tool || !COOLDOWNS[tool]) {
    return NextResponse.json({ onCooldown: false, secondsRemaining: 0 })
  }

  const col = await getDb()
  const record = await col.findOne({ userId, tool })

  if (!record) return NextResponse.json({ onCooldown: false, secondsRemaining: 0 })

  const elapsed = (Date.now() - record.lastUsed) / 1000
  const cooldownSecs = COOLDOWNS[tool]
  const remaining = Math.ceil(cooldownSecs - elapsed)

  if (remaining <= 0) {
    return NextResponse.json({ onCooldown: false, secondsRemaining: 0 })
  }

  return NextResponse.json({ onCooldown: true, secondsRemaining: remaining })
}

// POST /api/cooldown
// Body: { userId, tool, skipWithAd? }
// Sets or clears cooldown
export async function POST(req: NextRequest) {
  const { userId, tool, skipWithAd } = await req.json()

  if (!userId || !tool || !COOLDOWNS[tool]) {
    return NextResponse.json({ ok: true })
  }

  const col = await getDb()

  if (skipWithAd) {
    // User watched an ad — clear their cooldown
    await col.deleteOne({ userId, tool })
    return NextResponse.json({ ok: true, cleared: true })
  }

  // Set cooldown after use
  await col.updateOne(
    { userId, tool },
    { $set: { userId, tool, lastUsed: Date.now() } },
    { upsert: true }
  )

  return NextResponse.json({ ok: true })
}
