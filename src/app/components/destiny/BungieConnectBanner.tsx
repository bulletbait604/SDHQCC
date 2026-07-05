'use client'

import { Link2, Loader2, RefreshCw, Unlink } from 'lucide-react'
import { GlassCard, StatusPill } from '@/app/components/destiny/DestinyUi'
import { getDestinyTheme } from '@/app/components/destiny/destinyTheme'
import type { useBungieLink } from '@/hooks/useBungieLink'
import { cn } from '@/lib/utils'

type BungieLink = ReturnType<typeof useBungieLink>

interface Props {
  darkMode: boolean
  bungie: BungieLink
  variant?: 'overview' | 'compact'
  showSync?: boolean
}

export default function BungieConnectBanner({
  darkMode,
  bungie,
  variant = 'overview',
  showSync = true,
}: Props) {
  const t = getDestinyTheme(darkMode)
  const {
    status,
    loading,
    linked,
    configured,
    connect,
    disconnect,
    disconnecting,
    syncRuns,
    syncing,
    linkMessage,
    copyRedirectUri,
  } = bungie

  if (loading) return null

  const messageTone =
    linkMessage &&
    (linkMessage.includes('failed') ||
      linkMessage.includes('expired') ||
      linkMessage.includes('mismatch') ||
      linkMessage.includes('Sync failed'))
      ? 'error'
      : 'success'

  return (
    <div className="space-y-3">
      {linkMessage && (
        <div
          className={cn(
            'rounded-xl p-3 text-sm border',
            messageTone === 'error'
              ? 'bg-red-500/10 border-red-500/30 text-red-200'
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
          )}
        >
          {linkMessage}
        </div>
      )}

      <GlassCard darkMode={darkMode}>
        {!configured ? (
          <p className={cn('text-xs', t.muted)}>
            Bungie OAuth not configured on server. Add BUNGIE_OAUTH_CLIENT_ID, BUNGIE_OAUTH_CLIENT_SECRET, and
            DESTINY_API.
          </p>
        ) : linked ? (
          <div className="flex flex-wrap items-center gap-3">
            <StatusPill label={`Signed in as ${status?.bungieDisplayName}`} tone="green" />
            {status?.connectedAt && variant === 'overview' && (
              <span className={cn('text-xs', t.muted)}>
                Linked {new Date(status.connectedAt).toLocaleDateString()}
              </span>
            )}
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {showSync && (
                <button
                  type="button"
                  disabled={syncing}
                  onClick={() => void syncRuns()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-sky-500/40 text-sky-200 bg-sky-500/10 hover:bg-sky-500/20"
                >
                  {syncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  Sync verified runs
                </button>
              )}
              {variant === 'compact' && (
                <button
                  type="button"
                  disabled={disconnecting}
                  onClick={() => void disconnect()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-red-500/40 text-red-300 bg-red-500/10"
                >
                  {disconnecting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Unlink className="w-3 h-3" />}
                  Disconnect
                </button>
              )}
            </div>
          </div>
        ) : variant === 'overview' ? (
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1 min-w-0">
              <p className={cn('text-sm font-semibold', t.heading)}>Connect your Bungie account</p>
              <p className={cn('text-xs mt-1', t.muted)}>
                Sign in with Bungie to pull your Guardian name, sync raid & dungeon clears, and qualify for verified
                scoring.
              </p>
            </div>
            <button
              type="button"
              onClick={connect}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-amber-500/25 text-amber-100 border border-amber-500/50 hover:bg-amber-500/35 shrink-0"
            >
              <Link2 className="w-4 h-4" />
              Sign in with Bungie
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={connect}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-amber-500/20 text-amber-100 border border-amber-500/40 hover:bg-amber-500/30"
          >
            <Link2 className="w-4 h-4" />
            Connect Bungie Account
          </button>
        )}

        {!linked && configured && status?.redirectUri && variant === 'overview' && (
          <div className={cn('mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-2 space-y-1')}>
            <p className={cn('text-xs', t.muted)}>
              First time? Register this redirect URL in your Bungie app OAuth settings:
            </p>
            <code className="block text-xs break-all text-amber-100/80">{status.redirectUri}</code>
            <button
              type="button"
              onClick={() => void copyRedirectUri()}
              className="text-xs px-2 py-0.5 rounded border border-amber-500/30 text-amber-200 hover:bg-amber-500/10"
            >
              Copy redirect URL
            </button>
          </div>
        )}
      </GlassCard>
    </div>
  )
}
