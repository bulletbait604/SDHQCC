import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export async function POST(request: NextRequest) {
  try {
    const client = await clientPromise;
    const db = client.db('sdhq');
    const { username, action } = await request.json();

    console.log('Lifetime API received:', { username, action, database: 'sdhq' })

    if (action === 'clear') {
      await db.collection('lifetimeMembers').deleteMany({});
      return NextResponse.json({ message: 'Lifetime members cleared successfully' });
    }

    if (!username || !action) {
      return NextResponse.json({ message: 'Username and action are required' }, { status: 400 });
    }

    if (action === 'add') {
      const result = await db.collection('lifetimeMembers').updateOne(
        { username: username.toLowerCase() },
        { $set: { username: username.toLowerCase(), addedAt: new Date().toISOString() } },
        { upsert: true }
      );
      console.log('Lifetime add result:', result)
      return NextResponse.json({ message: 'Lifetime member added successfully' });
    } else if (action === 'remove') {
      const result = await db.collection('lifetimeMembers').deleteOne({ username: username.toLowerCase() });
      console.log('Lifetime remove result:', result)
      return NextResponse.json({ message: 'Lifetime member removed successfully' });
    } else {
      return NextResponse.json({ message: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Failed to update lifetime members:', error);
    return NextResponse.json({ message: 'Failed to update lifetime members', error: String(error) }, { status: 500 });
  }
}
