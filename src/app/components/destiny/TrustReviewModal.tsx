'use client'

import { useState } from 'react'
import { Loader2, X } from 'lucide-react'
import {
  KNOWLEDGE_VOTE_LABELS,
  VIBES_VOTE_LABELS,
  type KnowledgeScore,
  type VibesScore,
} from '@/lib/destiny/trustRank'
import { getDestinyTheme } from '@/app/components/destiny/destinyTheme'
import { cn } from '@/lib/utils'

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

export default function TrustReviewModal({
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
  const [knowledge, setKnowledge] = useState<KnowledgeScore>(2)
  const [vibes, setVibes] = useState<VibesScore>(2)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/destiny/trust', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewedUserId: siteUserId,
          reviewedBungieMembershipId: membershipId,
          runId,
          knowledge,
          vibes,
        }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? 'Could not submit commend')
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
          'w-full max-w-lg rounded-2xl p-5 ring-1 ring-white/10 shadow-2xl',
          darkMode ? 'bg-[#161922]' : 'bg-white'
        )}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 className={cn('text-lg font-semibold', t.heading)}>Trust Rank — {displayName}</h3>
            <p className={cn('text-xs mt-1', t.muted)}>
              {activityName} · Commend this rando with Knowledge + Vibes
            </p>
          </div>
          <button type="button" onClick={onClose} className={cn('p-1 rounded-lg', t.muted)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <p className={cn('text-xs font-semibold uppercase tracking-wide mb-2', t.gold)}>Knowledge</p>
            <div className="space-y-2">
              {([1, 2, 3] as KnowledgeScore[]).map((score) => (
                <button
                  key={score}
                  type="button"
                  onClick={() => setKnowledge(score)}
                  className={cn(
                    'w-full text-left rounded-xl px-3 py-2 text-sm ring-1 transition',
                    knowledge === score
                      ? 'ring-amber-400/40 bg-amber-400/10 text-amber-100'
                      : 'ring-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
                  )}
                >
                  {score}. {KNOWLEDGE_VOTE_LABELS[score]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className={cn('text-xs font-semibold uppercase tracking-wide mb-2', t.purple)}>Vibes</p>
            <div className="space-y-2">
              {([1, 2, 3] as VibesScore[]).map((score) => (
                <button
                  key={score}
                  type="button"
                  onClick={() => setVibes(score)}
                  className={cn(
                    'w-full text-left rounded-xl px-3 py-2 text-sm ring-1 transition',
                    vibes === score
                      ? 'ring-violet-400/40 bg-violet-400/10 text-violet-100'
                      : 'ring-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
                  )}
                >
                  {score}. {VIBES_VOTE_LABELS[score]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error ? <p className="text-xs text-red-300 mt-3">{error}</p> : null}

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
            Submit commend
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
