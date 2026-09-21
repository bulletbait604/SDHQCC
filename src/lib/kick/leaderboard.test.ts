import test from 'node:test'
import assert from 'node:assert/strict'
import { parseKickLeaderboard } from './leaderboard'

test('parseKickLeaderboard reads Kick web gift boards', () => {
  const board = parseKickLeaderboard({
    gifts: [{ user_id: 1, username: 'topgifter', quantity: 2589 }],
    gifts_enabled: true,
    gifts_week: [{ user_id: 2, username: 'weekly', quantity: 4 }],
    gifts_week_enabled: true,
    gifts_month: [{ user_id: 3, username: 'monthly', gifted_amount: 17 }],
    gifts_month_enabled: true,
  })
  assert.equal(board.giftsEnabled, true)
  assert.equal(board.lifetime[0]?.username, 'topgifter')
  assert.equal(board.lifetime[0]?.quantity, 2589)
  assert.equal(board.lifetime[0]?.rank, 1)
  assert.equal(board.week[0]?.username, 'weekly')
  assert.equal(board.month[0]?.quantity, 17)
})

test('parseKickLeaderboard reads official kicks leaderboard shape', () => {
  const board = parseKickLeaderboard({
    data: {
      lifetime: [{ rank: 2, user_id: 9, username: 'official', gifted_amount: 40 }],
      week: [],
      month: [],
    },
  })
  assert.equal(board.lifetime[0]?.rank, 2)
  assert.equal(board.lifetime[0]?.quantity, 40)
})
