import test from 'node:test'
import assert from 'node:assert/strict'
import { canAccessRdSubTab, canAccessRnd, canSeeRndTab } from './rndAccess'
import { hasTabAccessForUser, isAllowlistedAdmin, resolveSiteRole } from './ownerIdentity'

test('R&D is owner-only unless the owner granted tools', () => {
  assert.equal(canSeeRndTab('someviewer'), false)
  assert.equal(canSeeRndTab('someviewer', ['trending-vids']), true)
  assert.equal(canAccessRdSubTab('trending-vids', 'someviewer'), false)
  assert.equal(canAccessRdSubTab('trending-vids', 'someviewer', ['trending-vids']), true)
  assert.equal(canAccessRdSubTab('tradebot', 'someviewer', ['trending-vids']), false)
  assert.equal(canAccessRnd('free', 'someviewer'), false)
  assert.equal(canSeeRndTab('bulletbait604'), true)
})

test('User APPs are available to any signed-in user', () => {
  assert.equal(hasTabAccessForUser('free', 'kick-clips', 'someviewer'), true)
  assert.equal(hasTabAccessForUser('admin', 'user-apps', 'mrv1rus'), true)
  assert.equal(hasTabAccessForUser('admin', 'rnd', 'mrv1rus'), false)
  assert.equal(hasTabAccessForUser('admin', 'rnd', 'mrv1rus', ['trending-vids']), true)
  assert.equal(hasTabAccessForUser('free', 'kick-clips', ''), false)
})

test('logged-out users cannot open R&D tools', () => {
  assert.equal(canSeeRndTab(null), false)
  assert.equal(canAccessRdSubTab('trending-vids', '', ['trending-vids']), false)
})

test('mrv1rus is a hardcoded admin, not owner', () => {
  assert.equal(isAllowlistedAdmin('mrv1rus'), true)
  assert.equal(isAllowlistedAdmin('MrV1rus'), true)
  assert.equal(resolveSiteRole('mrv1rus', 'free'), 'admin')
  assert.equal(resolveSiteRole('mrv1rus', 'owner'), 'admin')
  assert.equal(resolveSiteRole('bulletbait604', 'free'), 'owner')
})
