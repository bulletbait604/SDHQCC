import test from 'node:test'
import assert from 'node:assert/strict'
import {
  signedImageUrl,
  verifyImageSignature,
  thumbnailScope,
  userOwnsThumbnailKey,
} from './thumbnailAccess'

process.env.SESSION_SECRET = 'test-secret'

function parts(url: string) {
  const q = new URL(url, 'http://x').searchParams
  return { key: q.get('key')!, exp: q.get('exp'), sig: q.get('sig') }
}

test('signed URL verifies for its key until it expires', () => {
  const now = 1_800_000_000_000
  const p = parts(signedImageUrl('thumbnails/u/alice/s/a.png', 60, now))
  assert.equal(verifyImageSignature(p.key, p.exp, p.sig, now), true)
  assert.equal(verifyImageSignature(p.key, p.exp, p.sig, now + 61_000), false)
  assert.equal(verifyImageSignature('thumbnails/u/bob/s/a.png', p.exp, p.sig, now), false)
  assert.equal(verifyImageSignature(p.key, String(Number(p.exp) + 999), p.sig, now), false)
  assert.equal(verifyImageSignature(p.key, null, null, now), false)
})

test('keys are namespaced per user and ownership is prefix-exact', () => {
  const scope = thumbnailScope('@Alice', 'sess-1')
  assert.equal(scope, 'u/alice/sess-1')
  assert.equal(userOwnsThumbnailKey(`thumbnails/${scope}/x.png`, 'alice'), true)
  assert.equal(userOwnsThumbnailKey(`thumbnails/${scope}/x.png`, 'ali'), false)
  assert.equal(userOwnsThumbnailKey('thumbnails/legacy-session/x.png', 'alice'), false)
  assert.match(thumbnailScope('alice', '../../evil'), /^u\/alice\/[a-z0-9_-]+$/)
})
