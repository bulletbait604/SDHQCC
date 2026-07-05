'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, Loader2, SlidersHorizontal } from 'lucide-react'
import type { ProfileFlexStatId } from '@/lib/destiny/types'
import {
  DEFAULT_PROFILE_FLEX_STATS,
  MAX_PROFILE_FLEX_STATS,
  STAT_CARD_GROUPS,
  STAT_CARD_LABELS,
} from '@/lib/destiny/profileFlex'
import { GlassCard, SectionTitle } from '@/app/components/destiny/DestinyUi'
import { getDestinyTheme } from '@/app/components/destiny/destinyTheme'
import { cn } from '@/lib/utils'

interface Props {
  darkMode: boolean
  initialSelection: ProfileFlexStatId[]
  onSaved?: (selection: ProfileFlexStatId[]) => void
}

export default function StatCardEditor({ darkMode, initialSelection, onSaved }: Props) {
  const t = getDestinyTheme(darkMode)
  const [open, setOpen] = useState(false)
  const [selection, setSelection] = useState<ProfileFlexStatId[]>(initialSelection)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setSelection(initialSelection)
  }, [initialSelection])

  const toggle = useCallback((id: ProfileFlexStatId) => {
    setSelection((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id)
      }
      if (prev.length >= MAX_PROFILE_FLEX_STATS) return prev
      return [...prev, id]
    })
    setError(null)
  }, [])

  const save = useCallback(async () => {
    if (!selection.length) {
      setError('Pick at least one stat for your card.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/destiny/profile', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileFlexStats: selection }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? 'Could not save stat card')
      }
      const json = await res.json()
      const saved = (json.profileFlexStats ?? selection) as ProfileFlexStatId[]
      setSelection(saved)
      onSaved?.(saved)
      window.dispatchEvent(new Event('topnest-profile-refresh'))
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }, [onSaved, selection])

  const reset = useCallback(() => {
    setSelection([...DEFAULT_PROFILE_FLEX_STATS])
    setError(null)
  }, [])

  return (
    <GlassCard darkMode={darkMode}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <SectionTitle
            title="Stat card"
            subtitle="Choose up to four stats on your Guardian card — Bungie live + Top Nest"
            darkMode={darkMode}
          />
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs shrink-0',
            'ring-1 ring-white/10 bg-white/[0.04] hover:bg-white/[0.08]',
            t.body
          )}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          {open ? 'Close' : 'Customize'}
        </button>
      </div>

      {open && (
        <div className="mt-4 space-y-4">
          <p className={cn('text-xs', t.muted)}>
            Selected {selection.length}/{MAX_PROFILE_FLEX_STATS}
          </p>
          {STAT_CARD_GROUPS.map((group) => (
            <div key={group.label}>
              <p className={cn('text-[10px] uppercase tracking-wide mb-2', t.caption)}>{group.label}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {group.ids.map((id) => {
                  const active = selection.includes(id)
                  const disabled = !active && selection.length >= MAX_PROFILE_FLEX_STATS
                  return (
                    <button
                      key={id}
                      type="button"
                      disabled={disabled}
                      onClick={() => toggle(id)}
                      className={cn(
                        'flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition',
                        'ring-1',
                        active
                          ? 'ring-amber-400/40 bg-amber-400/10 text-amber-100'
                          : 'ring-white/10 bg-white/[0.03] hover:bg-white/[0.06]',
                        disabled && 'opacity-40 cursor-not-allowed'
                      )}
                    >
                      <span>{STAT_CARD_LABELS[id]}</span>
                      {active ? <Check className="w-4 h-4 shrink-0" /> : null}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          {error ? <p className="text-xs text-red-300">{error}</p> : null}

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              disabled={saving}
              onClick={() => void save()}
              className={cn(
                'inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium',
                'bg-amber-400/20 text-amber-100 ring-1 ring-amber-400/30 hover:bg-amber-400/30'
              )}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Save stat card
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={reset}
              className={cn(
                'px-4 py-2 rounded-xl text-sm',
                'ring-1 ring-white/10 bg-white/[0.04] hover:bg-white/[0.08]',
                t.muted
              )}
            >
              Reset defaults
            </button>
          </div>
        </div>
      )}
    </GlassCard>
  )
}
