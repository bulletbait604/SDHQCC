import test from 'node:test'
import assert from 'node:assert/strict'
import { canAccessRdSubTab, canAccessRnd, canSeeRndTab } from './rndAccess'

test('any Kick username can see R&D and Vi-Guys GW Map', () => {
  assert.equal(canSeeRndTab('someviewer'), true)
  assert.equal(canAccessRdSubTab('vi-guys-gw-map', 'someviewer'), true)
  assert.equal(canAccessRdSubTab('tradebot', 'someviewer'), false)
  assert.equal(canAccessRnd('free', 'someviewer'), false)
})

test('logged-out users cannot open R&D tools', () => {
  assert.equal(canSeeRndTab(null), false)
  assert.equal(canAccessRdSubTab('vi-guys-gw-map', ''), false)
})
