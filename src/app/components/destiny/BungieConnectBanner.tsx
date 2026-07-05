'use client'

import { Link2, Loader2, RefreshCw, Sparkles, Unlink } from 'lucide-react'
import { GlassCard, StatusPill } from '@/app/components/destiny/DestinyUi'
import { destinyPrimaryBtn, destinySecondaryBtn, getDestinyTheme } from '@/app/components/destiny/destinyTheme'
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
            'rounded-2xl px-4 py-3 text-sm leading-relaxed',
            messageTone === 'error'
              ? 'bg-red-500/10 text-red-100 ring-1 ring-red-500/20'
              : 'bg-emerald-500/10 text-emerald-100 ring-1 ring-emerald-500/20'
          )}
        >
          {linkMessage}
        </div>
      )}

      <GlassCard darkMode={darkMode} padding="lg">
        {!configured ? (
          <p className={cn('text-sm leading-relaxed', t.muted)}>
            Bungie sign-in is not configured on the server yet.
          </p>
        ) : linked ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill label={`Welcome, ${status?.bungieDisplayName}`} tone="green" />
              {status?.connectedAt && variant === 'overview' && (
                <span className={cn('text-xs', t.caption)}>
                  Connected {new Date(status.connectedAt).toLocaleDateString()}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {showSync && (
                <button
                  type="button"
                  disabled={syncing}
                  onClick={() => void syncRuns()}
                  className={destinySecondaryBtn(darkMode)}
                >
                  {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Sync runs
                </button>
              )}
              {variant === 'compact' && (
                <button
                  type="button"
                  disabled={disconnecting}
                  onClick={() => void disconnect()}
                  className={cn(destinySecondaryBtn(darkMode), 'text-red-200/90')}
                >
                  {disconnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlink className="w-4 h-4" />}
                  Disconnect
                </button>
              )}
            </div>
          </div>
        ) : variant === 'overview' ? (
          <div className="flex flex-col sm:flex-row gap-6 sm:items-center">
            <div className="flex gap-4 flex-1 min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-white/[0.08] flex items-center justify-center shrink-0">
                <Sparkles className="w-6 h-6 text-white/70" />
              </div>
              <div>
                <p className={cn('text-base font-semibold tracking-tight', t.heading)}>Connect your Guardian</p>
                <p className={cn('text-sm mt-1.5 leading-relaxed', t.muted)}>
                  Sign in with Bungie to sync raids, dungeons, and your profile. One tap — we handle the rest.
                </p>
              </div>
            </div>
            <button type="button" onClick={connect} className={cn(destinyPrimaryBtn(darkMode), 'shrink-0 w-full sm:w-auto')}>
              <Link2 className="w-4 h-4" />
              Sign in with Bungie
            </button>
          </div>
        ) : (
          <button type="button" onClick={connect} className={destinyPrimaryBtn(darkMode)}>
            <Link2 className="w-4 h-4" />
            Connect Bungie
          </button>
        )}

        {!linked && configured && status?.redirectUri && variant === 'overview' && (
          <details className={cn('mt-5 rounded-2xl p-4', t.glassInset)}>
            <summary className={cn('text-xs font-medium cursor-pointer select-none', t.muted)}>
              Developer setup (redirect URL)
            </summary>
            <code className="block text-xs break-all mt-3 text-white/60">{status.redirectUri}</code>
            <button
              type="button"
              onClick={() => void copyRedirectUri()}
              className={cn(destinySecondaryBtn(darkMode), 'mt-3 text-xs py-1.5 px-3')}
            >
              Copy URL
            </button>
          </details>
        )}
      </GlassCard>
    </div>
  )
}
