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

// Load Monetag vignette script dynamically
function loadVignetteScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Window not available'))
      return
    }

    // Check if already loaded
    if (findMonetagFn()) {
      resolve()
      return
    }

    // Check if script tag already exists
    const existingScript = document.querySelector('script[data-zone="10951310"]')
    if (existingScript) {
      // Wait for it to load
      const checkInterval = setInterval(() => {
        if (findMonetagFn()) {
          clearInterval(checkInterval)
          resolve()
        }
      }, 100)
      setTimeout(() => {
        clearInterval(checkInterval)
        if (findMonetagFn()) resolve()
        else reject(new Error('Script load timeout'))
      }, 10000)
      return
    }

    // Create and load script
    const script = document.createElement('script')
    script.src = 'https://n6wxm.com/vignette.min.js'
    script.dataset.zone = '10951310'
    script.async = true

    script.onload = () => {
      // Wait for show function to be available
      const checkInterval = setInterval(() => {
        if (findMonetagFn()) {
          clearInterval(checkInterval)
          resolve()
        }
      }, 100)
      setTimeout(() => {
        clearInterval(checkInterval)
        if (findMonetagFn()) resolve()
        else reject(new Error('Show function not available'))
      }, 5000)
    }

    script.onerror = () => reject(new Error('Failed to load script'))

    document.head.appendChild(script)
  })
}

export function useCooldown({ userId, tool, userRole }: UseCooldownOptions) {
  const [onCooldown, setOnCooldown] = useState(false)
  const [secondsRemaining, setSecondsRemaining] = useState(0)
  const [watchingAd, setWatchingAd] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const isExempt = userRole ? EXEMPT_ROLES.includes(userRole) : false

  // Define checkCooldown as a function declaration so it's hoisted
  async function checkCooldown() {
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

  // Check cooldown from server on mount
  useEffect(() => {
    if (isExempt || !userId) return
    checkCooldown()
  }, [userId, tool, isExempt])

  // Countdown timer - only runs when onCooldown changes, not on every tick
  useEffect(() => {
    if (!onCooldown) return

    timerRef.current = setInterval(() => {
      setSecondsRemaining(prev => {
        if (prev <= 1) {
          setOnCooldown(false)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [onCooldown])

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
      // Load the vignette script dynamically
      await loadVignetteScript()

      // Fire the Monetag vignette ad
      const fn = findMonetagFn()
      if (fn) {
        fn()
        console.log('[Monetag] Vignette ad triggered for cooldown skip')
      } else {
        console.warn('[Monetag] Show function not available after loading')
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
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      setOnCooldown(false)
      setSecondsRemaining(0)
    } catch (e) {
      console.error('[Cooldown] Failed to skip:', e)
      // Even if ad fails, clear the cooldown as a fallback
      try {
        await fetch('/api/cooldown', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, tool, skipWithAd: true })
        })
        if (timerRef.current) {
          clearInterval(timerRef.current)
          timerRef.current = null
        }
        setOnCooldown(false)
        setSecondsRemaining(0)
      } catch (err) {
        console.error('[Cooldown] Failed to clear cooldown:', err)
      }
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
    startCooldown,
    watchAdToSkip,
    formatTime,
    isExempt
  }
}
