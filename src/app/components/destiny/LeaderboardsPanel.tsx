'use client'

import { useCallback, useEffect, useState } from 'react'
import type { LeaderboardCategory, LeaderboardEntry, LeaderboardPeriod } from '@/lib/destiny/types'
import {
  GlassCard,
  LeaderboardTable,
  LoadingBlock,
  PageIntro,
  SegmentedControl,
} from '@/app/components/destiny/DestinyUi'

const PERIODS: { value: LeaderboardPeriod; label: string }[] = [
  { value: 'weekly', label: 'This week' },
  { value: 'monthly', label: 'This month' },
  { value: 'season', label: 'Season' },
  { value: 'all_time', label: 'All time' },
]

const CATEGORIES: { value: LeaderboardCategory; label: string }[] = [
  { value: 'raid', label: 'Raids' },
  { value: 'dungeon', label: 'Dungeons' },
  { value: 'full_clan_team', label: 'Clan teams' },
]

export default function LeaderboardsPanel({ darkMode }: { darkMode: boolean }) {
  const [period, setPeriod] = useState<LeaderboardPeriod>('season')
  const [category, setCategory] = useState<LeaderboardCategory>('raid')
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ period, category })
      const res = await fetch(`/api/destiny/leaderboards?${params}`, { credentials: 'include' })
      if (res.ok) {
        const json = await res.json()
        setEntries(json.entries ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [period, category])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="space-y-6">
      <PageIntro
        darkMode={darkMode}
        title="Leaderboards"
        description="Verified full clears only. Earn points with clanmates and randos — caps apply per activity type."
      />

      <GlassCard darkMode={darkMode}>
        <div className="space-y-5 mb-6">
          <SegmentedControl
            label="Time period"
            options={PERIODS}
            value={period}
            onChange={setPeriod}
            darkMode={darkMode}
          />
          <SegmentedControl
            label="Category"
            options={CATEGORIES}
            value={category}
            onChange={setCategory}
            darkMode={darkMode}
          />
        </div>

        {loading ? (
          <LoadingBlock darkMode={darkMode} label="Loading rankings…" />
        ) : (
          <LeaderboardTable entries={entries} darkMode={darkMode} />
        )}
      </GlassCard>
    </div>
  )
}
