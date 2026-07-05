'use client'

import { useCallback, useEffect, useState } from 'react'
import { Star, Trophy, Unlink, Loader2 } from 'lucide-react'
import type { PlayerProfile } from '@/lib/destiny/types'
import BungieConnectBanner from '@/app/components/destiny/BungieConnectBanner'
import {
  GearStrip,
  GlassCard,
  ItemIcon,
  LoadingBlock,
  SectionTitle,
  StatusPill,
  SubclassBadge,
} from '@/app/components/destiny/DestinyUi'
import { formatDuration, getDestinyTheme, platformIcon } from '@/app/components/destiny/destinyTheme'
import { useBungieLink } from '@/hooks/useBungieLink'
import { cn } from '@/lib/utils'

export default function ProfilePanel({ darkMode }: { darkMode: boolean }) {
  const [profile, setProfile] = useState<PlayerProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const bungie = useBungieLink()
  const t = getDestinyTheme(darkMode)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const profileRes = await fetch('/api/destiny/profile', { credentials: 'include' })
      if (profileRes.ok) {
        const profileJson = await profileRes.json()
        setProfile(profileJson?.profile ?? null)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load, bungie.linked])

  if (loading) return <LoadingBlock darkMode={darkMode} />
  if (!profile) return null

  const linked = bungie.linked

  return (
    <div className="space-y-8">
      {!linked && <BungieConnectBanner darkMode={darkMode} bungie={bungie} variant="compact" showSync={false} />}

      {linked && (
        <GlassCard darkMode={darkMode}>
          <div className="flex flex-wrap items-center gap-3">
            <StatusPill label={`Linked as ${bungie.status?.bungieDisplayName ?? profile.bungieDisplayName}`} tone="green" />
            <span className={cn('text-xs', t.muted)}>Manage sign-in from Overview</span>
            <button
              type="button"
              disabled={bungie.disconnecting}
              onClick={() => void bungie.disconnect()}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-red-500/40 text-red-300 bg-red-500/10"
            >
              {bungie.disconnecting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Unlink className="w-3 h-3" />}
              Disconnect
            </button>
          </div>
        </GlassCard>
      )}

      <GlassCard darkMode={darkMode}>
        <div className="flex flex-col sm:flex-row gap-4 items-start">
          {profile.emblemUrl ? (
            <img
              src={profile.emblemUrl}
              alt=""
              className="w-20 h-20 rounded-xl border-2 border-amber-500/40 object-cover"
            />
          ) : (
            <div className="w-20 h-20 rounded-xl bg-purple-900/50" />
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-2xl font-bold text-white">{profile.bungieDisplayName}</h3>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {profile.classRef && <ItemIcon item={profile.classRef} size={24} className="rounded-full" />}
              <p className={cn('text-sm', t.muted)}>
                {profile.clanTag} {profile.clanName} · {platformIcon(profile.platform)} · GR{' '}
                {profile.guardianRank} · PL {profile.powerLevel}
              </p>
            </div>
            <p className={cn('text-xs mt-2', t.purple)}>
              {linked ? 'Live Bungie profile data' : 'Sign in with Bungie on Overview to sync your Guardian'}
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
          <SectionTitle title="Current Loadout" darkMode={darkMode} />
          <SubclassBadge
            classRef={profile.currentLoadout.classRef}
            subclassRef={profile.currentLoadout.subclassRef}
            characterClass={profile.currentLoadout.characterClass}
            subclass={profile.currentLoadout.subclass}
            darkMode={darkMode}
          />
          <div className="mt-3">
            <GearStrip
              darkMode={darkMode}
              items={[
                profile.currentLoadout.exoticArmorRef,
                profile.currentLoadout.kineticWeaponRef,
                profile.currentLoadout.energyWeaponRef,
                profile.currentLoadout.powerWeaponRef,
                profile.currentLoadout.exoticWeaponRef,
              ]}
            />
          </div>
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
