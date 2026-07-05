'use client'

import { useCallback, useEffect, useState } from 'react'
import { Mic, Users, Plus } from 'lucide-react'
import type { FireteamLobby } from '@/lib/destiny/types'
import {
  GlassCard,
  LoadingBlock,
  SectionTitle,
  StatusPill,
} from '@/app/components/destiny/DestinyUi'
import { getDestinyTheme, platformIcon } from '@/app/components/destiny/destinyTheme'
import { cn } from '@/lib/utils'

export default function FireteamPanel({ darkMode }: { darkMode: boolean }) {
  const [lobbies, setLobbies] = useState<FireteamLobby[]>([])
  const [loading, setLoading] = useState(true)
  const t = getDestinyTheme(darkMode)

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
    <div className="space-y-4">
      <GlassCard darkMode={darkMode}>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <SectionTitle
            title="Fireteam Finder"
            subtitle="Raids & dungeons only · connect Bungie account in Phase 2 to create lobbies"
            darkMode={darkMode}
          />
          <button
            type="button"
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500/20 text-amber-200 border border-amber-500/40 text-sm font-medium opacity-60 cursor-not-allowed"
            title="Requires Bungie OAuth (Phase 2)"
          >
            <Plus className="w-4 h-4" />
            Create lobby
          </button>
        </div>

        {loading ? (
          <LoadingBlock darkMode={darkMode} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {lobbies.map((lobby) => (
              <div
                key={lobby.id}
                className="rounded-xl p-4 bg-black/30 border border-white/10 hover:border-purple-500/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-white font-semibold">{lobby.activityName}</p>
                    <p className={cn('text-xs mt-0.5', t.muted)}>
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
                      {lobby.hostClass} · PL {lobby.hostPowerLevel} · GR {lobby.hostGuardianRank}
                    </p>
                  </div>
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
                  className="mt-4 w-full py-2 rounded-lg text-sm font-medium bg-purple-500/20 text-purple-200 border border-purple-500/30 opacity-60 cursor-not-allowed"
                  title="Join requires Bungie OAuth (Phase 2)"
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
