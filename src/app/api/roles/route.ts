import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

const ROLE_HIERARCHY = {
  free: 1,
  subscriber: 2,
  subscriber_lifetime: 3,
  admin: 4,
  owner: 5
} as const;

type Role = keyof typeof ROLE_HIERARCHY;

export async function POST(request: NextRequest) {
  try {
    const client = await clientPromise;
    const db = client.db('sdhq');

    const { username, role, currentAdminRole } = await request.json();

    if (!username || !role) {
      return NextResponse.json({ message: 'Username and role are required' }, { status: 400 });
    }

    // Validate role
    if (!ROLE_HIERARCHY[role as Role]) {
      return NextResponse.json({ message: 'Invalid role' }, { status: 400 });
    }

    // Only owner can assign owner role
    if (role === 'owner' && currentAdminRole !== 'owner') {
      return NextResponse.json({ message: 'Only owner can assign owner role' }, { status: 403 });
    }

    // Admin cannot promote to owner
    if (role === 'owner' && currentAdminRole === 'admin') {
      return NextResponse.json({ message: 'Admin cannot assign owner role' }, { status: 403 });
    }

    const normalizedUsername = username.toLowerCase();

    // Update or create user with role
    const result = await db.collection('users').updateOne(
      { username: normalizedUsername },
      {
        $set: {
          username: normalizedUsername,
          role,
          updatedAt: new Date().toISOString()
        }
      },
      { upsert: true }
    );

    // Verify the update
    const updatedUser = await db.collection('users').findOne({ username: normalizedUsername });

    return NextResponse.json({
      message: `User role updated to ${role}`,
      role,
      verified: updatedUser
    });
  } catch (error) {
    console.error('Failed to update user role:', error);
    return NextResponse.json({ message: 'Failed to update user role', error: String(error) }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const client = await clientPromise;
    const db = client.db('sdhq');

    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');

    if (username) {
      const user = await db.collection('users').findOne({ username: username.toLowerCase() });
      return NextResponse.json({ user: user ? { role: user.role, username: user.username } : null });
    }

    // Get all users with roles
    const users = await db.collection('users').find({}).toArray();
    return NextResponse.json({
      users: users.map(u => ({
        id: u._id.toString(),
        username: u.username,
        role: u.role,
        updatedAt: u.updatedAt
      }))
    });
  } catch (error) {
    console.error('Error fetching user roles:', error);
    return NextResponse.json({ error: 'Failed to fetch user roles', details: String(error) }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const client = await clientPromise;
    const db = client.db('sdhq');
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');

    if (!username) {
      return NextResponse.json({ message: 'Username is required' }, { status: 400 });
    }

    const normalizedUsername = username.toLowerCase();
    const result = await db.collection('users').deleteOne({ username: normalizedUsername });

    if (result.deletedCount === 0) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Failed to delete user:', error);
    return NextResponse.json({ message: 'Failed to delete user', error: String(error) }, { status: 500 });
  }
}
