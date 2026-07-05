'use client'

import { useState } from 'react'
import { Loader2, Star, X } from 'lucide-react'
import { getDestinyTheme } from '@/app/components/destiny/destinyTheme'
import { cn } from '@/lib/utils'

const REVIEW_FIELDS = [
  { key: 'communication', label: 'Communication' },
  { key: 'reliability', label: 'Reliability' },
  { key: 'mechanics', label: 'Mechanics' },
  { key: 'friendly', label: 'Friendly' },
  { key: 'teaching', label: 'Teaching' },
  { key: 'punctual', label: 'Punctual' },
] as const

type ReviewField = (typeof REVIEW_FIELDS)[number]['key']

interface Props {
  darkMode: boolean
  runId: string
  activityName: string
  displayName: string
  siteUserId: string
  membershipId: string
  onClose: () => void
  onSubmitted: () => void
}

export default function FireteamReviewModal({
  darkMode,
  runId,
  activityName,
  displayName,
  siteUserId,
  membershipId,
  onClose,
  onSubmitted,
}: Props) {
  const t = getDestinyTheme(darkMode)
  const [scores, setScores] = useState<Record<ReviewField, number>>({
    communication: 4,
    reliability: 4,
    mechanics: 4,
    friendly: 4,
    teaching: 4,
    punctual: 4,
  })
  const [wouldPlayAgain, setWouldPlayAgain] = useState(true)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/destiny/reputation', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewedUserId: siteUserId,
          reviewedBungieMembershipId: membershipId,
          runId,
          ...scores,
          wouldPlayAgain,
          notes: notes.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? 'Could not submit review')
      }
      onSubmitted()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submit failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        className={cn(
          'w-full max-w-md rounded-2xl p-5 ring-1 ring-white/10 shadow-2xl',
          darkMode ? 'bg-[#161922]' : 'bg-white'
        )}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 className={cn('text-lg font-semibold', t.heading)}>Rate {displayName}</h3>
            <p className={cn('text-xs mt-1', t.muted)}>
              {activityName} · 1 = poor · 5 = excellent
            </p>
          </div>
          <button type="button" onClick={onClose} className={cn('p-1 rounded-lg', t.muted)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
          {REVIEW_FIELDS.map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between gap-3">
              <span className={cn('text-sm', t.body)}>{label}</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setScores((prev) => ({ ...prev, [key]: value }))}
                    className={cn(
                      'p-1 rounded-md transition',
                      scores[key] >= value ? 'text-amber-300' : 'text-white/20'
                    )}
                  >
                    <Star className="w-4 h-4 fill-current" />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <label className="flex items-center gap-2 mt-4 cursor-pointer">
          <input
            type="checkbox"
            checked={wouldPlayAgain}
            onChange={(e) => setWouldPlayAgain(e.target.checked)}
            className="rounded"
          />
          <span className={cn('text-sm', t.body)}>Would play again</span>
        </label>

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional note (max 500 chars)"
          maxLength={500}
          rows={2}
          className={cn(
            'w-full mt-3 rounded-xl px-3 py-2 text-sm ring-1 ring-white/10 bg-black/20 resize-none',
            t.body
          )}
        />

        {error ? <p className="text-xs text-red-300 mt-2">{error}</p> : null}

        <div className="flex gap-2 mt-4">
          <button
            type="button"
            disabled={saving}
            onClick={() => void submit()}
            className={cn(
              'flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium',
              'bg-amber-400/20 text-amber-100 ring-1 ring-amber-400/30 hover:bg-amber-400/30'
            )}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Submit review
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className={cn('px-4 py-2.5 rounded-xl text-sm ring-1 ring-white/10', t.muted)}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
