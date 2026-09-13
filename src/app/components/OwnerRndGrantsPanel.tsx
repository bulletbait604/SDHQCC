'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { FlaskConical, Loader2, CheckCircle } from 'lucide-react'
import { GRANTABLE_RND_TABS, type GrantableRndTab } from '@/lib/home/rndAccess'
import { normalizeKickUsername } from '@/lib/home/ownerIdentity'

const RND_TAB_LABELS: Record<GrantableRndTab, string> = {
  'narrate-me': 'Narrate Me',
  'viral-clip-gen': 'Viral Clip Gen',
  'trending-vids': 'Trending Vids',
  'going-live': 'Going Live',
  tradebot: 'TradeBot',
  'viruses-port-scanner': 'Viruses Port Scanner',
}

interface Props {
  darkMode: boolean
  usersWithRoles: Array<{ username: string }>
}

export default function OwnerRndGrantsPanel({ darkMode, usersWithRoles }: Props) {
  const [username, setUsername] = useState('')
  const [tabs, setTabs] = useState<GrantableRndTab[]>([])
  const [grants, setGrants] = useState<Array<{ username: string; tabs: GrantableRndTab[] }>>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const field = darkMode
    ? 'bg-sdhq-dark-800 border-sdhq-dark-600 text-white'
    : 'bg-white border-gray-300 text-gray-900'

  const load = async () => {
    const res = await fetch('/api/rnd-grants', { credentials: 'include' })
    if (!res.ok) return
    const data = (await res.json()) as { grants?: Array<{ username: string; tabs: GrantableRndTab[] }> }
    setGrants(Array.isArray(data.grants) ? data.grants : [])
  }

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    const key = normalizeKickUsername(username)
    const row = grants.find((g) => g.username === key)
    setTabs(row?.tabs || [])
  }, [username, grants])

  const toggle = (id: GrantableRndTab) => {
    setTabs((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]))
  }

  const save = async () => {
    const target = normalizeKickUsername(username)
    if (!target) return
    setBusy(true)
    setMessage('')
    try {
      const res = await fetch('/api/rnd-grants', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: target, tabs }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not save R&D access')
      setMessage(`Saved R&D tabs for ${target}.`)
      await load()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not save R&D access')
    } finally {
      setBusy(false)
    }
  }

  const names = Array.from(
    new Set(
      [...usersWithRoles.map((u) => normalizeKickUsername(u.username)), ...grants.map((g) => g.username)].filter(
        Boolean
      )
    )
  ).sort((a, b) => a.localeCompare(b))

  return (
    <div
      className={`p-4 rounded-lg border-2 ${
        darkMode ? 'bg-sdhq-dark-700 border-sdhq-green-500/30' : 'bg-gray-50 border-emerald-300'
      }`}
    >
      <h4 className={`font-semibold mb-2 flex items-center ${darkMode ? 'text-white' : 'text-gray-900'}`}>
        <FlaskConical className="w-5 h-5 mr-2 text-sdhq-green-500" />
        R&D tab access
      </h4>
      <p className={`text-sm mb-4 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
        Admins do not get R&D by default. Grant individual R&D tools to a Kick username here.
      </p>
      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <select
          value={names.includes(normalizeKickUsername(username)) ? normalizeKickUsername(username) : ''}
          onChange={(e) => setUsername(e.target.value)}
          className={`flex-1 px-3 py-2 rounded-md border ${field}`}
        >
          <option value="">Select user…</option>
          {names.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Or type a Kick username"
          className={`flex-1 px-3 py-2 rounded-md border ${field}`}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
        {GRANTABLE_RND_TABS.map((id) => (
          <label
            key={id}
            className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
              darkMode ? 'border-sdhq-dark-600 text-white' : 'border-gray-200 text-gray-900'
            }`}
          >
            <input type="checkbox" checked={tabs.includes(id)} onChange={() => toggle(id)} />
            {RND_TAB_LABELS[id]}
          </label>
        ))}
      </div>
      <Button
        type="button"
        onClick={() => void save()}
        disabled={busy || !normalizeKickUsername(username)}
        className="bg-gradient-to-r from-sdhq-cyan-500 to-sdhq-green-500 text-black"
      >
        {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-1" />}
        Save R&D tabs
      </Button>
      {message && (
        <p className={`text-sm mt-2 ${darkMode ? 'text-sdhq-green-300' : 'text-emerald-800'}`}>{message}</p>
      )}
    </div>
  )
}
