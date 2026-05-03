import clientPromise from '@/lib/mongodb'

/** Updates `users.role` (used by /api/roles and JWT refresh paths). */
export async function upsertUserRole(username: string, role: string): Promise<void> {
  const client = await clientPromise
  const db = client.db('sdhq')
  const normalized = username.toLowerCase()
  await db.collection('users').updateOne(
    { username: normalized },
    {
      $set: {
        username: normalized,
        role,
        updatedAt: new Date().toISOString(),
      },
    },
    { upsert: true }
  )
}

/**
 * After an ACTIVE subscription is confirmed (webhook or check-payment), align MongoDB:
 * - `users.role` → subscriber (role poll + admin tooling)
 * - `subscribers` → present (`/api/me` subscription.isVerified)
 */
export async function fulfillSubscriberMembership(username: string): Promise<void> {
  const client = await clientPromise
  const db = client.db('sdhq')
  const normalized = username.toLowerCase()
  const now = new Date().toISOString()
  await Promise.all([
    db.collection('users').updateOne(
      { username: normalized },
      { $set: { username: normalized, role: 'subscriber', updatedAt: now } },
      { upsert: true }
    ),
    db.collection('subscribers').updateOne(
      { username: normalized },
      { $set: { username: normalized, addedAt: now } },
      { upsert: true }
    ),
  ])
}

/**
 * Monthly subscription ended (cancel / suspend / expire). Removes `subscribers` row.
 * Does not downgrade role if user has lifetime (still subscriber_lifetime in `users`).
 */
export async function revokeMonthlySubscriberBenefits(username: string): Promise<void> {
  const client = await clientPromise
  const db = client.db('sdhq')
  const normalized = username.toLowerCase()
  await db.collection('subscribers').deleteOne({ username: normalized })

  const [life, user] = await Promise.all([
    db.collection('lifetimeMembers').findOne({ username: normalized }),
    db.collection('users').findOne({ username: normalized }),
  ])
  if (life || user?.role === 'subscriber_lifetime') {
    return
  }

  const now = new Date().toISOString()
  await db.collection('users').updateOne(
    { username: normalized },
    { $set: { username: normalized, role: 'free', updatedAt: now } },
    { upsert: true }
  )
}
