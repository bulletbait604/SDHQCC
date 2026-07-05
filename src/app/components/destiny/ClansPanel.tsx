'use client'

import { useCallback, useEffect, useState } from 'react'
import type { ClanProfile } from '@/lib/destiny/types'
import {
  GlassCard,
  LoadingBlock,
  SectionTitle,
  StatusPill,
} from '@/app/components/destiny/DestinyUi'
import { formatDuration, getDestinyTheme } from '@/app/components/destiny/destinyTheme'
import { cn } from '@/lib/utils'

export default function ClansPanel({ darkMode }: { darkMode: boolean }) {
  const [clan, setClan] = useState<ClanProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const t = getDestinyTheme(darkMode)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/destiny/clans', { credentials: 'include' })
      if (res.ok) {
        const json = await res.json()
        setClan(json.clan)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (loading) return <LoadingBlock darkMode={darkMode} />
  if (!clan) return null

  return (
    <div className="space-y-4">
      <GlassCard darkMode={darkMode}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-2xl font-bold text-white">
              {clan.tag} {clan.name}
            </h3>
            <p className={cn('text-sm mt-1', t.muted)}>{clan.memberCount} members · {clan.points} pts</p>
            {clan.recruitmentOpen && <StatusPill label="Recruiting" tone="green" />}
          </div>
          <div className="text-right">
            <p className={cn('text-xs', t.muted)}>Full clan clears</p>
            <p className={cn('text-2xl font-bold', t.gold)}>{clan.fullClanClears}</p>
          </div>
        </div>
      </GlassCard>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <GlassCard darkMode={darkMode}>
          <SectionTitle title="Average clear times" darkMode={darkMode} />
          <p className={cn('text-sm', t.muted)}>
            Raid: <span className={t.gold}>{formatDuration(clan.avgRaidClearSeconds)}</span>
          </p>
          <p className={cn('text-sm mt-1', t.muted)}>
            Dungeon: <span className={t.gold}>{formatDuration(clan.avgDungeonClearSeconds)}</span>
          </p>
        </GlassCard>
        <GlassCard darkMode={darkMode}>
          <SectionTitle title="Achievements" darkMode={darkMode} />
          <div className="flex flex-wrap gap-2">
            {clan.achievements.map((a) => (
              <StatusPill key={a} label={a} tone="purple" />
            ))}
          </div>
        </GlassCard>
      </div>

      <GlassCard darkMode={darkMode}>
        <SectionTitle title="Top members" darkMode={darkMode} />
        <div className="space-y-2">
          {clan.topMembers.map((m, i) => (
            <div key={m.displayName} className="flex items-center justify-between py-2 border-b border-white/5">
              <div className="flex items-center gap-2">
                <span className={cn('text-sm font-bold w-6', t.gold)}>{i + 1}</span>
                <span className="text-white">{m.displayName}</span>
              </div>
              <span className={cn('text-sm', t.gold)}>{m.points} pts</span>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  )
}
