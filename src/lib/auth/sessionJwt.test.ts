import test from 'node:test'
import assert from 'node:assert/strict'
import { signSessionJwt, verifySessionJwt } from './sessionJwt'

test('round-trips a valid token', () => {
  const t = signSessionJwt({ sub: 'alice' }, 'k', 60)
  assert.equal(verifySessionJwt(t, 'k')?.sub, 'alice')
})

test('rejects tampered signature, wrong secret, garbage and expired tokens', () => {
  const t = signSessionJwt({ sub: 'alice' }, 'k', 60)
  assert.equal(verifySessionJwt(t.slice(0, -2) + 'xx', 'k'), null)
  assert.equal(verifySessionJwt(t, 'other'), null)
  assert.equal(verifySessionJwt('a.b', 'k'), null)
  assert.equal(verifySessionJwt('a.b.c', 'k'), null)
  const expired = signSessionJwt({ sub: 'alice' }, 'k', -10)
  assert.equal(verifySessionJwt(expired, 'k'), null)
})
