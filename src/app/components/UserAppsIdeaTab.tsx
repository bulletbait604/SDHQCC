'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Lightbulb, Loader2, Mail, CheckCircle2, Sparkles } from 'lucide-react'

export interface UserAppsIdeaTabProps {
  darkMode: boolean
  title: string
  intro: string
  subjectLabel: string
  bodyLabel: string
  subjectPlaceholder: string
  bodyPlaceholder: string
  submitLabel: string
  sendingLabel: string
  successMessage: string
}

export default function UserAppsIdeaTab({
  darkMode,
  title,
  intro,
  subjectLabel,
  bodyLabel,
  subjectPlaceholder,
  bodyPlaceholder,
  submitLabel,
  sendingLabel,
  successMessage,
}: UserAppsIdeaTabProps) {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  const field = darkMode
    ? 'bg-sdhq-dark-900/80 border-white/10 text-white placeholder-gray-500 focus:border-sdhq-cyan-400 focus:ring-2 focus:ring-sdhq-cyan-400/30'
    : 'bg-white border-sdhq-cyan-200 text-gray-900 placeholder-gray-400 focus:border-sdhq-cyan-500 focus:ring-2 focus:ring-sdhq-cyan-400/25'

  const handleSubmit = async () => {
    setError('')
    setSent(false)
    const nextSubject = subject.trim()
    const nextBody = body.trim()
    if (nextSubject.length < 3) {
      setError('Please add a short subject for your idea.')
      return
    }
    if (nextBody.length < 10) {
      setError('Please describe your idea and how we can contact you.')
      return
    }
    setSending(true)
    try {
      const res = await fetch('/api/app-ideas', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: nextSubject, body: nextBody }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Could not send your idea.')
      }
      setSubject('')
      setBody('')
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send your idea.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 text-center">
        <div
          className={`mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl shadow-lg ${
            darkMode
              ? 'bg-gradient-to-br from-violet-500/30 via-sdhq-cyan-500/20 to-sdhq-green-500/20 shadow-sdhq-cyan-500/20'
              : 'bg-gradient-to-br from-violet-100 via-cyan-50 to-green-50 shadow-cyan-200/60'
          }`}
        >
          <Sparkles className="h-6 w-6 text-sdhq-cyan-400" />
        </div>
        <h3 className={`text-2xl font-bold tracking-tight ${darkMode ? 'text-white' : 'text-gray-900'}`}>
          {title}
        </h3>
        <p className={`mx-auto mt-1.5 max-w-lg text-sm leading-relaxed ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
          {intro}
        </p>
      </div>

      <div
        className={`rounded-2xl border p-4 shadow-xl transition-shadow ${
          darkMode
            ? 'border-white/10 bg-sdhq-dark-800/70 shadow-black/30'
            : 'border-sdhq-cyan-100 bg-white/90 shadow-cyan-100/80'
        }`}
      >
        <div className="mb-5 flex items-start gap-3">
          <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            Include a rough description of the app and how we should contact you (email, Kick, Discord, etc.).
          </p>
        </div>

        <label className={`mb-1.5 block text-sm font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
          {subjectLabel}
        </label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder={subjectPlaceholder}
          maxLength={160}
          className={`mb-4 w-full rounded-xl border px-4 py-3 text-base outline-none transition-all ${field}`}
        />

        <label className={`mb-1.5 block text-sm font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
          {bodyLabel}
        </label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={bodyPlaceholder}
          rows={6}
          maxLength={8000}
          className={`mb-4 min-h-[140px] w-full resize-y rounded-xl border px-4 py-3 text-base outline-none transition-all ${field}`}
        />

        {error && (
          <p className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </p>
        )}
        {sent && (
          <p className="mb-3 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {successMessage}
          </p>
        )}

        <Button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={sending}
          className="sdhq-button h-12 w-full text-base"
        >
          {sending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {sendingLabel}
            </>
          ) : (
            <>
              <Mail className="mr-2 h-4 w-4" />
              {submitLabel}
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
