'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface UseCooldownOptions {
  userId: string
  tool: 'thumbnail' | 'clip-analyzer'
  userRole?: string
}

// Roles that bypass cooldowns entirely
const EXEMPT_ROLES = ['subscriber', 'subscriber_lifetime', 'admin', 'owner', 'tester']

// Finds the Monetag vignette show function on window
function findMonetagFn(): (() => void) | null {
  if (typeof window === 'undefined') return null
  const key = Object.keys(window).find(
    k => /^show_\d{7,}$/.test(k) && typeof (window as any)[k] === 'function'
  )
  return key ? (window as any)[key] : null
}

export function useCooldown({ userId, tool, userRole }: UseCooldownOptions) {
  const [onCooldown, setOnCooldown] = useState(false)
  const [secondsRemaining, setSecondsRemaining] = useState(0)
  const [watchingAd, setWatchingAd] = useState(false)
  const [adReady, setAdReady] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const isExempt = userRole ? EXEMPT_ROLES.includes(userRole) : false

  // Poll for Monetag script
  useEffect(() => {
    if (findMonetagFn()) { setAdReady(true); return }
    const interval = setInterval(() => {
      if (findMonetagFn()) { setAdReady(true); clearInterval(interval) }
    }, 300)
    const timeout = setTimeout(() => { clearInterval(interval); setAdReady(true) }, 15000)
    return () => { clearInterval(interval); clearTimeout(timeout) }
  }, [])

  // Check cooldown from server on mount
  useEffect(() => {
    if (isExempt || !userId) return
    checkCooldown()
  }, [userId, tool, isExempt])

  // Countdown timer
  useEffect(() => {
    if (!onCooldown || secondsRemaining <= 0) return
    timerRef.current = setInterval(() => {
      setSecondsRemaining(prev => {
        if (prev <= 1) {
          setOnCooldown(false)
          if (timerRef.current) clearInterval(timerRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [onCooldown, secondsRemaining])

  const checkCooldown = async () => {
    if (isExempt || !userId) return
    try {
      const res = await fetch(`/api/cooldown?userId=${userId}&tool=${tool}`)
      const data = await res.json()
      if (data.onCooldown) {
        setOnCooldown(true)
        setSecondsRemaining(data.secondsRemaining)
      }
    } catch (e) {
      console.error('[Cooldown] Failed to check:', e)
    }
  }

  // Call this after a successful use to start the cooldown
  const startCooldown = useCallback(async () => {
    if (isExempt) return
    try {
      await fetch('/api/cooldown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, tool })
      })
      await checkCooldown()
    } catch (e) {
      console.error('[Cooldown] Failed to start:', e)
    }
  }, [userId, tool, isExempt])

  // Call this when user clicks "Watch Ad to Skip"
  const watchAdToSkip = useCallback(async () => {
    setWatchingAd(true)
    try {
      // Fire the Monetag vignette ad
      const fn = findMonetagFn()
      if (fn) {
        fn()
        console.log('[Monetag] Vignette ad triggered for cooldown skip')
      }
      // Wait 6 seconds for ad to play
      await new Promise(r => setTimeout(r, 6000))
      // Clear cooldown server-side
      await fetch('/api/cooldown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, tool, skipWithAd: true })
      })
      // Clear client-side state
      if (timerRef.current) clearInterval(timerRef.current)
      setOnCooldown(false)
      setSecondsRemaining(0)
    } catch (e) {
      console.error('[Cooldown] Failed to skip:', e)
    } finally {
      setWatchingAd(false)
    }
  }, [userId, tool])

  const formatTime = (secs: number): string => {
    if (secs >= 3600) {
      const h = Math.floor(secs / 3600)
      const m = Math.floor((secs % 3600) / 60)
      const s = secs % 60
      return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    }
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`
  }

  return {
    onCooldown: isExempt ? false : onCooldown,
    secondsRemaining,
    watchingAd,
    adReady,
    startCooldown,
    watchAdToSkip,
    formatTime,
    isExempt
  }
}
