'use client'

import { useCallback, useEffect, useState } from 'react'
import { Shield, Star, Trophy } from 'lucide-react'
import type { PlayerProfile } from '@/lib/destiny/types'
import {
  GlassCard,
  LoadingBlock,
  SectionTitle,
  StatusPill,
} from '@/app/components/destiny/DestinyUi'
import { formatDuration, getDestinyTheme, platformIcon } from '@/app/components/destiny/destinyTheme'
import { cn } from '@/lib/utils'

export default function ProfilePanel({ darkMode }: { darkMode: boolean }) {
  const [profile, setProfile] = useState<PlayerProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const t = getDestinyTheme(darkMode)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/destiny/profile', { credentials: 'include' })
      if (res.ok) {
        const json = await res.json()
        setProfile(json.profile)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (loading) return <LoadingBlock darkMode={darkMode} />
  if (!profile) return null

  return (
    <div className="space-y-4">
      <GlassCard darkMode={darkMode}>
        <div className="flex flex-col sm:flex-row gap-4 items-start">
          {profile.emblemUrl ? (
            <img
              src={profile.emblemUrl}
              alt=""
              className="w-20 h-20 rounded-xl border-2 border-amber-500/40"
            />
          ) : (
            <div className="w-20 h-20 rounded-xl bg-purple-900/50" />
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-2xl font-bold text-white">{profile.bungieDisplayName}</h3>
            <p className={cn('text-sm', t.muted)}>
              {profile.clanTag} {profile.clanName} · {platformIcon(profile.platform)} · GR{' '}
              {profile.guardianRank} · PL {profile.powerLevel}
            </p>
            <p className={cn('text-xs mt-2', t.purple)}>
              Bungie OAuth connection coming Phase 2 — showing demo profile
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              {profile.badges.map((b) => (
                <StatusPill key={b} label={b} tone="gold" />
              ))}
            </div>
          </div>
          <div className="text-right">
            <p className={cn('text-xs', t.muted)}>Reputation</p>
            <p className={cn('text-2xl font-bold flex items-center gap-1 justify-end', t.gold)}>
              <Star className="w-5 h-5" />
              {profile.reputationScore.toFixed(1)}
            </p>
          </div>
        </div>
      </GlassCard>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Raid pts', value: profile.raidPoints },
          { label: 'Dungeon pts', value: profile.dungeonPoints },
          { label: 'Clan team pts', value: profile.fullClanPoints },
          { label: 'Verified clears', value: profile.verifiedClears },
        ].map((stat) => (
          <GlassCard key={stat.label} darkMode={darkMode} className="text-center">
            <p className={cn('text-xs', t.muted)}>{stat.label}</p>
            <p className={cn('text-xl font-bold', t.gold)}>{stat.value}</p>
          </GlassCard>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GlassCard darkMode={darkMode}>
          <SectionTitle title="Top Completions" darkMode={darkMode} />
          {profile.topCompletions.map((c, i) => (
            <div key={i} className="py-2 border-b border-white/5 last:border-0 flex justify-between">
              <span className="text-white text-sm">{c.activityName}</span>
              <span className={cn('text-xs', t.gold)}>{formatDuration(c.durationSeconds)}</span>
            </div>
          ))}
        </GlassCard>

        <GlassCard darkMode={darkMode}>
          <SectionTitle title="Prize Eligibility" darkMode={darkMode} />
          <p className={cn('text-sm', t.muted)}>{profile.prizeEligibility}</p>
          <div className="mt-4">
            <p className={cn('text-xs font-semibold mb-2', t.heading)}>Favorite teammates</p>
            <div className="flex flex-wrap gap-2">
              {profile.favoriteTeammates.map((name) => (
                <StatusPill key={name} label={name} tone="blue" />
              ))}
            </div>
          </div>
        </GlassCard>
      </div>

      {profile.currentLoadout && (
        <GlassCard darkMode={darkMode}>
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-4 h-4 text-purple-400" />
            <SectionTitle title="Current Loadout" darkMode={darkMode} />
          </div>
          <p className="text-white text-sm">
            {profile.currentLoadout.subclass} {profile.currentLoadout.characterClass} ·{' '}
            {profile.currentLoadout.exoticArmor}
          </p>
          <p className={cn('text-xs mt-1', t.muted)}>
            {profile.currentLoadout.kineticWeapon} / {profile.currentLoadout.energyWeapon} /{' '}
            {profile.currentLoadout.powerWeapon}
          </p>
        </GlassCard>
      )}

      <GlassCard darkMode={darkMode}>
        <div className="flex items-center gap-2 mb-2">
          <Trophy className="w-4 h-4 text-amber-400" />
          <SectionTitle title="Recent Runs" darkMode={darkMode} />
        </div>
        {profile.recentRuns.map((run) => (
          <div key={run.id} className="py-2 border-b border-white/5 flex justify-between gap-2">
            <span className="text-white text-sm">{run.activityName}</span>
            <StatusPill label={run.verificationStatus} tone={run.verificationStatus === 'verified' ? 'green' : 'gold'} />
          </div>
        ))}
      </GlassCard>
    </div>
  )
}
