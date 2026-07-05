'use client'

import { Star } from 'lucide-react'
import type { PlayerProfile } from '@/lib/destiny/types'
import { ItemIcon, StatusPill } from '@/app/components/destiny/DestinyUi'
import { platformIcon } from '@/app/components/destiny/destinyTheme'
import { cn } from '@/lib/utils'

interface Props {
  profile: PlayerProfile
  darkMode: boolean
  linked?: boolean
}

export default function GuardianHeroCard({ profile, darkMode, linked = true }: Props) {
  const bannerUrl = profile.emblemBackgroundUrl ?? profile.emblemUrl
  const accent = profile.emblemColor ?? 'rgba(120, 90, 40, 0.35)'

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl ring-1 ring-white/10',
        darkMode ? 'bg-[#12141c]' : 'bg-slate-900'
      )}
    >
      <div className="absolute inset-0">
        {bannerUrl ? (
          <img src={bannerUrl} alt="" className="h-full w-full object-cover opacity-50" />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-slate-800 to-slate-950" />
        )}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, ${accent} 0%, rgba(0,0,0,0.75) 55%, rgba(0,0,0,0.92) 100%)`,
          }}
        />
      </div>

      <div className="relative p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row gap-5 items-start">
          <div className="flex items-end gap-3 shrink-0">
            {profile.emblemUrl ? (
              <img
                src={profile.emblemUrl}
                alt=""
                className="w-24 h-24 rounded-2xl ring-2 ring-white/20 object-cover shadow-lg"
              />
            ) : (
              <div className="w-24 h-24 rounded-2xl bg-white/10 ring-2 ring-white/10" />
            )}
            {profile.characterThumbnailUrl && (
              <img
                src={profile.characterThumbnailUrl}
                alt=""
                title="Equipped helmet"
                className="w-14 h-14 rounded-xl ring-1 ring-white/15 object-cover bg-black/30 -ml-8 mb-1 shadow-md"
              />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              {profile.classRef && (
                <ItemIcon item={profile.classRef} size={28} className="rounded-full" />
              )}
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white drop-shadow-sm">
                {profile.bungieDisplayName}
              </h2>
            </div>

            <p className="text-sm text-white/60 flex flex-wrap items-center gap-x-2 gap-y-1">
              {profile.clanTag && profile.clanName ? (
                <span>
                  {profile.clanTag} {profile.clanName}
                </span>
              ) : null}
              {profile.clanName && profile.clanTag ? <span>·</span> : null}
              <span>{platformIcon(profile.platform)}</span>
              {linked ? (
                <span className="text-emerald-300/80">Live Bungie data</span>
              ) : (
                <span>Connect Bungie on Home to sync</span>
              )}
            </p>

            {profile.flexStats && profile.flexStats.length > 0 && (
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
                {profile.flexStats.map((stat) => (
                  <div
                    key={stat.id}
                    className="rounded-xl bg-black/30 backdrop-blur-sm ring-1 ring-white/10 px-3 py-2"
                  >
                    <p className="text-[10px] uppercase tracking-wide text-white/45">{stat.label}</p>
                    <p className="text-lg font-semibold tabular-nums text-amber-200/95">{stat.value}</p>
                    {stat.detail ? (
                      <p className="text-[10px] text-white/40 truncate mt-0.5">{stat.detail}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}

            {profile.badges.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {profile.badges.map((badge) => (
                  <StatusPill key={badge} label={badge} tone="gold" />
                ))}
              </div>
            )}
          </div>

          <div className="sm:text-right shrink-0">
            <p className="text-xs text-white/45">Reputation</p>
            <p className="text-2xl font-semibold flex items-center gap-1 sm:justify-end text-amber-200/95">
              <Star className="w-5 h-5" />
              {profile.reputationScore.toFixed(1)}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
