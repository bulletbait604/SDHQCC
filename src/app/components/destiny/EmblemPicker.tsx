'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { EmblemOption } from '@/lib/destiny/types'
import { CharacterEmblem, GlowIcon } from '@/app/components/destiny/destinyGameUi'
import { GlassCard, SectionTitle } from '@/app/components/destiny/DestinyUi'
import { destinySecondaryBtn, getDestinyTheme } from '@/app/components/destiny/destinyTheme'
import { cn } from '@/lib/utils'

interface Props {
  darkMode: boolean
  selectedSource?: 'equipped' | 'collection'
  selectedHash?: number | null
  onSaved?: () => void
}

export default function EmblemPicker({ darkMode, selectedSource, selectedHash, onSaved }: Props) {
  const t = getDestinyTheme(darkMode)
  const [equipped, setEquipped] = useState<EmblemOption | null>(null)
  const [collection, setCollection] = useState<EmblemOption[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/destiny/emblems', { credentials: 'include' })
      if (res.ok) {
        const json = await res.json()
        setEquipped(json.equipped ?? null)
        setCollection(json.collection ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const save = async (source: 'equipped' | 'collection', hash?: number) => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/destiny/profile', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayEmblemSource: source,
          displayEmblemHash: source === 'collection' ? hash : null,
        }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? 'Could not save emblem')
      }
      window.dispatchEvent(new Event('topnest-profile-refresh'))
      onSaved?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const isSelected = (source: 'equipped' | 'collection', hash?: number) => {
    const src = selectedSource ?? 'equipped'
    if (source === 'equipped') return src === 'equipped'
    return src === 'collection' && selectedHash === hash
  }

  return (
    <GlassCard darkMode={darkMode}>
      <SectionTitle title="Display emblem" subtitle="Equipped in-game or pick from your collection" darkMode={darkMode} />

      {loading ? (
        <p className={cn('text-sm flex items-center gap-2', t.muted)}>
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading emblems…
        </p>
      ) : (
        <div className="space-y-4">
          {equipped ? (
            <div>
              <p className={cn('text-[10px] uppercase tracking-wider mb-2', t.caption)}>Equipped now</p>
              <button
                type="button"
                disabled={saving}
                onClick={() => void save('equipped')}
                className={cn(
                  'flex items-center gap-3 rounded-xl p-2 ring-1 transition w-full text-left',
                  isSelected('equipped')
                    ? 'ring-amber-400/40 bg-amber-400/10'
                    : 'ring-white/10 hover:bg-white/[0.04]'
                )}
              >
                <CharacterEmblem
                  compact
                  backgroundUrl={equipped.backgroundUrl}
                  iconUrl={equipped.iconUrl}
                  accentColor={equipped.color}
                  title={equipped.name}
                />
                <span className={cn('text-sm font-medium', t.body)}>Use equipped emblem</span>
              </button>
            </div>
          ) : null}

          {collection.length ? (
            <div>
              <p className={cn('text-[10px] uppercase tracking-wider mb-2', t.caption)}>
                Your collection ({collection.length})
              </p>
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 max-h-48 overflow-y-auto pr-1">
                {collection.map((emblem) => (
                  <button
                    key={emblem.itemHash}
                    type="button"
                    disabled={saving || !emblem.itemHash}
                    title={emblem.name}
                    onClick={() => emblem.itemHash && void save('collection', emblem.itemHash)}
                    className={cn(
                      'rounded-lg p-1 ring-1 transition',
                      isSelected('collection', emblem.itemHash)
                        ? 'ring-amber-400/50 bg-amber-400/10'
                        : 'ring-white/10 hover:ring-white/25 hover:bg-white/[0.04]'
                    )}
                  >
                    <GlowIcon item={{ name: emblem.name, iconUrl: emblem.iconUrl }} size={40} glow="gold" className="rounded-lg mx-auto" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className={cn('text-xs', t.muted)}>No collection emblems found — equipped emblem will be used.</p>
          )}
        </div>
      )}

      {error ? <p className="text-xs text-red-300 mt-2">{error}</p> : null}

      <button type="button" disabled={loading} onClick={() => void load()} className={cn(destinySecondaryBtn(darkMode), 'mt-3 text-xs')}>
        Refresh emblems
      </button>
    </GlassCard>
  )
}
