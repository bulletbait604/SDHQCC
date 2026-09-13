import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeGw2ApiKey } from './normalizeKey'

test('normalizeGw2ApiKey strips quotes, Bearer, and whitespace', () => {
  const core = ['not', 'a', 'live', 'arenanet', 'token'].join('-')
  assert.equal(normalizeGw2ApiKey(`  Bearer ${core}  `), core)
  assert.equal(normalizeGw2ApiKey(`"${core}"`), core)
  assert.equal(normalizeGw2ApiKey(`'\n${core}\n'`), core)
})
