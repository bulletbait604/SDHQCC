import test from 'node:test'
import assert from 'node:assert/strict'
import { buildStreamDeckPlugin } from './packagePlugin'

test('Pro Stream Deck package is a zip without the removed Kick secret', () => {
  const built = buildStreamDeckPlugin('pro')
  assert.equal(built.filename, 'SDHQCC-Kick-Live-Pro.streamDeckPlugin')
  assert.equal(built.bytes.readUInt32LE(0), 0x04034b50)
  const text = built.bytes.toString('utf8')
  assert.match(text, /com\.sdhqcreator\.kicklive\.pro\.sdPlugin\/manifest\.json/)
  assert.match(text, /com\.sdhqcreator\.kicklive\.pro\.action/)
  assert.match(text, /PLUGIN_EDITION = 'pro'/)
  assert.equal(text.includes('KICK_CLIENT_SECRET'), false)
  assert.equal(text.includes('aa29e3824f2b063c1f97c144f164cd14da413bdeb9b31c138504a2f2e179f726'), false)
})

test('standard package keeps the original plugin id', () => {
  const built = buildStreamDeckPlugin('standard')
  const text = built.bytes.toString('utf8')
  assert.match(text, /com\.sdhqcreator\.kicklive\.sdPlugin\/manifest\.json/)
  assert.match(text, /PLUGIN_EDITION = 'standard'/)
  assert.match(text, /"Name": "com\.sdhqcreator\.kicklive"/)
  assert.equal(text.includes('"Name": "com.sdhqcreator.kicklive.pro"'), false)
})
