'use client'

import { useCallback, useEffect, useState } from 'react'
import { Star } from 'lucide-react'
import type { ReputationReview } from '@/lib/destiny/types'
import { GlassCard, SectionTitle } from '@/app/components/destiny/DestinyUi'
import { getDestinyTheme } from '@/app/components/destiny/destinyTheme'
import { cn } from '@/lib/utils'

interface Props {
  darkMode: boolean
}

export default function ReputationSummarySection({ darkMode }: Props) {
  const t = getDestinyTheme(darkMode)
  const [received, setReceived] = useState<ReputationReview[]>([])
  const [written, setWritten] = useState<ReputationReview[]>([])

  const load = useCallback(async () => {
    const [receivedRes, writtenRes] = await Promise.all([
      fetch('/api/destiny/reputation', { credentials: 'include' }),
      fetch('/api/destiny/reputation?scope=written', { credentials: 'include' }),
    ])
    if (receivedRes.ok) {
      const json = await receivedRes.json()
      setReceived(json.reviews ?? [])
    }
    if (writtenRes.ok) {
      const json = await writtenRes.json()
      setWritten(json.reviews ?? [])
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (!received.length && !written.length) return null

  return (
    <GlassCard darkMode={darkMode}>
      <div className="flex items-center gap-2 mb-2">
        <Star className="w-4 h-4 text-amber-400/80" />
        <SectionTitle title="Fireteam reputation" darkMode={darkMode} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <p className={cn('text-xs font-medium mb-2', t.caption)}>Reviews received ({received.length})</p>
          {received.length ? (
            received.slice(0, 5).map((review) => (
              <p key={review.id} className={cn('text-xs py-1 border-b border-white/5', t.muted)}>
                From {review.reviewerId}
                {review.wouldPlayAgain ? ' · would play again' : ''}
              </p>
            ))
          ) : (
            <p className={cn('text-xs', t.muted)}>None yet — clear with Top Nest players to get rated.</p>
          )}
        </div>
        <div>
          <p className={cn('text-xs font-medium mb-2', t.caption)}>Reviews you wrote ({written.length})</p>
          {written.length ? (
            written.slice(0, 5).map((review) => (
              <p key={review.id} className={cn('text-xs py-1 border-b border-white/5', t.muted)}>
                {review.reviewedUserId}
                {review.runId ? ` · run ${review.runId.slice(0, 8)}…` : ''}
              </p>
            ))
          ) : (
            <p className={cn('text-xs', t.muted)}>Rate teammates after verified clears.</p>
          )}
        </div>
      </div>
    </GlassCard>
  )
}
