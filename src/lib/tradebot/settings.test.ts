import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveDeskMode, deskUiFlags, paperStartMismatchShouldReset } from '@/lib/tradebot/settings'

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

test('desk UI keeps Real selected from liveMode even when TRADEBOT_PAPER is on', () => {
  const flags = deskUiFlags({ liveMode: true })
  assert.equal(flags.liveMode, true)
})

test('Fake book resets when TRADEBOT_STARTING_CAD changes', () => {
  assert.equal(paperStartMismatchShouldReset(false, 100, 50), true)
  assert.equal(paperStartMismatchShouldReset(false, 100, 100), false)
})

test('Real book is not wiped when starting CAD env differs from Kraken cash', () => {
  assert.equal(paperStartMismatchShouldReset(true, 47.12, 100), false)
  assert.equal(paperStartMismatchShouldReset(true, 100, 50), false)
})
