import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export async function POST(request: NextRequest) {
  try {
    const { username, action } = await request.json();
    
    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('sdhq-creator-corner');
    
    if (action === 'add') {
      const existing = await db.collection('subscribers').findOne({ username: username.toLowerCase() });
      if (existing) {
        return NextResponse.json({ error: 'User already in subscribers list' }, { status: 400 });
      }
      
      await db.collection('subscribers').insertOne({
        username: username.toLowerCase(),
        addedAt: new Date().toISOString()
      });
      
      return NextResponse.json({ success: true });
    } else if (action === 'remove') {
      await db.collection('subscribers').deleteOne({ username: username.toLowerCase() });
      return NextResponse.json({ success: true });
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error managing subscribers:', error);
    return NextResponse.json({ error: 'Failed to manage subscribers' }, { status: 500 });
  }
}
