'use client'

import { useCallback, useEffect, useState } from 'react'
import type { OverviewPayload } from '@/lib/destiny/types'
import BungieConnectBanner from '@/app/components/destiny/BungieConnectBanner'
import ActivityIntelAccordion from '@/app/components/destiny/ActivityIntelAccordion'
import {
  GlassCard,
  ItemIcon,
  LeaderboardTable,
  LoadingBlock,
  ResetCountdown,
  SectionTitle,
  StatCard,
  StatusPill,
} from '@/app/components/destiny/DestinyUi'
import { cn } from '@/lib/utils'
import { formatDuration, getDestinyTheme } from '@/app/components/destiny/destinyTheme'
import TopLoadoutsByClass from '@/app/components/destiny/TopLoadoutsByClass'
import { useBungieLink } from '@/hooks/useBungieLink'

function countdownParts(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  return {
    days: Math.floor(totalSec / 86400),
    hours: Math.floor((totalSec % 86400) / 3600),
    minutes: Math.floor((totalSec % 3600) / 60),
  }
}

export default function OverviewPanel({ darkMode }: { darkMode: boolean }) {
  const [data, setData] = useState<OverviewPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const t = getDestinyTheme(darkMode)
  const bungie = useBungieLink()

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
      <BungieConnectBanner darkMode={darkMode} bungie={bungie} variant="overview" />

      <GlassCard darkMode={darkMode}>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 items-start">
          <div>
            <SectionTitle title="Today in Destiny" subtitle={data.weeklyReset.weekLabel} darkMode={darkMode} />
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <StatusPill
                label={data.bungieApiConfigured ? 'Live data' : 'API key needed'}
                tone={data.bungieApiConfigured ? 'green' : 'neutral'}
              />
              <StatusPill label={data.weeklyReset.resetTimeLabel} tone="neutral" />
            </div>
            {data.weeklyReset.pantheon && (
              <p className={cn('text-xs mb-3 italic', t.purple)}>Pantheon: {data.weeklyReset.pantheon}</p>
            )}
          </div>
          <ResetCountdown
            {...countdownParts(data.weeklyReset.resetsInMs)}
            label="Weekly reset in"
          />
        </div>
      </GlassCard>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard
          darkMode={darkMode}
          label="Featured raid"
          value={data.featuredRaid.name}
          sub={`Resets ${data.featuredRaid.resetsIn}`}
        />
        <StatCard
          darkMode={darkMode}
          label="Featured dungeon"
          value={data.featuredDungeon.name}
          sub={`Resets ${data.featuredDungeon.resetsIn}`}
        />
        <StatCard
          darkMode={darkMode}
          label="Season"
          value={`${data.seasonCountdown.days}d ${data.seasonCountdown.hours}h`}
          sub={data.season.name}
        />
        <StatCard
          darkMode={darkMode}
          label="Season prizes"
          value={`${data.seasonCountdown.days}d left`}
          sub={data.prizeSummary.length > 48 ? 'See Season tab for details' : data.prizeSummary}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <GlassCard darkMode={darkMode}>
          <SectionTitle title="Raids" iconUrl={data.featuredRaid.iconUrl} darkMode={darkMode} />
          <LeaderboardTable entries={data.raidTop10} darkMode={darkMode} compact />
        </GlassCard>
        <GlassCard darkMode={darkMode}>
          <SectionTitle title="Dungeons" iconUrl={data.featuredDungeon.iconUrl} darkMode={darkMode} />
          <LeaderboardTable entries={data.dungeonTop10} darkMode={darkMode} compact />
        </GlassCard>
        <GlassCard darkMode={darkMode}>
          <SectionTitle title="Clan Teams" darkMode={darkMode} />
          <LeaderboardTable entries={data.clanTop5} darkMode={darkMode} compact />
        </GlassCard>
      </div>

      <GlassCard darkMode={darkMode}>
        <SectionTitle title="Weekly rotation" subtitle={data.weeklyReset.weekLabel} darkMode={darkMode} />
        <ActivityIntelAccordion
          raids={data.weeklyReset.featuredRaids}
          dungeons={data.weeklyReset.featuredDungeons}
        />
      </GlassCard>

      {data.hallOfFamePreview.length > 0 && (
        <GlassCard darkMode={darkMode}>
          <SectionTitle
            title="Season Hall of Fame preview"
            subtitle="Current leaders — see Season tab for prizes and your track"
            darkMode={darkMode}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-2">
            {data.hallOfFamePreview.slice(0, 6).map((winner, i) => (
              <div
                key={`${winner.category}-${winner.rank}-${i}`}
                className="d2-panel-inset px-3 py-2 rounded-lg flex justify-between gap-2"
              >
                <span className={cn('text-sm', t.body)}>
                  #{winner.rank} {winner.displayName} {winner.clanTag}
                </span>
                <span className={cn('text-[10px] uppercase shrink-0', t.caption)}>
                  {winner.category.replace(/_/g, ' ')}
                </span>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GlassCard darkMode={darkMode}>
          <SectionTitle title="Recent Verified Runs" darkMode={darkMode} />
          <div className="space-y-2">
            {data.recentRuns.map((run) => (
              <div
                key={run.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2 border-b border-white/5 last:border-0"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <ItemIcon item={run.activityRef} name={run.activityName} size={32} />
                  <div>
                    <p className="text-white text-sm font-medium">{run.activityName}</p>
                    <p className={cn('text-xs', t.muted)}>
                      {run.type} · {formatDuration(run.durationSeconds)} · +{run.pointsAwarded} pts
                    </p>
                  </div>
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

      <TopLoadoutsByClass
        darkMode={darkMode}
        topByClass={data.topLoadoutsByClass}
        compact
        title="Top loadouts this season"
        subtitle="Two most-used builds per class from verified clears"
      />
    </div>
  )
}