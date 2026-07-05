'use client'

import { useCallback, useEffect, useState } from 'react'
import { Mic, Users, Plus } from 'lucide-react'
import FireteamReviewSection from '@/app/components/destiny/FireteamReviewSection'
import { useBungieLink } from '@/hooks/useBungieLink'
import type { FireteamLobby } from '@/lib/destiny/types'
import {
  ActivityBadge,
  EmptyBlock,
  GlassCard,
  ItemIcon,
  LoadingBlock,
  PageIntro,
  StatusPill,
} from '@/app/components/destiny/DestinyUi'
import { getDestinyTheme, destinySecondaryBtn, platformIcon } from '@/app/components/destiny/destinyTheme'
import { cn } from '@/lib/utils'

export default function FireteamPanel({ darkMode }: { darkMode: boolean }) {
  const [lobbies, setLobbies] = useState<FireteamLobby[]>([])
  const [loading, setLoading] = useState(true)
  const t = getDestinyTheme(darkMode)
  const bungie = useBungieLink()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/destiny/fireteam', { credentials: 'include' })
      if (res.ok) {
        const json = await res.json()
        setLobbies(json.lobbies ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="space-y-6">
      <PageIntro
        darkMode={darkMode}
        title="Find a fireteam"
        description="Browse open raid and dungeon lobbies. Connect Bungie on Home to create your own."
      />

      <FireteamReviewSection darkMode={darkMode} linked={bungie.linked} />

      <GlassCard darkMode={darkMode}>
        <div className="flex flex-wrap items-center justify-end gap-3 mb-6">
          <button
            type="button"
            disabled
            className={cn(destinySecondaryBtn(darkMode), 'opacity-50 cursor-not-allowed')}
            title="Connect Bungie first"
          >
            <Plus className="w-4 h-4" />
            Create lobby
          </button>
        </div>

        {loading ? (
          <LoadingBlock darkMode={darkMode} />
        ) : lobbies.length === 0 ? (
          <EmptyBlock
            darkMode={darkMode}
            message="No open lobbies right now"
            hint="Check back after reset, or create one when Bungie is connected."
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {lobbies.map((lobby) => (
              <div
                key={lobby.id}
                className={cn('rounded-2xl p-5 transition-colors', t.glassInset, 'hover:bg-white/[0.04]')}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <ActivityBadge
                      activityRef={lobby.activityRef}
                      name={lobby.activityName}
                      darkMode={darkMode}
                      size={36}
                    />
                    <p className={cn('text-xs mt-1', t.muted)}>
                      {lobby.activityType.replace(/_/g, ' ')} · {lobby.goal.replace(/_/g, ' ')}
                    </p>
                  </div>
                  <StatusPill label={lobby.status} tone="blue" />
                </div>

                <div className="flex items-center gap-3 mt-3">
                  {lobby.hostEmblemUrl ? (
                    <img src={lobby.hostEmblemUrl} alt="" className="w-10 h-10 rounded-full border border-amber-500/30" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-purple-900/50" />
                  )}
                  <div>
                    <p className="text-sm text-white">{lobby.hostDisplayName}</p>
                    <p className={cn('text-xs', t.muted)}>
                      PL {lobby.hostPowerLevel} · GR {lobby.hostGuardianRank} ·{' '}
                      {lobby.goal.replace(/_/g, ' ')}
                    </p>
                  </div>
                  {lobby.hostClassRef && <ItemIcon item={lobby.hostClassRef} size={28} className="rounded-full" />}
                </div>

                <div className="flex flex-wrap gap-2 mt-3">
                  <span className={cn('text-xs flex items-center gap-1', t.blue)}>
                    <Users className="w-3 h-3" />
                    {lobby.currentPlayers}/{lobby.maxPlayers}
                  </span>
                  <span className={cn('text-xs', t.muted)}>{platformIcon(lobby.platform)}</span>
                  {lobby.micRequired && (
                    <span className={cn('text-xs flex items-center gap-1', t.gold)}>
                      <Mic className="w-3 h-3" /> Mic
                    </span>
                  )}
                  {lobby.scoringEligible && <StatusPill label="Scoring eligible" tone="green" />}
                </div>

                <div className="flex flex-wrap gap-1 mt-3">
                  {lobby.tags.map((tag) => (
                    <StatusPill key={tag} label={tag} tone="purple" />
                  ))}
                </div>

                <button
                  type="button"
                  disabled
                  className={cn(destinySecondaryBtn(darkMode), 'mt-4 w-full opacity-50 cursor-not-allowed')}
                  title="Connect Bungie first"
                >
                  Request invite
                </button>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  )
}
