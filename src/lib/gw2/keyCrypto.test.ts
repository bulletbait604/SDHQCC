import test from 'node:test'
import assert from 'node:assert/strict'
import { decryptGw2ApiKey, encryptGw2ApiKey, gw2KeyEncryptionReady, gw2KeyLastFour } from './keyCrypto'

test('encryptGw2ApiKey round-trips when a secret is set', () => {
  if (!process.env.SESSION_SECRET && !process.env.INTERNAL_API_SECRET && !process.env.GW2_KEY_SECRET) {
    process.env.GW2_KEY_SECRET = ['unit', 'test', 'only'].join('-')
  }
  assert.equal(gw2KeyEncryptionReady(), true)
  const plain = ['not', 'a', 'live', 'arenanet', 'token'].join('-')
  assert.equal(decryptGw2ApiKey(encryptGw2ApiKey(plain)), plain)
  assert.equal(gw2KeyLastFour(plain), plain.slice(-4))
})
