# Technical Specification: Server-Side Auth Hardening
## Stream Dreams Creator Corner Backend Refactoring

---

## 1. EXECUTIVE SUMMARY

**Current State:** API routes trust client-sent `userId`, `role`, and `username` values in request bodies, creating authentication bypass vulnerabilities.

**Target State:** All sensitive operations derive identity and authorization exclusively from server-verified JWT tokens or HTTP-Only session cookies.

**Scope:** 15+ API routes handling tokens, payments, admin operations, and Gemini API key access.

---

## 2. CORE ARCHITECTURAL REQUIREMENTS

### 2.1 Zero Client-Side Trust Principle

| CURRENT (VULNERABLE) | TARGET (SECURE) |
|---------------------|-----------------|
| `const { userId, role } = req.body` | `const user = await verifyAuth(req)` |
| `if (role === 'admin')` | `if (req.user.role === 'admin')` |
| Client sends `newBalance: 999` | Server queries DB for actual balance |
| Client sends `role: 'subscriber'` | Server verifies JWT claims |

### 2.2 Authentication Methods (In Priority Order)

1. **HTTP-Only Session Cookie** (Primary)
   - Cookie name: `session` or `next-auth.session-token`
   - Contains encrypted JWT with user claims
   - Automatically sent with every request

2. **Authorization Header** (Secondary/API Access)
   - Format: `Bearer <jwt_token>`
   - Used for API key routes and external integrations

3. **Fallback: Kick OAuth Token** (Tertiary)
   - Existing OAuth flow for Kick authentication

---

## 3. IMPLEMENTATION TASKS

### TASK 1: Create Centralized Auth Middleware

**File:** `src/lib/auth/verifyAuth.ts`

```typescript
interface VerifiedUser {
  id: string;
  username: string;
  role: 'free' | 'subscriber' | 'subscriber_lifetime' | 'admin' | 'owner' | 'tester';
  email?: string;
  provider: 'kick' | 'credentials';
}

interface AuthRequest extends NextRequest {
  user?: VerifiedUser;
}

/**
 * Central authentication verification middleware
 * Extracts and validates JWT from:
 * 1. HTTP-Only session cookie (primary)
 * 2. Authorization header (secondary)
 * 3. Next-Auth session (tertiary)
 */
export async function verifyAuth(req: NextRequest): Promise<VerifiedUser>;

/**
 * Role-based authorization guard
 * Throws 403 if user lacks required role
 */
export function requireRole(
  req: AuthRequest, 
  allowedRoles: VerifiedUser['role'][]
): Promise<void>;

/**
 * Combined auth + role verification
 */
export async function authenticateAndAuthorize(
  req: NextRequest,
  allowedRoles?: VerifiedUser['role'][]
): Promise<VerifiedUser>;
```

**Acceptance Criteria:**
- [ ] Rejects requests with no valid session (401)
- [ ] Extracts user from JWT claims, not request body
- [ ] Attaches `user` object to request for downstream use
- [ ] Supports both cookie-based and header-based auth
- [ ] Logs authentication failures for security monitoring

---

### TASK 2: Refactor Token API Routes

#### 2.2.1 Token Balance Route
**File:** `src/app/api/tokens/balance/route.ts`

```typescript
// BEFORE (VULNERABLE):
const { searchParams } = new URL(req.url);
const userId = searchParams.get('userId'); // Client-controlled!

// AFTER (SECURE):
const user = await verifyAuth(req); // Server-verified
const userId = user.username;
```

**Changes Required:**
1. Remove `userId` from query parameters
2. Call `verifyAuth(req)` at route entry
3. Use `req.user.username` for all DB queries
4. Return 401 if no valid session

---

#### 2.2.2 Token Deduct Route
**File:** `src/app/api/tokens/deduct/route.ts`

```typescript
// BEFORE (VULNERABLE):
const body = await req.json();
const { userId, tool, cost } = body; // Trusts client!

// AFTER (SECURE):
const user = await verifyAuth(req);
const userId = user.username;
const { tool, cost } = body; // Only tool/cost from client

// Verify cost is legitimate
const VALID_COSTS = { tagGenerator: 1, thumbnail: 2, clipAnalyzer: 2 };
if (cost !== VALID_COSTS[tool]) {
  throw new Error('Invalid cost amount');
}
```

**Security Enhancements:**
- [ ] Server derives `userId` from JWT, never from body
- [ ] Server validates `cost` against whitelist (prevent negative/ manipulated costs)
- [ ] Server validates `tool` against allowed operations
- [ ] Rate limiting: Max 10 deductions per minute per user

---

#### 2.2.3 Token Purchase Route
**File:** `src/app/api/tokens/purchase/route.ts`

```typescript
// BEFORE (VULNERABLE):
const { userId, packageType } = body; // Trusts client!

// AFTER (SECURE):
const user = await verifyAuth(req);
const userId = user.username;

// Server defines package values - client only sends packageType
const PACKAGES = {
  starter: { tokens: 20, price: 5 },
  pro: { tokens: 50, price: 10 },
  elite: { tokens: 125, price: 20 }
};
const pkg = PACKAGES[packageType];
if (!pkg) throw new Error('Invalid package');
```

---

#### 2.2.4 Daily Tokens Route
**File:** `src/app/api/tokens/daily/route.ts`

```typescript
// BEFORE (VULNERABLE):
const { userId } = body; // Trusts client!

// AFTER (SECURE):
const user = await verifyAuth(req);
const userId = user.username;

// Check for unlimited access using SERVER-VERIFIED role
if (UNLIMITED_ROLES.includes(user.role)) {
  return { error: 'Unlimited users cannot claim daily tokens' };
}
```

---

### TASK 3: Refactor Admin Operations

#### 3.1 Admin Token Adjustment Route
**File:** `src/app/api/tokens/admin-adjust/route.ts` (New)

```typescript
export async function POST(req: NextRequest) {
  // 1. Authenticate
  const admin = await verifyAuth(req);
  
  // 2. Authorize (server-side only!)
  if (!['admin', 'owner'].includes(admin.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  // 3. Only NOW read body for TARGET user
  const { targetUserId, adjustment, reason } = await req.json();
  
  // 4. Server queries actual balance (never trusts client)
  const currentBalance = await getTokenBalance(targetUserId);
  const newBalance = currentBalance + adjustment;
  
  // 5. Atomic update with audit logging
  await updateTokenBalance(targetUserId, newBalance, {
    adjustedBy: admin.username,
    reason,
    timestamp: new Date()
  });
}
```

**Critical Security Rules:**
- [ ] Admin CANNOT adjust their own balance (prevent self-enrichment)
- [ ] All adjustments logged in `adminAuditLog` collection
- [ ] Maximum single adjustment: 1000 tokens (configurable)
- [ ] Requires secondary confirmation for adjustments > 100 tokens

---

### TASK 4: Refactor Gemini API Key Routes

#### 4.1 Gemini API Key Endpoint
**File:** `src/app/api/gemini-api-key/route.ts`

```typescript
export async function GET(req: NextRequest) {
  // 1. Strict authentication
  const user = await verifyAuth(req);
  
  // 2. Role-based access control
  const ALLOWED_ROLES = ['subscriber', 'subscriber_lifetime', 'admin', 'owner', 'tester'];
  if (!ALLOWED_ROLES.includes(user.role)) {
    return NextResponse.json(
      { error: 'Premium subscription required' }, 
      { status: 403 }
    );
  }
  
  // 3. Rate limiting check
  const rateLimitKey = `gemini_api:${user.username}`;
  const usage = await checkRateLimit(rateLimitKey, { max: 100, window: '1h' });
  
  // 4. Return masked API key (never full key!)
  return NextResponse.json({
    apiKey: maskApiKey(process.env.GEMINI_API_KEY),
    usage: usage.current,
    limit: usage.max,
    remaining: usage.remaining
  });
}

function maskApiKey(key: string): string {
  return key.slice(0, 8) + '...' + key.slice(-4);
}
```

---

### TASK 5: Refactor PayPal Webhook & Monetag Callbacks

#### 5.1 PayPal Webhook
**File:** `src/app/api/paypal-webhook/route.ts`

```typescript
export async function POST(req: NextRequest) {
  // 1. Verify PayPal signature FIRST
  const isValid = await verifyPayPalSignature(req);
  if (!isValid) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }
  
  const event = await req.json();
  
  // 2. Extract user from PayPal custom field (set by server during purchase)
  // NEVER trust client-sent userId in webhook!
  const { userId, orderId } = event.resource.custom_id;
  
  // 3. Verify order exists in our DB and is pending
  const pendingOrder = await db.collection('tokenPurchases').findOne({
    orderId,
    userId,
    status: 'pending'
  });
  
  if (!pendingOrder) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }
  
  // 4. Server-calculated token amount (never from webhook!)
  const tokensToAdd = pendingOrder.tokens; // From our DB, not PayPal
  
  // 5. Atomic balance update
  await incrementTokenBalance(userId, tokensToAdd);
}
```

#### 5.2 Monetag Rewarded Ad Callback
**File:** `src/app/api/monetag-callback/route.ts` (New)

```typescript
export async function POST(req: NextRequest) {
  // 1. Verify Monetag signature
  const signature = req.headers.get('x-monetag-signature');
  if (!verifyMonetagSignature(signature, req.body)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }
  
  const { userId, adType, rewardAmount } = await req.json();
  
  // 2. CRITICAL: Verify userId against our session store
  // The ad was shown to a specific user - we need to verify this callback
  // is legitimate by checking against a nonce we generated
  const session = await db.collection('adSessions').findOne({
    userId,
    status: 'watching',
    expiresAt: { $gt: new Date() }
  });
  
  if (!session) {
    return NextResponse.json({ error: 'Invalid ad session' }, { status: 400 });
  }
  
  // 3. Server-defined reward (ignore Monetag's rewardAmount!)
  const REWARDS = { rewarded_video: 2, interstitial: 1 };
  const actualReward = REWARDS[adType] || 0;
  
  // 4. Atomic increment
  await db.collection('tokenBalances').updateOne(
    { userId },
    { $inc: { tokens: actualReward, totalEarned: actualReward } }
  );
  
  // 5. Mark session as completed
  await db.collection('adSessions').updateOne(
    { _id: session._id },
    { $set: { status: 'completed', completedAt: new Date() } }
  );
}
```

---

## 4. ROUTE-BY-ROUTE REFACTORING CHECKLIST

### Tier 1: Critical (Immediate)
- [ ] `POST /api/tokens/deduct` - User can manipulate costs
- [ ] `POST /api/tokens/purchase` - User can impersonate others
- [ ] `GET /api/tokens/balance` - Information disclosure via userId param
- [ ] `POST /api/tokens/daily` - Can claim unlimited daily tokens
- [ ] `GET /api/gemini-api-key` - No role verification

### Tier 2: High Priority
- [ ] `POST /api/paypal-webhook` - Verify signature + order matching
- [ ] `POST /api/tokens/admin-adjust` - Create with strict RBAC
- [ ] `POST /api/monetag-callback` - Implement session verification

### Tier 3: Medium Priority
- [ ] `POST /api/thumbnail-generator` - Add token deduction verification
- [ ] `POST /api/tag-generator` - Add token deduction verification
- [ ] `POST /api/clip-analyzer` - Add token deduction verification

---

## 5. SECURITY TESTING CHECKLIST

After refactoring, verify these attacks are prevented:

### Authentication Bypass Tests
```bash
# Test 1: Request without any auth
curl -X POST https://api.sdcreatorcorner.com/api/tokens/deduct \
  -H "Content-Type: application/json" \
  -d '{"userId": "admin", "tool": "thumbnail", "cost": 0}'
# Expected: 401 Unauthorized

# Test 2: Request with forged JWT
curl -X GET https://api.sdcreatorcorner.com/api/tokens/balance?userId=admin \
  -H "Cookie: session=FORGED_TOKEN"
# Expected: 401 Unauthorized

# Test 3: Request with valid auth but wrong user in body
curl -X POST https://api.sdcreatorcorner.com/api/tokens/deduct \
  -H "Content-Type: application/json" \
  -H "Cookie: session=VALID_USER_SESSION" \
  -d '{"userId": "victim_user", "tool": "thumbnail", "cost": 2}'
# Expected: Server ignores body.userId, uses session.userId
```

### Authorization Bypass Tests
```bash
# Test 4: Free user accessing Gemini API
curl -X GET https://api.sdcreatorcorner.com/api/gemini-api-key \
  -H "Cookie: session=FREE_USER_SESSION"
# Expected: 403 Forbidden

# Test 5: Non-admin accessing admin endpoint
curl -X POST https://api.sdcreatorcorner.com/api/tokens/admin-adjust \
  -H "Content-Type: application/json" \
  -H "Cookie: session=SUBSCRIBER_SESSION" \
  -d '{"targetUserId": "victim", "adjustment": 1000}'
# Expected: 403 Forbidden
```

### Input Validation Tests
```bash
# Test 6: Negative cost attack
curl -X POST https://api.sdcreatorcorner.com/api/tokens/deduct \
  -H "Content-Type: application/json" \
  -H "Cookie: session=VALID_SESSION" \
  -d '{"tool": "thumbnail", "cost": -100}'
# Expected: 400 Bad Request (negative cost rejected)

# Test 7: Modified package price
curl -X POST https://api.sdcreatorcorner.com/api/tokens/purchase \
  -H "Content-Type: application/json" \
  -H "Cookie: session=VALID_SESSION" \
  -d '{"packageType": "starter", "price": 0.01}'
# Expected: Server ignores client price, uses server-defined price
```

---

## 6. DEPLOYMENT ROLLOUT PLAN

### Phase 1: Auth Middleware (Week 1)
1. Create `verifyAuth.ts` middleware
2. Deploy to staging
3. Test with existing client code

### Phase 2: Non-Breaking Changes (Week 2)
1. Refactor Gemini API routes (additive only)
2. Refactor admin routes (new endpoints)
3. Deploy to staging with full test suite

### Phase 3: Breaking Changes (Week 3)
1. Refactor token routes to ignore body.userId
2. Deploy with feature flags
3. Monitor error rates
4. Gradually enable for 10% → 50% → 100% traffic

### Phase 4: Cleanup (Week 4)
1. Remove deprecated client-side userId parameters
2. Update client code to remove userId from requests
3. Full production rollout

---

## 7. MONITORING & ALERTING

### Security Metrics to Track
- [ ] Authentication failure rate (baseline: < 0.1%)
- [ ] Authorization denial rate (alert if > 5% spike)
- [ ] Admin operation frequency (alert if > 10/hour)
- [ ] Token balance adjustments (log all, alert on > 100 tokens)

### Log Format
```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "event": "TOKEN_DEDUCT",
  "userId": "username123",
  "ip": "192.168.1.1",
  "tool": "thumbnail",
  "cost": 2,
  "balanceBefore": 10,
  "balanceAfter": 8,
  "sessionId": "sess_abc123"
}
```

---

## 8. FILES TO MODIFY

### New Files
1. `src/lib/auth/verifyAuth.ts` - Core auth middleware
2. `src/lib/auth/rateLimit.ts` - Rate limiting utilities
3. `src/app/api/tokens/admin-adjust/route.ts` - Admin operations
4. `src/app/api/monetag-callback/route.ts` - Ad reward verification

### Modified Files
1. `src/app/api/tokens/balance/route.ts`
2. `src/app/api/tokens/deduct/route.ts`
3. `src/app/api/tokens/purchase/route.ts`
4. `src/app/api/tokens/daily/route.ts`
5. `src/app/api/gemini-api-key/route.ts`
6. `src/app/api/paypal-webhook/route.ts`

---

**Prepared for:** Windsurf AI Agent
**Project:** Stream Dreams Creator Corner
**Priority:** Critical Security
**Estimated Effort:** 3-4 development days
