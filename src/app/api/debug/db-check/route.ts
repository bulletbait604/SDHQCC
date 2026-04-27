import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db('sdhq-creator-corner');
    
    // List all collections
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map((c: any) => c.name);
    
    // Get counts for each collection
    const counts: Record<string, number> = {};
    for (const name of collectionNames) {
      counts[name] = await db.collection(name).countDocuments();
    }
    
    // Get sample data from each collection
    const samples: Record<string, any[]> = {};
    for (const name of collectionNames) {
      samples[name] = await db.collection(name).find({}).limit(3).toArray();
    }
    
    return NextResponse.json({
      database: 'sdhq-creator-corner',
      collections: collectionNames,
      counts,
      samples
    });
  } catch (error: any) {
    console.error('Error checking database:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
