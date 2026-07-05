import type { Season } from '@/lib/destiny/types'

/** Operational season config — update dates when Bungie rotates seasons. */
export const ACTIVE_SEASON: Season = {
  id: 'dtn-nest-s1',
  name: 'Nest Season 1 — Monument Era',
  startDate: '2026-06-09T17:00:00Z',
  endDate: '2026-07-31T17:00:00Z',
  status: 'active',
  prizeRules: {
    raid: {
      first: '$50 CAD platform card (Xbox / PlayStation / Steam)',
      second: '$25 CAD platform card',
      thirdToFifth: '3D print prize',
      participation: 'Leaderboard history mention',
    },
    dungeon: {
      first: '$50 CAD platform card',
      second: '$25 CAD platform card',
      thirdToFifth: '3D print prize',
      participation: 'Leaderboard history mention',
    },
    fullClanTeam: {
      first: '$50 CAD platform card or clan prize',
      second: '$25 CAD platform card',
      third: '3D print prize',
    },
  },
  winners: [],
}

export function getSeasonCountdown(season: Season = ACTIVE_SEASON): {
  days: number
  hours: number
  label: string
} {
  const end = new Date(season.endDate).getTime()
  const now = Date.now()
  const diff = Math.max(0, end - now)
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  return { days, hours, label: `${days}d ${hours}h until season end` }
}

export const PRIZE_SUMMARY =
  'Raid & Dungeon Top 5 win platform cards or 3D prints. Full Clan Team prizes for same-clan clears.'
