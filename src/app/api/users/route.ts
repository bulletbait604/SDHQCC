import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db('sdhq-creator-corner');
    
    const subscribers = await db.collection('subscribers').find({}).toArray();
    const admins = await db.collection('admins').find({}).toArray();
    const lifetimeMembers = await db.collection('lifetimeMembers').find({}).toArray();
    
    return NextResponse.json({
      subscribers: subscribers.map(s => ({ id: s._id.toString(), username: s.username, addedAt: s.addedAt })),
      admins: admins.map(a => ({ id: a._id.toString(), username: a.username, addedAt: a.addedAt })),
      lifetimeMembers: lifetimeMembers.map(l => ({ id: l._id.toString(), username: l.username, addedAt: l.addedAt }))
    });
  } catch (error) {
    console.error('Error fetching user lists:', error);
    return NextResponse.json({ error: 'Failed to fetch user lists' }, { status: 500 });
  }
}
