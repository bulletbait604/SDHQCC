'use client'

import { useCallback, useEffect, useState } from 'react'
import { Star, Trophy, Link2, Unlink, Loader2 } from 'lucide-react'
import type { PlayerProfile } from '@/lib/destiny/types'
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
import { defaultBungieReturnPath, stripUrlParams } from '@/lib/home/tabUrl'
import { bungieOAuthErrorMessage } from '@/lib/destiny/bungieOAuthMessages'
import { cn } from '@/lib/utils'

interface BungieLinkStatus {
  configured: boolean
  linked: boolean
  bungieDisplayName?: string
  connectedAt?: string
  redirectUri?: string
}

export default function ProfilePanel({ darkMode }: { darkMode: boolean }) {
  const [profile, setProfile] = useState<PlayerProfile | null>(null)
  const [bungieStatus, setBungieStatus] = useState<BungieLinkStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [disconnecting, setDisconnecting] = useState(false)
  const [linkMessage, setLinkMessage] = useState<string | null>(null)
  const [connectHref, setConnectHref] = useState(
    `/api/destiny/auth/bungie/start?return=${encodeURIComponent(defaultBungieReturnPath())}`
  )
  const t = getDestinyTheme(darkMode)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [profileRes, statusRes] = await Promise.all([
        fetch('/api/destiny/profile', { credentials: 'include' }),
        fetch('/api/destiny/auth/bungie/status', { credentials: 'include' }),
      ])

      let profileJson: { profile?: PlayerProfile; bungieLinked?: boolean } | null = null
      if (profileRes.ok) {
        profileJson = await profileRes.json()
        setProfile(profileJson?.profile ?? null)
      }

      let status: BungieLinkStatus | null = null
      if (statusRes.ok) {
        status = await statusRes.json()
      }

      if (profileJson?.bungieLinked && !status?.linked) {
        status = {
          configured: status?.configured ?? true,
          linked: true,
          bungieDisplayName: profileJson.profile?.bungieDisplayName,
          connectedAt: profileJson.profile?.connectedAt,
        }
      }

      if (status) setBungieStatus(status)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const current = window.location.pathname + window.location.search
    setConnectHref(`/api/destiny/auth/bungie/start?return=${encodeURIComponent(current)}`)

    const params = new URLSearchParams(window.location.search)
    const bungie = params.get('bungie')
    if (bungie === 'linked') setLinkMessage('Bungie account linked successfully.')
    if (bungie === 'error') {
      const msg = params.get('message')
      setLinkMessage(
        msg ? `Bungie linking failed: ${bungieOAuthErrorMessage(msg)}` : 'Bungie linking failed. Try again.'
      )
    }
    if (bungie) stripUrlParams(['bungie', 'message'])
  }, [load])

  function handleConnect() {
    window.location.href = connectHref
  }

  async function disconnect() {
    setDisconnecting(true)
    try {
      await fetch('/api/destiny/auth/bungie/disconnect', {
        method: 'POST',
        credentials: 'include',
      })
      await load()
      setLinkMessage('Bungie account disconnected.')
    } finally {
      setDisconnecting(false)
    }
  }

  if (loading) return <LoadingBlock darkMode={darkMode} />
  if (!profile) return null

  const linked = bungieStatus?.linked ?? false

  return (
    <div className="space-y-4">
      {linkMessage && (
        <div
          className={cn(
            'rounded-xl p-3 text-sm border',
            linkMessage.includes('failed') || linkMessage.includes('expired')
              ? 'bg-red-500/10 border-red-500/30 text-red-200'
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
          )}
        >
          {linkMessage}
        </div>
      )}

      <GlassCard darkMode={darkMode}>
        <SectionTitle
          title="Bungie Account"
          subtitle={
            linked
              ? 'Connected — profile and loadouts use your linked Guardian'
              : 'Link your Bungie account to pull your real Guardian data'
          }
          darkMode={darkMode}
        />
        {!bungieStatus?.configured ? (
          <p className={cn('text-xs', t.muted)}>
            OAuth not configured on server. Add BUNGIE_OAUTH_CLIENT_ID, BUNGIE_OAUTH_CLIENT_SECRET, and DESTINY_API.
          </p>
        ) : linked ? (
          <div className="flex flex-wrap items-center gap-3">
            <StatusPill label={`Linked as ${bungieStatus.bungieDisplayName}`} tone="green" />
            {bungieStatus.connectedAt && (
              <span className={cn('text-xs', t.muted)}>
                Since {new Date(bungieStatus.connectedAt).toLocaleString()}
              </span>
            )}
            <button
              type="button"
              disabled={disconnecting}
              onClick={disconnect}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-red-500/40 text-red-300 bg-red-500/10"
            >
              {disconnecting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Unlink className="w-3 h-3" />}
              Disconnect
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <button
              type="button"
              onClick={handleConnect}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-amber-500/20 text-amber-100 border border-amber-500/40 hover:bg-amber-500/30"
            >
              <Link2 className="w-4 h-4" />
              Connect Bungie Account
            </button>
            {bungieStatus.redirectUri && (
              <p className={cn('text-xs break-all', t.muted)}>
                Bungie redirect URL (must match your Bungie app exactly):{' '}
                <span className="text-amber-200/90">{bungieStatus.redirectUri}</span>
              </p>
            )}
          </div>
        )}
      </GlassCard>
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
              {linked ? 'Live Bungie profile data' : 'Connect Bungie above to replace demo stats with your Guardian'}
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
