import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { verifySessionJwt, getSessionSecret } from '@/lib/auth/sessionJwt'

export type UserRole = 'free' | 'subscriber' | 'subscriber_lifetime' | 'admin' | 'owner' | 'tester'

export interface VerifiedUser {
  id: string
  username: string
  role: UserRole
  email?: string
  provider: 'kick' | 'credentials'
}

const UNLIMITED_ROLES: UserRole[] = ['subscriber', 'subscriber_lifetime', 'admin', 'owner', 'tester']

/**
 * Extract session token from request
 * Priority: 1) HTTP-Only cookie, 2) Authorization header
 */
function extractSessionToken(req: NextRequest): string | null {
  // Check for session cookie first (most secure)
  const sessionCookie = req.cookies.get('next-auth.session-token')?.value ||
                       req.cookies.get('session')?.value ||
                       req.cookies.get('__Secure-next-auth.session-token')?.value
  
  if (sessionCookie) {
    return sessionCookie
  }
  
  // Fallback to Authorization header
  const authHeader = req.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7)
  }
  
  return null
}

/**
 * Verify signed session JWT (HS256). Unsigned legacy decode removed for security.
 */
async function verifyToken(token: string): Promise<VerifiedUser | null> {
  try {
    const secret = getSessionSecret()
    if (!secret) {
      console.error('[Auth] SESSION_SECRET or JWT_SECRET is not set')
      return null
    }

    const payload = verifySessionJwt(token, secret)
    if (!payload || typeof payload.sub !== 'string' || typeof payload.name !== 'string') {
      return null
    }

    return {
      id: payload.sub,
      username: payload.name.toLowerCase(),
      role: ((payload.role as UserRole) || 'free') as UserRole,
      email: typeof payload.email === 'string' ? payload.email : undefined,
      provider: (payload.provider as VerifiedUser['provider']) || 'kick',
    }
  } catch (error) {
    console.error('[Auth] Token verification failed:', error)
    return null
  }
}

/**
 * Central authentication verification
 * @returns VerifiedUser or throws 401
 */
export async function verifyAuth(req: NextRequest): Promise<VerifiedUser> {
  const token = extractSessionToken(req)
  
  if (!token) {
    throw new AuthError('No authentication token provided', 401)
  }
  
  const user = await verifyToken(token)
  
  if (!user) {
    throw new AuthError('Invalid or expired token', 401)
  }
  
  // Verify user still exists in database (prevents using deleted account tokens)
  const client = await clientPromise
  const db = client.db('sdhq')
  const dbUser = await db.collection('users').findOne({ username: user.username })
  
  if (!dbUser) {
    throw new AuthError('User not found', 401)
  }
  
  // Update role from database (in case role changed since token issued)
  if (dbUser.role && dbUser.role !== user.role) {
    user.role = dbUser.role as UserRole
  }
  
  return user
}

/**
 * Role-based authorization guard
 * Throws 403 if user lacks required role
 */
export function requireRole(
  user: VerifiedUser,
  allowedRoles: UserRole[]
): void {
  if (!allowedRoles.includes(user.role)) {
    throw new AuthError(
      `Access denied. Required roles: ${allowedRoles.join(', ')}`,
      403
    )
  }
}

/**
 * Check if user has unlimited access (any paid tier)
 */
export function hasUnlimitedAccess(user: VerifiedUser): boolean {
  return UNLIMITED_ROLES.includes(user.role)
}

/**
 * Combined auth + optional role check
 * Convenience function for common use case
 */
export async function authenticateAndAuthorize(
  req: NextRequest,
  allowedRoles?: UserRole[]
): Promise<VerifiedUser> {
  const user = await verifyAuth(req)
  
  if (allowedRoles && allowedRoles.length > 0) {
    requireRole(user, allowedRoles)
  }
  
  return user
}

/**
 * Custom authentication error
 */
export class AuthError extends Error {
  constructor(
    message: string,
    public statusCode: number = 401
  ) {
    super(message)
    this.name = 'AuthError'
  }
}

/**
 * Helper to create error response
 */
export function createAuthErrorResponse(error: AuthError | Error): NextResponse {
  const status = error instanceof AuthError ? error.statusCode : 500
  const message = error.message || 'Authentication failed'
  
  return NextResponse.json(
    { error: message },
    { status }
  )
}
