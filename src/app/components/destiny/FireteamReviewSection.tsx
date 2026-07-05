'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Star, Users } from 'lucide-react'
import type { ReviewableRun } from '@/lib/destiny/fireteamReputation'
import { GlassCard, SectionTitle, StatusPill } from '@/app/components/destiny/DestinyUi'
import { getDestinyTheme } from '@/app/components/destiny/destinyTheme'
import { cn } from '@/lib/utils'
import FireteamReviewModal from '@/app/components/destiny/FireteamReviewModal'

interface Props {
  darkMode: boolean
  linked?: boolean
}

export default function FireteamReviewSection({ darkMode, linked = true }: Props) {
  const t = getDestinyTheme(darkMode)
  const [runs, setRuns] = useState<ReviewableRun[]>([])
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState<{
    run: ReviewableRun
    siteUserId: string
    displayName: string
    membershipId: string
  } | null>(null)

  const load = useCallback(async () => {
    if (!linked) {
      setRuns([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/destiny/reputation?scope=reviewable', { credentials: 'include' })
      if (res.ok) {
        const json = await res.json()
        setRuns(json.reviewableRuns ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [linked])

  useEffect(() => {
    void load()
  }, [load])

  if (!linked) return null

  return (
    <>
      <GlassCard darkMode={darkMode}>
        <div className="flex items-center gap-2 mb-2">
          <Users className="w-4 h-4 text-sky-400/80" />
          <SectionTitle
            title="Rate your fireteam"
            subtitle="Review Top Nest players you cleared with — builds your reputation score"
            darkMode={darkMode}
          />
        </div>

        {loading ? (
          <p className={cn('text-sm flex items-center gap-2', t.muted)}>
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading reviewable runs…
          </p>
        ) : runs.length === 0 ? (
          <p className={cn('text-sm', t.muted)}>
            No pending reviews. Sync verified runs with linked Top Nest teammates to rate them here.
          </p>
        ) : (
          <div className="space-y-3 mt-3">
            {runs.map((run) => (
              <div
                key={run.runId}
                className="rounded-xl ring-1 ring-white/10 bg-white/[0.03] p-3 space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className={cn('text-sm font-medium', t.heading)}>{run.activityName}</p>
                    <p className={cn('text-xs', t.caption)}>
                      {new Date(run.completedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {run.teammates.map((teammate) => (
                    <button
                      key={`${run.runId}-${teammate.siteUserId}`}
                      type="button"
                      disabled={teammate.alreadyReviewed}
                      onClick={() =>
                        setActive({
                          run,
                          siteUserId: teammate.siteUserId,
                          displayName: teammate.displayName,
                          membershipId: teammate.membershipId,
                        })
                      }
                      className={cn(
                        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs transition',
                        teammate.alreadyReviewed
                          ? 'ring-1 ring-white/10 text-white/40 cursor-default'
                          : 'ring-1 ring-sky-400/30 bg-sky-400/10 text-sky-100 hover:bg-sky-400/20'
                      )}
                    >
                      <Star className="w-3 h-3" />
                      {teammate.displayName}
                      {teammate.alreadyReviewed ? (
                        <StatusPill label="Reviewed" tone="green" />
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      {active && (
        <FireteamReviewModal
          darkMode={darkMode}
          runId={active.run.runId}
          activityName={active.run.activityName}
          displayName={active.displayName}
          siteUserId={active.siteUserId}
          membershipId={active.membershipId}
          onClose={() => setActive(null)}
          onSubmitted={() => {
            setActive(null)
            void load()
          }}
        />
      )}
    </>
  )
}
