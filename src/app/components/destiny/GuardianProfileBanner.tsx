'use client'

import type { PlayerProfile } from '@/lib/destiny/types'
import { cn } from '@/lib/utils'

interface Props {
  profile: PlayerProfile
  /** Extra stats row (GR, PL, T.R.) rendered on the banner. */
  stats?: React.ReactNode
  /** Character tiles or other content below the identity row. */
  children?: React.ReactNode
  compact?: boolean
}

/** Destiny Tracker–style wide profile header with emblem backdrop. */
export default function GuardianProfileBanner({ profile, stats, children, compact }: Props) {
  const bg =
    profile.displayEmblem?.backgroundUrl ??
    profile.emblemBackgroundUrl ??
    profile.characters?.find((c) => c.characterId === profile.activeCharacterId)?.emblemBackgroundUrl

  const icon =
    profile.displayEmblem?.iconUrl ??
    profile.emblemUrl ??
    profile.characterThumbnailUrl

  return (
    <div
      className={cn('d2-profile-banner', compact && 'd2-profile-banner-compact')}
      style={bg ? ({ '--banner-url': `url("${bg}")` } as React.CSSProperties) : undefined}
    >
      <div className="d2-profile-banner-vignette" />
      <div className="d2-profile-banner-content">
        <div className="d2-profile-identity">
          {icon ? (
            <img src={icon} alt="" className="d2-profile-avatar" />
          ) : (
            <div className="d2-profile-avatar d2-profile-avatar-fallback" />
          )}
          <div className="min-w-0 flex-1">
            <h2 className="d2-profile-name truncate">{profile.bungieDisplayName}</h2>
            <div className="flex flex-wrap items-center gap-2 mt-0.5">
              {profile.clanTag ? (
                <span className="d2-profile-clan truncate">{profile.clanTag}</span>
              ) : null}
              {profile.characterClass ? (
                <span className="d2-profile-class capitalize">{profile.characterClass}</span>
              ) : null}
              {profile.powerLevel ? (
                <span className="d2-profile-pl">{profile.powerLevel} PL</span>
              ) : null}
            </div>
          </div>
          {stats ? <div className="d2-profile-stats shrink-0">{stats}</div> : null}
        </div>
        {children}
      </div>
    </div>
  )
}
