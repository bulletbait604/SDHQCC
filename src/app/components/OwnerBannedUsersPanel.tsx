'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, RefreshCw, Trash2, UserX } from 'lucide-react'
import { Button } from '@/components/ui/button'

type BannedRow = { username: string; bannedAt: string; bannedBy?: string }

type OwnerBannedUsersPanelProps = {
  darkMode: boolean
}

export default function OwnerBannedUsersPanel({ darkMode }: OwnerBannedUsersPanelProps) {
  const [list, setList] = useState<BannedRow[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [username, setUsername] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/banned-users', { credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Could not load ban list')
      }
      setList(Array.isArray(data.banned) ? data.banned : [])
    } catch (e) {
      console.error('[OwnerBannedUsersPanel]', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const ban = async () => {
    const target = username.trim().replace(/^@/, '')
    if (!target) {
      alert('Enter a Kick username to ban.')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/banned-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: target, action: 'add' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Ban failed')
      setUsername('')
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Ban failed')
    } finally {
      setBusy(false)
    }
  }

  const unban = async (name: string) => {
    setBusy(true)
    try {
      const res = await fetch('/api/banned-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: name, action: 'remove' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Unban failed')
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Unban failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className={`p-4 rounded-lg border-2 ${
        darkMode ? 'bg-sdhq-dark-700 border-red-500/40' : 'bg-gray-50 border-red-300 shadow-sm'
      }`}
    >
      <div className="flex items-center gap-2 mb-3">
        <UserX className="w-5 h-5 text-red-500 shrink-0" />
        <div>
          <h4 className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Banned users</h4>
          <p className={`text-xs mt-0.5 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            Blocked Kick usernames cannot use the site. Owner allowlist accounts cannot be banned.
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Kick username"
          className={`flex-1 px-3 py-2 rounded-md border text-sm ${
            darkMode
              ? 'bg-sdhq-dark-800 border-sdhq-dark-600 text-white placeholder-gray-500'
              : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
          }`}
        />
        <Button
          type="button"
          onClick={() => void ban()}
          disabled={busy}
          variant="destructive"
          className="shrink-0"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Ban user'}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void load()}
          disabled={loading}
          className={darkMode ? 'border-sdhq-dark-600 text-white shrink-0' : 'shrink-0'}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div
        className={`max-h-48 overflow-y-auto rounded-md border ${
          darkMode ? 'border-sdhq-dark-600 bg-sdhq-dark-800/50' : 'border-gray-200 bg-white'
        }`}
      >
        {list.length === 0 ? (
          <p className={`p-3 text-sm ${darkMode ? 'text-gray-500' : 'text-gray-600'}`}>No banned users.</p>
        ) : (
          <ul className="divide-y divide-gray-700/30">
            {list.map((row) => (
              <li
                key={row.username}
                className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
              >
                <span className={darkMode ? 'text-gray-200' : 'text-gray-900'}>@{row.username}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => void unban(row.username)}
                  className="text-red-500 hover:text-red-600 shrink-0"
                  title="Unban"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
