import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveDeskMode } from '@/lib/tradebot/settings'

test('Fake mode works with paper flag and no keys', () => {
  const m = resolveDeskMode({ paper: true, liveEnv: false, keys: false, liveMode: false })
  assert.equal(m.deskEnabled, true)
  assert.equal(m.liveAllowed, false)
  assert.equal(m.placingLive, false)
})

test('keys without TRADEBOT_LIVE keep Real locked', () => {
  const m = resolveDeskMode({ paper: true, liveEnv: false, keys: true, liveMode: true })
  assert.equal(m.deskEnabled, true)
  assert.equal(m.liveAllowed, false)
  assert.equal(m.placingLive, false)
})

test('paper env no longer blocks Real when UI liveMode is on', () => {
  const m = resolveDeskMode({ paper: true, liveEnv: true, keys: true, liveMode: true })
  assert.equal(m.liveAllowed, true)
  assert.equal(m.placingLive, true)
})

test('Real stays practice until the Fake/Real tab is Real', () => {
  const m = resolveDeskMode({ paper: true, liveEnv: true, keys: true, liveMode: false })
  assert.equal(m.liveAllowed, true)
  assert.equal(m.placingLive, false)
})

test('keys alone enable the desk for Fake testing', () => {
  const m = resolveDeskMode({ paper: false, liveEnv: true, keys: true, liveMode: false })
  assert.equal(m.deskEnabled, true)
  assert.equal(m.placingLive, false)
})
