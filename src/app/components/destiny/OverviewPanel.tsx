'use client'

import { useCallback, useEffect, useState } from 'react'
import { Crown, Swords, Users, Clock, Trophy, Sparkles } from 'lucide-react'
import type { OverviewPayload } from '@/lib/destiny/types'
import {
  GlassCard,
  LeaderboardTable,
  LoadingBlock,
  SectionTitle,
  StatusPill,
} from '@/app/components/destiny/DestinyUi'
import { cn } from '@/lib/utils'
import { formatDuration, getDestinyTheme } from '@/app/components/destiny/destinyTheme'

export default function OverviewPanel({ darkMode }: { darkMode: boolean }) {
  const [data, setData] = useState<OverviewPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const t = getDestinyTheme(darkMode)

  const load = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch('/api/destiny/overview', { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to load overview')
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (loading) return <LoadingBlock darkMode={darkMode} />
  if (error || !data) {
    return (
      <GlassCard darkMode={darkMode}>
        <p className="text-red-400">{error ?? 'No data'}</p>
      </GlassCard>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill
          label={data.bungieApiConfigured ? 'Bungie API configured' : 'Mock data — set DESTINY_API'}
          tone={data.bungieApiConfigured ? 'green' : 'gold'}
        />
        <StatusPill label={data.seasonCountdown.label} tone="purple" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <GlassCard darkMode={darkMode}>
          <SectionTitle title="Raid Top 10" subtitle="Verified full clears · season" darkMode={darkMode} />
          <LeaderboardTable entries={data.raidTop10} darkMode={darkMode} compact />
        </GlassCard>
        <GlassCard darkMode={darkMode}>
          <SectionTitle title="Dungeon Top 10" subtitle="Verified full clears · season" darkMode={darkMode} />
          <LeaderboardTable entries={data.dungeonTop10} darkMode={darkMode} compact />
        </GlassCard>
        <GlassCard darkMode={darkMode}>
          <SectionTitle title="Full Clan Teams Top 5" subtitle="Same-clan fireteams only" darkMode={darkMode} />
          <LeaderboardTable entries={data.clanTop5} darkMode={darkMode} compact />
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <GlassCard darkMode={darkMode}>
          <div className="flex items-center gap-2 mb-2">
            <Swords className="w-4 h-4 text-amber-400" />
            <span className={t.heading}>Featured Raid</span>
          </div>
          <p className="text-white font-semibold">{data.featuredRaid.name}</p>
          <p className={cn('text-xs mt-1', t.muted)}>
            {data.featuredRaid.difficulty} · resets {data.featuredRaid.resetsIn}
          </p>
        </GlassCard>
        <GlassCard darkMode={darkMode}>
          <div className="flex items-center gap-2 mb-2">
            <Crown className="w-4 h-4 text-purple-400" />
            <span className={t.heading}>Featured Dungeon</span>
          </div>
          <p className="text-white font-semibold">{data.featuredDungeon.name}</p>
          <p className={cn('text-xs mt-1', t.muted)}>
            {data.featuredDungeon.difficulty} · resets {data.featuredDungeon.resetsIn}
          </p>
        </GlassCard>
        <GlassCard darkMode={darkMode}>
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            <span className={t.heading}>Season Prizes</span>
          </div>
          <p className={cn('text-xs', t.muted)}>{data.prizeSummary}</p>
        </GlassCard>
        <GlassCard darkMode={darkMode}>
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-sky-400" />
            <span className={t.heading}>{data.season.name}</span>
          </div>
          <p className={cn('text-xs', t.muted)}>
            {data.seasonCountdown.days}d {data.seasonCountdown.hours}h remaining
          </p>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GlassCard darkMode={darkMode}>
          <SectionTitle title="Recent Verified Runs" darkMode={darkMode} />
          <div className="space-y-2">
            {data.recentRuns.map((run) => (
              <div
                key={run.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2 border-b border-white/5 last:border-0"
              >
                <div>
                  <p className="text-white text-sm font-medium">{run.activityName}</p>
                  <p className={cn('text-xs', t.muted)}>
                    {run.type} · {formatDuration(run.durationSeconds)} · +{run.pointsAwarded} pts
                  </p>
                </div>
                <StatusPill
                  label={run.verificationStatus}
                  tone={
                    run.verificationStatus === 'verified'
                      ? 'green'
                      : run.verificationStatus === 'flagged'
                        ? 'red'
                        : 'gold'
                  }
                />
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard darkMode={darkMode}>
          <SectionTitle title="Looking for Group" darkMode={darkMode} />
          <div className="space-y-2">
            {data.lookingForGroup.map((lobby) => (
              <div key={lobby.id} className="py-2 border-b border-white/5 last:border-0">
                <div className="flex justify-between gap-2">
                  <p className="text-white text-sm font-medium">{lobby.activityName}</p>
                  <span className={cn('text-xs', t.blue)}>
                    {lobby.currentPlayers}/{lobby.maxPlayers}
                  </span>
                </div>
                <p className={cn('text-xs', t.muted)}>
                  {lobby.hostDisplayName} · {lobby.goal.replace(/_/g, ' ')}
                </p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {lobby.tags.slice(0, 4).map((tag) => (
                    <StatusPill key={tag} label={tag} tone="purple" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      <GlassCard darkMode={darkMode}>
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <SectionTitle title="Trending Builds from Verified Clears" darkMode={darkMode} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {data.trendingBuilds.map((b) => (
            <div key={b.id} className="rounded-lg bg-black/30 p-3 border border-purple-500/20">
              <p className="text-white font-medium text-sm">{b.buildName}</p>
              <p className={cn('text-xs mt-1', t.muted)}>
                {b.subclass} {b.characterClass} · {b.usageRatePercent}% of top teams
              </p>
              <p className={cn('text-xs mt-1', t.gold)}>
                Avg {formatDuration(b.averageClearSeconds)} · {b.deathRatePercent}% deaths
              </p>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  )
}