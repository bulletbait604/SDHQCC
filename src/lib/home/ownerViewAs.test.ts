import test from 'node:test'
import assert from 'node:assert/strict'
import { applyOwnerViewAs, parseOwnerViewAs } from './ownerViewAs'

test('parseOwnerViewAs only accepts owner, free, or subscriber', () => {
  assert.equal(parseOwnerViewAs('free'), 'free')
  assert.equal(parseOwnerViewAs('subscriber'), 'subscriber')
  assert.equal(parseOwnerViewAs('owner'), 'owner')
  assert.equal(parseOwnerViewAs('admin'), 'owner')
  assert.equal(parseOwnerViewAs(null), 'owner')
})

test('applyOwnerViewAs leaves non-owners on their real role', () => {
  const result = applyOwnerViewAs({
    isOwner: false,
    viewAs: 'free',
    userRole: 'admin',
    isAdmin: true,
    isSubscribed: false,
    isLifetimeMember: false,
  })
  assert.equal(result.userRole, 'admin')
  assert.equal(result.isAdmin, true)
  assert.equal(result.previewing, false)
})

test('owner can preview regular (free) UI', () => {
  const result = applyOwnerViewAs({
    isOwner: true,
    viewAs: 'free',
    userRole: 'owner',
    isAdmin: true,
    isSubscribed: true,
    isLifetimeMember: true,
  })
  assert.equal(result.userRole, 'free')
  assert.equal(result.isOwner, false)
  assert.equal(result.isAdmin, false)
  assert.equal(result.isSubscribed, false)
  assert.equal(result.previewing, true)
})

test('owner can preview subscriber UI', () => {
  const result = applyOwnerViewAs({
    isOwner: true,
    viewAs: 'subscriber',
    userRole: 'owner',
    isAdmin: true,
    isSubscribed: false,
    isLifetimeMember: false,
  })
  assert.equal(result.userRole, 'subscriber')
  assert.equal(result.isOwner, false)
  assert.equal(result.isAdmin, false)
  assert.equal(result.isSubscribed, true)
  assert.equal(result.previewing, true)
})
