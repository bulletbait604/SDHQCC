'use client'

import { useCallback, useEffect, useState } from 'react'
import type { PlayerProfile } from '@/lib/destiny/types'
import PlayerCard from '@/app/components/destiny/PlayerCard'
import { useBungieLink } from '@/hooks/useBungieLink'

interface Props {
  darkMode: boolean
  onProfileLoaded?: (profile: PlayerProfile | null) => void
}

/** Persistent player card — fetches profile once for Top Nest shell. */
export default function PlayerCardShell({ darkMode, onProfileLoaded }: Props) {
  const [profile, setProfile] = useState<PlayerProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const bungie = useBungieLink()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/destiny/profile', { credentials: 'include' })
      if (res.ok) {
        const json = await res.json()
        const p = (json.profile ?? null) as PlayerProfile | null
        setProfile(p)
        onProfileLoaded?.(p)
      } else {
        setProfile(null)
        onProfileLoaded?.(null)
      }
    } finally {
      setLoading(false)
    }
  }, [onProfileLoaded])

  useEffect(() => {
    void load()
  }, [load, bungie.linked])

  useEffect(() => {
    const onRefresh = () => void load()
    window.addEventListener('topnest-profile-refresh', onRefresh)
    return () => window.removeEventListener('topnest-profile-refresh', onRefresh)
  }, [load])

  return (
    <div className="mb-6">
      <PlayerCard
        profile={profile}
        darkMode={darkMode}
        linked={bungie.linked}
        loading={loading}
      />
    </div>
  )
}
