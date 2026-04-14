'use client'

import { useEffect, useState } from 'react'

export default function KickCallbackPage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState<string>('')

  useEffect(() => {
    const handleCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search)
      const code = urlParams.get('code')
      const error = urlParams.get('error')

      if (error) {
        setStatus('error')
        setErrorMessage(urlParams.get('error_description') || error)
        return
      }

      if (!code) {
        setStatus('error')
        setErrorMessage('No authorization code received from KICK')
        return
      }

      // Get the code verifier stored before redirect
      const codeVerifier = sessionStorage.getItem('kickCodeVerifier')

      if (!codeVerifier) {
        setStatus('error')
        setErrorMessage('Missing code verifier. Please try logging in again.')
        return
      }

      try {
        const response = await fetch('/api/auth/kick/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, codeVerifier }),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Token exchange failed')
        }

        const data = await response.json()

        if (data.user) {
          localStorage.setItem('kickUser', JSON.stringify(data.user))
        }

        if (data.accessToken) {
          localStorage.setItem('kickAccessToken', data.accessToken)
        }

        // Clean up
        sessionStorage.removeItem('kickCodeVerifier')

        setStatus('success')

        setTimeout(() => {
          window.location.href = '/'
        }, 1500)
      } catch (err: any) {
        setStatus('error')
        setErrorMessage(err.message || 'Authentication failed')
      }
    }

    handleCallback()
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center max-w-md">
        {status === 'loading' && (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sdhq-cyan-500 mx-auto mb-4"></div>
            <h2 className="text-2xl font-bold gradient-text mb-2">Authenticating with KICK...</h2>
            <p className="text-gray-600">Please wait while we verify your account</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="w-16 h-16 bg-sdhq-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold gradient-text mb-2">Authentication Successful!</h2>
            <p className="text-gray-600">Redirecting you back...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-red-500 mb-2">Authentication Failed</h2>
            <p className="text-gray-600 mb-4">{errorMessage}</p>
            <a href="/" className="sdhq-button inline-block">Return to Home</a>
          </>
        )}
      </div>
    </div>
  )
}
