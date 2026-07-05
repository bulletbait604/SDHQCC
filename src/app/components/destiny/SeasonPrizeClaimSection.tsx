'use client'

import { useState } from 'react'
import { Gift, Loader2 } from 'lucide-react'
import type { DestinyPlatform, LeaderboardCategory, PrizeClaim } from '@/lib/destiny/types'
import type { UserPrizeTrackEntry } from '@/lib/destiny/seasonPrizes'
import { GlassCard, SectionTitle, StatusPill } from '@/app/components/destiny/DestinyUi'
import { getDestinyTheme, platformIcon } from '@/app/components/destiny/destinyTheme'
import { cn } from '@/lib/utils'

const CATEGORY_LABELS: Record<LeaderboardCategory, string> = {
  raid: 'Raid',
  dungeon: 'Dungeon',
  full_clan_team: 'Full clan team',
}

interface Props {
  darkMode: boolean
  prizeEligible: UserPrizeTrackEntry[]
  prizeClaims: PrizeClaim[]
  seasonEnded: boolean
  onClaimed: () => void
}

export default function SeasonPrizeClaimSection({
  darkMode,
  prizeEligible,
  prizeClaims,
  seasonEnded,
  onClaimed,
}: Props) {
  const t = getDestinyTheme(darkMode)
  const [category, setCategory] = useState<LeaderboardCategory | ''>(
    prizeEligible[0]?.category ?? ''
  )
  const [platform, setPlatform] = useState<DestinyPlatform>('steam')
  const [contact, setContact] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!prizeEligible.length && !prizeClaims.length) return null

  const submit = async () => {
    if (!category) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/destiny/season/claim', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, platform, contact: contact.trim() }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? 'Could not submit claim')
      }
      setContact('')
      onClaimed()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submit failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <GlassCard darkMode={darkMode}>
      <div className="flex items-center gap-2 mb-3">
        <Gift className="w-4 h-4 text-amber-400" />
        <SectionTitle
          title="Prize claim"
          subtitle={
            seasonEnded
              ? 'Season ended — submit how to receive your prize'
              : 'Pre-register your prize while holding a winning rank'
          }
          darkMode={darkMode}
        />
      </div>

      {prizeClaims.length > 0 && (
        <div className="space-y-2 mb-4">
          {prizeClaims.map((claim) => (
            <div
              key={claim.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl ring-1 ring-white/10 bg-white/[0.03] px-3 py-2"
            >
              <div>
                <p className={cn('text-sm', t.body)}>
                  {CATEGORY_LABELS[claim.category]} #{claim.rank}
                </p>
                <p className={cn('text-xs', t.muted)}>{claim.prize}</p>
              </div>
              <StatusPill
                label={claim.status}
                tone={claim.status === 'fulfilled' ? 'green' : claim.status === 'rejected' ? 'red' : 'gold'}
              />
            </div>
          ))}
        </div>
      )}

      {prizeEligible.some(
        (track) => !prizeClaims.some((c) => c.category === track.category && c.status !== 'rejected')
      ) && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className={cn('text-xs', t.caption)}>Category</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as LeaderboardCategory)}
                className={cn(
                  'mt-1 w-full rounded-xl px-3 py-2 text-sm ring-1 ring-white/10 bg-black/20',
                  t.body
                )}
              >
                {prizeEligible.map((track) => (
                  <option key={track.category} value={track.category}>
                    {CATEGORY_LABELS[track.category]} #{track.rank} — {track.prizeIfHeld}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={cn('text-xs', t.caption)}>Platform</span>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value as DestinyPlatform)}
                className={cn(
                  'mt-1 w-full rounded-xl px-3 py-2 text-sm ring-1 ring-white/10 bg-black/20',
                  t.body
                )}
              >
                {(['steam', 'xbox', 'playstation', 'epic'] as DestinyPlatform[]).map((p) => (
                  <option key={p} value={p}>
                    {platformIcon(p)} {p}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block">
            <span className={cn('text-xs', t.caption)}>Contact (Kick username, email, or Discord)</span>
            <input
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              maxLength={120}
              placeholder="How staff should reach you"
              className={cn(
                'mt-1 w-full rounded-xl px-3 py-2 text-sm ring-1 ring-white/10 bg-black/20',
                t.body
              )}
            />
          </label>
          {error ? <p className="text-xs text-red-300">{error}</p> : null}
          <button
            type="button"
            disabled={saving || !contact.trim() || !category}
            onClick={() => void submit()}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium',
              'bg-amber-400/20 text-amber-100 ring-1 ring-amber-400/30 hover:bg-amber-400/30 disabled:opacity-50'
            )}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Submit prize claim
          </button>
        </div>
      )}
    </GlassCard>
  )
}
