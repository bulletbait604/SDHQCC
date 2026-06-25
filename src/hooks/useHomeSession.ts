'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { homeTranslations } from '@/lib/i18n/homeTranslations'
import type { HomeLanguage, KickUser } from '@/lib/home/types'
import { getClientCookie, setClientCookie } from '@/lib/clientCookies'

export interface UseHomeSessionOptions {
  onSessionReady: () => void
  fetchUserRole: () => void | Promise<void>
}

export function useHomeSession({ onSessionReady, fetchUserRole }: UseHomeSessionOptions) {
  const onSessionReadyRef = useRef(onSessionReady)
  const fetchUserRoleRef = useRef(fetchUserRole)
  onSessionReadyRef.current = onSessionReady
  fetchUserRoleRef.current = fetchUserRole

  const [mounted, setMounted] = useState(false)
  const [user, setUser] = useState<KickUser | null>(null)
  const [language, setLanguage] = useState<HomeLanguage>('en')
  const [darkMode, setDarkMode] = useState(true)
  const [isBanned, setIsBanned] = useState(false)
  const [bannedMessage, setBannedMessage] = useState('')
  const [isVerified, setIsVerified] = useState(false)
  const [isLifetime, setIsLifetime] = useState(false)

  useEffect(() => {
    setMounted(true)
    if (typeof window === 'undefined') return

    const urlParams = new URLSearchParams(window.location.search)
    const isPostVerification = urlParams.has('verified')

    const applyAnonymousUiFromCookies = () => {
      const lang = getClientCookie('sdhq_language')
      if (lang && homeTranslations[lang as HomeLanguage]) {
        setLanguage(lang as HomeLanguage)
      }
      const dark = getClientCookie('sdhq_dark')
      if (dark === '1') setDarkMode(true)
      else if (dark === '0') setDarkMode(false)
    }

    void (async () => {
      try {
        let meRes = await fetch('/api/me', { credentials: 'include' })
        if (!meRes.ok && meRes.status === 401) {
          for (let attempt = 0; attempt < 6; attempt++) {
            await new Promise((r) => setTimeout(r, 50 * (attempt + 1)))
            meRes = await fetch('/api/me', { credentials: 'include' })
            if (meRes.ok) break
            if (meRes.status !== 401) break
          }
        }
        if (meRes.ok) {
          const me = await meRes.json()
          if (me.banned) {
            setIsBanned(true)
            setBannedMessage(typeof me.message === 'string' ? me.message : '')
            setUser(null)
            setIsVerified(false)
            setIsLifetime(false)
            applyAnonymousUiFromCookies()
          } else if (!me.user) {
            setIsBanned(false)
            setBannedMessage('')
            setUser(null)
            setIsVerified(false)
            setIsLifetime(false)
            applyAnonymousUiFromCookies()
          } else {
            setIsBanned(false)
            setBannedMessage('')
            setUser(me.user as KickUser)
            if (me.preferences?.language && homeTranslations[me.preferences.language as HomeLanguage]) {
              setLanguage(me.preferences.language as HomeLanguage)
            }
            if (typeof me.preferences?.darkMode === 'boolean') {
              setDarkMode(me.preferences.darkMode)
            }
            setIsVerified(!!me.subscription?.isVerified)
            setIsLifetime(!!me.subscription?.isLifetime)

            if (isPostVerification && me.user?.username) {
              urlParams.delete('verified')
              window.history.replaceState({}, '', `${window.location.pathname}?${urlParams}`)

              let rolePollCount = 0
              const rolePoll = setInterval(async () => {
                rolePollCount++
                const response = await fetch(`/api/roles?username=${me.user.username}`, {
                  credentials: 'include',
                })
                if (response.ok) {
                  const data = await response.json()
                  if (data.user?.role && data.user.role !== 'free') {
                    clearInterval(rolePoll)
                    void fetchUserRoleRef.current()
                  }
                }
                if (rolePollCount >= 30) clearInterval(rolePoll)
              }, 200)
            }
          }
        } else {
          applyAnonymousUiFromCookies()
        }
      } catch (err) {
        console.error('Error loading session:', err)
        applyAnonymousUiFromCookies()
      } finally {
        onSessionReadyRef.current()
      }
    })()
  }, [])

  useEffect(() => {
    if (!mounted || typeof window === 'undefined') return
    if (user) {
      void fetch('/api/me', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences: { language } }),
      }).catch(() => {})
    } else {
      setClientCookie('sdhq_language', language)
    }
  }, [language, user, mounted])

  useEffect(() => {
    if (!mounted || typeof window === 'undefined') return
    if (user) {
      void fetch('/api/me', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences: { darkMode } }),
      }).catch(() => {})
    } else {
      setClientCookie('sdhq_dark', darkMode ? '1' : '0')
    }
  }, [darkMode, user, mounted])

  const handleLanguageChange = useCallback((lang: HomeLanguage) => {
    setLanguage(lang)
  }, [])

  const toggleDarkMode = useCallback(() => {
    setDarkMode((prev) => !prev)
  }, [])

  const handleLogout = useCallback(async (logLogout?: () => void) => {
    logLogout?.()
    setUser(null)
    if (typeof window !== 'undefined') {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          credentials: 'include',
          cache: 'no-store',
        })
      } catch {
        /* still navigate */
      }
      document.cookie = 'kickCodeVerifier=; path=/; max-age=0'
      document.cookie = 'kickAuthReturn=; path=/; max-age=0'
      window.location.replace('/')
    }
  }, [])

  return {
    mounted,
    user,
    setUser,
    language,
    darkMode,
    isBanned,
    bannedMessage,
    isVerified,
    setIsVerified,
    isLifetime,
    setIsLifetime,
    handleLanguageChange,
    toggleDarkMode,
    handleLogout,
  }
}
