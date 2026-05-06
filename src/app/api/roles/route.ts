import type { Db } from 'mongodb';
import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { verifyAuth } from '@/lib/auth/verifyAuth';

function isStaffRole(role: unknown): boolean {
  return role === 'admin' || role === 'owner';
}

/** Staff may list everyone’s coin balance; matches JWT or Mongo `users.role` if token lags. */
async function requesterCanViewAllUserCoins(req: NextRequest, db: Db): Promise<boolean> {
  try {
    const u = await verifyAuth(req);
    if (isStaffRole(u.role)) return true;
    const row = await db.collection('users').findOne({ username: u.username });
    return isStaffRole(row?.role);
  } catch {
    return false;
  }
}

const ROLE_HIERARCHY = {
  free: 1,
  subscriber: 2,
  subscriber_lifetime: 3,
  editor: 4,
  admin: 5,
  owner: 6
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

    // Owner downgrade to free: clear PayPal-derived membership rows so UI /api/me + role logic stay aligned
    if (role === 'free') {
      await db.collection('subscribers').deleteOne({ username: normalizedUsername })
      await db.collection('lifetimeMembers').deleteOne({ username: normalizedUsername })
    }

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
      const normalized = username.toLowerCase();
      const user = await db.collection('users').findOne({ username: normalized });
      if (!user) {
        return NextResponse.json({ user: null });
      }

      let coins: number | undefined;
      try {
        const sessionUser = await verifyAuth(request);
        let isStaff = isStaffRole(sessionUser.role);
        if (!isStaff) {
          const actorRow = await db.collection('users').findOne({ username: sessionUser.username });
          isStaff = isStaffRole(actorRow?.role);
        }
        const isSelf = sessionUser.username === normalized;
        if (isStaff || isSelf) {
          const row = await db.collection('coinBalances').findOne({ userId: normalized });
          coins = typeof row?.coins === 'number' ? row.coins : 0;
        }
      } catch {
        /* unauthenticated: role lookup only */
      }

      return NextResponse.json({
        user: {
          role: user.role,
          username: user.username,
          ...(coins !== undefined ? { coins } : {}),
        },
      });
    }

    // Get all users with roles
    const users = await db.collection('users').find({}).toArray();
    const includeCoins = await requesterCanViewAllUserCoins(request, db);

    let coinsByUser = new Map<string, number>();
    if (includeCoins) {
      const usernames = users
        .map((u) => String(u.username ?? '').toLowerCase())
        .filter((s) => s.length > 0);
      if (usernames.length > 0) {
        const balanceRows = await db
          .collection('coinBalances')
          .find({ userId: { $in: usernames } })
          .project({ userId: 1, coins: 1 })
          .toArray();
        for (const row of balanceRows) {
          const id = String(row.userId ?? '').toLowerCase();
          if (id) {
            coinsByUser.set(id, typeof row.coins === 'number' ? row.coins : 0);
          }
        }
      }
    }

    return NextResponse.json({
      users: users.map((u) => {
        const un = String(u.username ?? '').toLowerCase();
        const base = {
          id: u._id.toString(),
          username: u.username,
          role: u.role,
          updatedAt: u.updatedAt,
        };
        if (includeCoins) {
          return { ...base, coins: coinsByUser.get(un) ?? 0 };
        }
        return base;
      }),
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
