import test from 'node:test'
import assert from 'node:assert/strict'
import { canAccessRdSubTab, canAccessRnd, canSeeRndTab } from './rndAccess'
import { hasTabAccessForUser, isAllowlistedAdmin, resolveSiteRole } from './ownerIdentity'

test('R&D is owner-only unless the owner granted tools', () => {
  assert.equal(canSeeRndTab('someviewer'), false)
  assert.equal(canSeeRndTab('someviewer', ['tradebot']), true)
  assert.equal(canAccessRdSubTab('tradebot', 'someviewer'), false)
  assert.equal(canAccessRdSubTab('tradebot', 'someviewer', ['tradebot']), true)
  assert.equal(canAccessRdSubTab('narrate-me', 'someviewer', ['tradebot']), false)
  assert.equal(canAccessRnd('free', 'someviewer'), false)
  assert.equal(canSeeRndTab('bulletbait604'), true)
})

test('Vi-Guys GW Map is a User APP, not an R&D grant', () => {
  assert.equal(canAccessRdSubTab('vi-guys-gw-map', 'someviewer', ['vi-guys-gw-map']), false)
  assert.equal(hasTabAccessForUser('admin', 'vi-guys-gw-map', 'mrv1rus'), true)
  assert.equal(hasTabAccessForUser('admin', 'rnd', 'mrv1rus'), false)
  assert.equal(hasTabAccessForUser('admin', 'rnd', 'mrv1rus', ['narrate-me']), true)
})

test('logged-out users cannot open R&D tools', () => {
  assert.equal(canSeeRndTab(null), false)
  assert.equal(canAccessRdSubTab('tradebot', '', ['tradebot']), false)
})

test('mrv1rus is a hardcoded admin, not owner', () => {
  assert.equal(isAllowlistedAdmin('mrv1rus'), true)
  assert.equal(isAllowlistedAdmin('MrV1rus'), true)
  assert.equal(resolveSiteRole('mrv1rus', 'free'), 'admin')
  assert.equal(resolveSiteRole('mrv1rus', 'owner'), 'admin')
  assert.equal(resolveSiteRole('bulletbait604', 'free'), 'owner')
})
