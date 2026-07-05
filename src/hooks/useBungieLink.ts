'use client'

import { useCallback, useEffect, useState } from 'react'
import { defaultBungieReturnPath, stripUrlParams } from '@/lib/home/tabUrl'
import { bungieOAuthErrorMessage } from '@/lib/destiny/bungieOAuthMessages'

export interface BungieLinkStatus {
  configured: boolean
  linked: boolean
  tokenHealthy?: boolean
  needsReconnect?: boolean
  bungieDisplayName?: string
  connectedAt?: string
  redirectUri?: string
}

export function useBungieLink(options?: { returnPath?: string }) {
  const [status, setStatus] = useState<BungieLinkStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [disconnecting, setDisconnecting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [linkMessage, setLinkMessage] = useState<string | null>(null)
  const [connectHref, setConnectHref] = useState(
    `/api/destiny/auth/bungie/start?return=${encodeURIComponent(options?.returnPath ?? defaultBungieReturnPath())}`
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/destiny/auth/bungie/status', { credentials: 'include' })
      if (res.ok) setStatus(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const current = window.location.pathname + window.location.search
    setConnectHref(`/api/destiny/auth/bungie/start?return=${encodeURIComponent(current)}`)

    const params = new URLSearchParams(window.location.search)
    const bungie = params.get('bungie')
    if (bungie === 'linked') {
      const text = 'Bungie account linked successfully.'
      setLinkMessage(text)
      sessionStorage.removeItem('bungieLinkMessage')
      void load()
    } else if (bungie === 'error') {
      const msg = params.get('message') || ''
      const text = msg
        ? `Bungie linking failed: ${bungieOAuthErrorMessage(msg)}`
        : 'Bungie linking failed. Try again.'
      setLinkMessage(text)
      sessionStorage.setItem('bungieLinkMessage', text)
    } else {
      const saved = sessionStorage.getItem('bungieLinkMessage')
      if (saved) setLinkMessage(saved)
    }
    if (bungie) stripUrlParams(['bungie', 'message'])
  }, [load])

  useEffect(() => {
    if (status?.needsReconnect && !linkMessage) {
      setLinkMessage('Bungie session expired — reconnect once to restore live data.')
    }
  }, [status?.needsReconnect, linkMessage])

  function connect() {
    window.location.href = connectHref
  }

  async function disconnect() {
    setDisconnecting(true)
    try {
      await fetch('/api/destiny/auth/bungie/disconnect', {
        method: 'POST',
        credentials: 'include',
      })
      await load()
      setLinkMessage('Bungie account disconnected.')
    } finally {
      setDisconnecting(false)
    }
  }

  async function syncRuns(): Promise<{ synced?: number; flagged?: number; error?: string }> {
    setSyncing(true)
    try {
      const res = await fetch('/api/destiny/runs/sync', {
        method: 'POST',
        credentials: 'include',
      })
      const json = (await res.json().catch(() => ({}))) as {
        synced?: number
        flagged?: number
        builds?: number
        error?: string
        message?: string
      }
      if (!res.ok) {
        const text = json.error || json.message || 'Sync failed'
        setLinkMessage(text)
        return { error: text }
      }
      const text = `Synced ${json.synced ?? 0} run(s)${json.builds ? ` · ${json.builds} build(s)` : ''}${json.flagged ? ` · ${json.flagged} flagged for review` : ''}.`
      setLinkMessage(text)
      return { synced: json.synced, flagged: json.flagged }
    } finally {
      setSyncing(false)
    }
  }

  async function copyRedirectUri() {
    if (!status?.redirectUri) return
    try {
      await navigator.clipboard.writeText(status.redirectUri)
      setLinkMessage('Redirect URL copied. Paste it into your Bungie app OAuth settings.')
    } catch {
      setLinkMessage(`Copy this into Bungie: ${status.redirectUri}`)
    }
  }

  return {
    status,
    loading,
    linked: status?.linked ?? false,
    configured: status?.configured ?? false,
    connectHref,
    connect,
    disconnect,
    disconnecting,
    syncRuns,
    syncing,
    linkMessage,
    setLinkMessage,
    copyRedirectUri,
    reload: load,
  }
}
