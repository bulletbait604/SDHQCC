'use client'

import { useCallback, useEffect, useState } from 'react'
import type { LeaderboardCategory, LeaderboardEntry, LeaderboardPeriod } from '@/lib/destiny/types'
import {
  GlassCard,
  LeaderboardTable,
  LoadingBlock,
  SectionTitle,
} from '@/app/components/destiny/DestinyUi'
import { getDestinyTheme } from '@/app/components/destiny/destinyTheme'
import { cn } from '@/lib/utils'

const PERIODS: LeaderboardPeriod[] = ['weekly', 'monthly', 'season', 'all_time']
const CATEGORIES: { id: LeaderboardCategory; label: string }[] = [
  { id: 'raid', label: 'Raid' },
  { id: 'dungeon', label: 'Dungeon' },
  { id: 'full_clan_team', label: 'Full Clan Team' },
]

export default function LeaderboardsPanel({ darkMode }: { darkMode: boolean }) {
  const [period, setPeriod] = useState<LeaderboardPeriod>('season')
  const [category, setCategory] = useState<LeaderboardCategory>('raid')
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const t = getDestinyTheme(darkMode)

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

  const filterBtn = (active: boolean) =>
    cn(
      'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
      active ? 'bg-amber-500/25 text-amber-200 border border-amber-500/40' : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
    )

  return (
    <div className="space-y-4">
      <GlassCard darkMode={darkMode}>
        <SectionTitle
          title="Leaderboards"
          subtitle="Verified full completions only · 2 pts/clan · 5 pts/rando (caps apply)"
          darkMode={darkMode}
        />
        <div className="flex flex-wrap gap-2 mb-4">
          <span className={cn('text-xs self-center mr-1', t.muted)}>Period:</span>
          {PERIODS.map((p) => (
            <button key={p} type="button" className={filterBtn(period === p)} onClick={() => setPeriod(p)}>
              {p.replace('_', ' ')}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          <span className={cn('text-xs self-center mr-1', t.muted)}>Category:</span>
          {CATEGORIES.map((c) => (
            <button key={c.id} type="button" className={filterBtn(category === c.id)} onClick={() => setCategory(c.id)}>
              {c.label}
            </button>
          ))}
        </div>
        <p className={cn('text-xs mb-4', t.muted)}>
          Phase 1 filters: period + category. Activity, difficulty, platform, and class filters ship in Phase 2.
        </p>
        {loading ? <LoadingBlock darkMode={darkMode} /> : <LeaderboardTable entries={entries} darkMode={darkMode} />}
      </GlassCard>
    </div>
  )
}
