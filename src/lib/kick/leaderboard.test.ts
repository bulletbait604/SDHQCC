import test from 'node:test'
import assert from 'node:assert/strict'
import { parseGiftedSubsLeaderboard, parseKicksLeaderboard } from './leaderboard'

test('parseGiftedSubsLeaderboard reads Kick gifted-sub boards', () => {
  const board = parseGiftedSubsLeaderboard({
    gifts: [{ user_id: 1, username: 'topgifter', quantity: 2589 }],
    gifts_enabled: true,
    gifts_week: [{ user_id: 2, username: 'weekly', quantity: 4 }],
    gifts_week_enabled: true,
    gifts_month: [{ user_id: 3, username: 'monthly', gifted_amount: 17 }],
    gifts_month_enabled: true,
  })
  assert.equal(board.enabled, true)
  assert.equal(board.lifetime[0]?.username, 'topgifter')
  assert.equal(board.lifetime[0]?.quantity, 2589)
  assert.equal(board.lifetime[0]?.rank, 1)
  assert.equal(board.week[0]?.username, 'weekly')
  assert.equal(board.month[0]?.quantity, 17)
})

test('parseKicksLeaderboard reads Kick KICKs board fields', () => {
  const board = parseKicksLeaderboard({
    data: {
      kicks_gifts_lifetime: [{ username: 'kicker', quantity: 400 }],
      kicks_gifts_week: [{ username: 'weekkicker', quantity: 12 }],
      kicks_gifts_month: [],
      kicks_gifts_lifetime_enabled: true,
      kicks_gifts_week_enabled: true,
    },
  })
  assert.equal(board.lifetime[0]?.username, 'kicker')
  assert.equal(board.lifetime[0]?.quantity, 400)
  assert.equal(board.week[0]?.username, 'weekkicker')
  assert.equal(board.enabled, true)
})
