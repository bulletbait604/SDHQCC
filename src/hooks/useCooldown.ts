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
  const checkCooldownRef = useRef<() => Promise<void>>(async () => {})
  const isExempt = userRole ? EXEMPT_ROLES.includes(userRole) : false

  // Define checkCooldown as a function declaration so it's hoisted
  async function checkCooldown() {
    console.log('[Cooldown] === CHECK COOLDOWN START ===', { userId, tool, isExempt })
    if (isExempt || !userId) {
      console.log('[Cooldown] Skipped - exempt or no userId')
      return
    }
    try {
      const url = `/api/cooldown?userId=${userId}&tool=${tool}`
      console.log('[Cooldown] Fetching:', url)
      const res = await fetch(url)
      console.log('[Cooldown] Response status:', res.status)
      const data = await res.json()
      console.log('[Cooldown] API response data:', data)
      if (data.onCooldown) {
        console.log('[Cooldown] Setting onCooldown to TRUE, seconds:', data.secondsRemaining)
        setOnCooldown(true)
        setSecondsRemaining(data.secondsRemaining)
      } else {
        console.log('[Cooldown] onCooldown is false, not setting state')
      }
    } catch (e) {
      console.error('[Cooldown] Failed to check:', e)
    }
    console.log('[Cooldown] === CHECK COOLDOWN END ===')
  }

  // Store checkCooldown in a ref to ensure it's always accessible
  checkCooldownRef.current = checkCooldown

  // Log state changes for debugging
  useEffect(() => {
    console.log('[Cooldown] State changed:', { onCooldown, secondsRemaining, isExempt, userId, tool })
  }, [onCooldown, secondsRemaining])

  // Check cooldown from server on mount
  useEffect(() => {
    console.log('[Cooldown] Mount effect running:', { userId, tool, isExempt })
    if (isExempt || !userId) {
      console.log('[Cooldown] Skipped check on mount - exempt or no userId')
      return
    }
    checkCooldown()
  }, [userId, tool, isExempt])

  // Countdown timer - only runs when onCooldown changes, not on every tick
  useEffect(() => {
    console.log('[Cooldown] Timer effect running:', { onCooldown })
    if (!onCooldown) {
      console.log('[Cooldown] Timer not started - onCooldown is false')
      return
    }

    console.log('[Cooldown] Starting timer interval')
    timerRef.current = setInterval(() => {
      setSecondsRemaining(prev => {
        console.log('[Cooldown] Tick:', prev)
        if (prev <= 1) {
          setOnCooldown(false)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      console.log('[Cooldown] Cleaning up timer')
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [onCooldown])

  // Call this after a successful use to start the cooldown
  const startCooldown = useCallback(async () => {
    console.log('[Cooldown] === START COOLDOWN ===', { isExempt, userId, tool })
    if (isExempt) {
      console.log('[Cooldown] Skipped start - user exempt')
      return
    }
    
    // Fire and forget - don't wait for response to avoid hanging
    console.log('[Cooldown] POST /api/cooldown - fire and forget')
    
    // Helper to call checkCooldown via ref (avoids stale closure issues)
    const callCheckCooldown = () => {
      console.log('[Cooldown] Invoking checkCooldown via ref...')
      checkCooldownRef.current()
    }
    
    // Send POST request to set cooldown on server
    try {
      fetch('/api/cooldown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, tool })
      }).then(() => {
        console.log('[Cooldown] POST completed, calling checkCooldown...')
        callCheckCooldown()
      }).catch((e) => {
        console.error('[Cooldown] POST failed:', e)
        // Try checkCooldown anyway
        callCheckCooldown()
      })
    } catch (e) {
      console.error('[Cooldown] POST error:', e)
      callCheckCooldown()
    }
    
    // Also try after a short delay in case fetch hangs
    setTimeout(() => {
      console.log('[Cooldown] Calling checkCooldown after 500ms delay...')
      callCheckCooldown()
    }, 500)
    
    // And one more time after a longer delay as fallback
    setTimeout(() => {
      console.log('[Cooldown] Calling checkCooldown after 2s delay...')
      callCheckCooldown()
    }, 2000)
    
    console.log('[Cooldown] === START COOLDOWN END (fire and forget) ===')
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
