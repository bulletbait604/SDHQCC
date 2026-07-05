'use client'

import { useCallback, useEffect, useState } from 'react'
import { ShieldAlert, Check, X, Trophy, Gift, Loader2 } from 'lucide-react'
import type { AdminReviewRecord, PrizeClaim, SeasonWinner } from '@/lib/destiny/types'
import {
  GlassCard,
  LoadingBlock,
  SectionTitle,
  StatusPill,
} from '@/app/components/destiny/DestinyUi'
import { formatDuration, getDestinyTheme } from '@/app/components/destiny/destinyTheme'
import { cn } from '@/lib/utils'

export default function AdminPanel({ darkMode }: { darkMode: boolean }) {
  const [queue, setQueue] = useState<AdminReviewRecord[]>([])
  const [pendingClaims, setPendingClaims] = useState<PrizeClaim[]>([])
  const [hallPreview, setHallPreview] = useState<SeasonWinner[]>([])
  const [canFinalize, setCanFinalize] = useState(false)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)
  const [finalizing, setFinalizing] = useState(false)
  const t = getDestinyTheme(darkMode)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [reviewRes, seasonRes] = await Promise.all([
        fetch('/api/destiny/admin/review', { credentials: 'include' }),
        fetch('/api/destiny/admin/season', { credentials: 'include' }),
      ])
      if (reviewRes.ok) {
        const json = await reviewRes.json()
        setQueue(json.queue ?? [])
      }
      if (seasonRes.ok) {
        const json = await seasonRes.json()
        setPendingClaims(json.pendingClaims ?? [])
        setHallPreview(json.hallOfFamePreview ?? [])
        setCanFinalize(Boolean(json.canFinalize))
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function decide(reviewId: string, decision: string) {
    setActing(reviewId)
    try {
      await fetch('/api/destiny/admin/review', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewId, decision }),
      })
      setQueue((q) => q.filter((r) => r.id !== reviewId))
    } finally {
      setActing(null)
    }
  }

  async function finalizeSeason() {
    setFinalizing(true)
    try {
      await fetch('/api/destiny/admin/season', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'finalize' }),
      })
      await load()
    } finally {
      setFinalizing(false)
    }
  }

  async function updateClaim(claimId: string, claimStatus: 'fulfilled' | 'rejected') {
    setActing(claimId)
    try {
      await fetch('/api/destiny/admin/season', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_claim', claimId, claimStatus }),
      })
      setPendingClaims((claims) => claims.filter((c) => c.id !== claimId))
    } finally {
      setActing(null)
    }
  }

  if (loading) return <LoadingBlock darkMode={darkMode} />

  return (
    <div className="space-y-4">
      <GlassCard darkMode={darkMode}>
        <div className="flex items-center gap-2 mb-2">
          <Trophy className="w-5 h-5 text-amber-400" />
          <SectionTitle
            title="Season finalization"
            subtitle="Lock hall of fame winners and stop live season scoring"
            darkMode={darkMode}
          />
        </div>
        {canFinalize ? (
          <button
            type="button"
            disabled={finalizing}
            onClick={() => void finalizeSeason()}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium',
              'bg-amber-400/20 text-amber-100 ring-1 ring-amber-400/30'
            )}
          >
            {finalizing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Finalize season & lock winners
          </button>
        ) : (
          <p className={t.muted}>Season already archived — winners are locked.</p>
        )}
        {hallPreview.length > 0 && (
          <div className="mt-4 space-y-1">
            <p className={cn('text-xs font-medium', t.caption)}>Current leaders preview</p>
            {hallPreview.slice(0, 6).map((w, i) => (
              <p key={i} className={cn('text-xs', t.muted)}>
                #{w.rank} {w.displayName} · {w.category.replace(/_/g, ' ')}
              </p>
            ))}
          </div>
        )}
      </GlassCard>

      <GlassCard darkMode={darkMode}>
        <div className="flex items-center gap-2 mb-2">
          <Gift className="w-5 h-5 text-purple-400" />
          <SectionTitle title="Pending prize claims" darkMode={darkMode} />
        </div>
        {!pendingClaims.length ? (
          <p className={t.muted}>No pending prize claims.</p>
        ) : (
          <div className="space-y-3">
            {pendingClaims.map((claim) => (
              <div key={claim.id} className="rounded-xl p-4 bg-black/30 border border-purple-500/20">
                <p className="text-white font-semibold">
                  {claim.userId} · {claim.category.replace(/_/g, ' ')} #{claim.rank}
                </p>
                <p className={cn('text-xs mt-1', t.muted)}>{claim.prize}</p>
                <p className={cn('text-xs mt-1', t.body)}>
                  {claim.platform} · {claim.contact}
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <button
                    type="button"
                    disabled={acting === claim.id}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs bg-emerald-500/20 text-emerald-200 border border-emerald-500/40"
                    onClick={() => void updateClaim(claim.id, 'fulfilled')}
                  >
                    <Check className="w-3 h-3" /> Fulfilled
                  </button>
                  <button
                    type="button"
                    disabled={acting === claim.id}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs bg-red-500/20 text-red-200 border border-red-500/40"
                    onClick={() => void updateClaim(claim.id, 'rejected')}
                  >
                    <X className="w-3 h-3" /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      <GlassCard darkMode={darkMode}>
        <div className="flex items-center gap-2 mb-2">
          <ShieldAlert className="w-5 h-5 text-red-400" />
          <SectionTitle
            title="Admin Review"
            subtitle="Flagged runs · AI risk scores · manual approve/reject"
            darkMode={darkMode}
          />
        </div>

        {!queue.length ? (
          <p className={t.muted}>No runs pending review.</p>
        ) : (
          <div className="space-y-3">
            {queue.map((review) => {
              const run = review.run
              return (
                <div
                  key={review.id}
                  className="rounded-xl p-4 bg-black/30 border border-red-500/20"
                >
                  <div className="flex flex-wrap justify-between gap-2">
                    <div>
                      <p className="text-white font-semibold">{run?.activityName ?? 'Unknown activity'}</p>
                      <p className={cn('text-xs', t.muted)}>
                        PGCR {run?.pgcrId} · {run?.durationSeconds ? formatDuration(run.durationSeconds) : '—'}
                      </p>
                    </div>
                    <StatusPill
                      label={`Suspicious ${review.suspiciousScore}`}
                      tone={review.suspiciousScore >= 70 ? 'red' : 'gold'}
                    />
                  </div>
                  <p className={cn('text-sm mt-2', t.muted)}>{review.aiSummary}</p>
                  {run?.aiReview && (
                    <p className={cn('text-xs mt-1', t.purple)}>
                      AI: {run.aiReview.recommendation} — {run.aiReview.reasons.join('; ')}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 mt-4">
                    <button
                      type="button"
                      disabled={acting === review.id}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs bg-emerald-500/20 text-emerald-200 border border-emerald-500/40"
                      onClick={() => decide(review.id, 'approve')}
                    >
                      <Check className="w-3 h-3" /> Approve
                    </button>
                    <button
                      type="button"
                      disabled={acting === review.id}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs bg-red-500/20 text-red-200 border border-red-500/40"
                      onClick={() => decide(review.id, 'reject')}
                    >
                      <X className="w-3 h-3" /> Reject
                    </button>
                    <button
                      type="button"
                      disabled={acting === review.id}
                      className="px-3 py-1.5 rounded-lg text-xs bg-white/5 text-gray-300 border border-white/10"
                      onClick={() => decide(review.id, 'checkpoint_non_scoring')}
                    >
                      Mark checkpoint (no score)
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </GlassCard>
    </div>
  )
}
