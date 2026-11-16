'use client'

import { useEffect, useState } from 'react'

export default function TwitchCallbackPage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const finish = async () => {
      const params = new URLSearchParams(window.location.search)
      const code = params.get('code')
      const state = params.get('state')
      const error = params.get('error')
      if (error) {
        setStatus('error')
        setErrorMessage(params.get('error_description') || error)
        return
      }
      if (!code || !state) {
        setStatus('error')
        setErrorMessage('Twitch did not return a login code.')
        return
      }
      try {
        const response = await fetch('/api/auth/twitch/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ code, state }),
        })
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Could not log in with Twitch.')
        setStatus('success')
        const returnPath =
          typeof data.returnPath === 'string' && data.returnPath.startsWith('/') && !data.returnPath.startsWith('//')
            ? data.returnPath
            : '/'
        window.setTimeout(() => {
          window.location.href = returnPath
        }, 400)
      } catch (err) {
        setStatus('error')
        setErrorMessage(err instanceof Error ? err.message : 'Could not log in with Twitch.')
      }
    }
    void finish()
  }, [])

  return (
    <div className="flex min-h-screen items-center justify-center bg-sdhq-dark-900 px-4">
      <div className="max-w-md text-center">
        {status === 'loading' ? (
          <>
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-sdhq-cyan-500" />
            <h2 className="mb-2 text-2xl font-bold text-white">Logging in with Twitch…</h2>
          </>
        ) : null}
        {status === 'success' ? <h2 className="text-2xl font-bold text-white">Signed in. Redirecting…</h2> : null}
        {status === 'error' ? (
          <>
            <h2 className="mb-2 text-2xl font-bold text-red-400">Twitch login failed</h2>
            <p className="mb-4 text-gray-300">{errorMessage}</p>
            <a href="/" className="sdhq-button inline-block">
              Return home
            </a>
          </>
        ) : null}
      </div>
    </div>
  )
}
