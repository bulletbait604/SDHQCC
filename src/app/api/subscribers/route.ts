import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export async function POST(request: NextRequest) {
  try {
    const client = await clientPromise
    const db = client.db('sdhq-creator-corner')
    const { username, action } = await request.json()

    if (action === 'clear') {
      await db.collection('subscribers').deleteMany({})
      return NextResponse.json({ message: 'Subscribers cleared successfully' })
    }

    if (!username || !action) {
      return NextResponse.json({ message: 'Username and action are required' }, { status: 400 })
    }

    if (action === 'add') {
      await db.collection('subscribers').updateOne(
        { username: username.toLowerCase() },
        { $set: { username: username.toLowerCase(), addedAt: new Date().toISOString() } },
        { upsert: true }
      )
      return NextResponse.json({ message: 'Subscriber added successfully' })
    } else if (action === 'remove') {
      await db.collection('subscribers').deleteOne({ username: username.toLowerCase() })
      return NextResponse.json({ message: 'Subscriber removed successfully' })
    } else {
      return NextResponse.json({ message: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Failed to update subscribers:', error)
    return NextResponse.json({ message: 'Failed to update subscribers' }, { status: 500 })
  }
}
