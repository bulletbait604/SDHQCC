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
  const hasMountedRef = useRef(false)
  
  // Store all dependencies in refs to avoid stale closure issues
  const userIdRef = useRef(userId)
  const toolRef = useRef(tool)
  const isExemptRef = useRef(userRole ? EXEMPT_ROLES.includes(userRole) : false)
  const checkCooldownRef = useRef<() => Promise<void>>(async () => {})
  
  // Keep refs current
  userIdRef.current = userId
  toolRef.current = tool
  isExemptRef.current = userRole ? EXEMPT_ROLES.includes(userRole) : false

  // Define checkCooldown as a function that uses refs (stored in ref to keep stable)
  checkCooldownRef.current = async () => {
    const currentUserId = userIdRef.current
    const currentTool = toolRef.current
    const currentIsExempt = isExemptRef.current
    
    // Block anon users and exempt users
    if (currentIsExempt || !currentUserId || currentUserId === 'anon') {
      console.log('[Cooldown] Skipped check - exempt, no userId, or anon')
      return
    }
    
    console.log('[Cooldown] === CHECK COOLDOWN START ===', { userId: currentUserId, tool: currentTool, isExempt: currentIsExempt })
    try {
      const url = `/api/cooldown?userId=${currentUserId}&tool=${currentTool}`
      console.log('[Cooldown] Fetching:', url)
      const res = await fetch(url)
      console.log('[Cooldown] Response status:', res.status)
      const data = await res.json()
      console.log('[Cooldown] API response data:', data)
      
      // ALWAYS set state from server (don't early return)
      setOnCooldown(data.onCooldown || false)
      setSecondsRemaining(data.secondsRemaining || 0)
      console.log('[Cooldown] State updated:', { onCooldown: data.onCooldown, secondsRemaining: data.secondsRemaining })
    } catch (e) {
      console.error('[Cooldown] Failed to check:', e)
    }
    console.log('[Cooldown] === CHECK COOLDOWN END ===')
  }
  
  // Stable checkCooldown that always calls through the ref
  const checkCooldown = useCallback(() => checkCooldownRef.current(), [])

  // Log state changes for debugging
  useEffect(() => {
    console.log('[Cooldown] State changed:', { onCooldown, secondsRemaining, isExempt: isExemptRef.current, userId: userIdRef.current, tool: toolRef.current })
  }, [onCooldown, secondsRemaining])

  // Check cooldown from server on mount (with guard to prevent duplicate calls)
  useEffect(() => {
    const currentIsExempt = isExemptRef.current
    const currentUserId = userIdRef.current
    
    // Prevent duplicate mount calls
    if (hasMountedRef.current) {
      console.log('[Cooldown] Mount effect skipped - already mounted')
      return
    }
    hasMountedRef.current = true
    
    console.log('[Cooldown] Mount effect running:', { userId: currentUserId, tool: toolRef.current, isExempt: currentIsExempt })
    
    // Block anon users, exempt users, and users not yet loaded
    if (currentIsExempt || !currentUserId || currentUserId === 'anon') {
      console.log('[Cooldown] Skipped check on mount - exempt, no userId, or anon')
      return
    }
    
    checkCooldown()
  }, []) // Empty deps - only run once on mount

  // Countdown timer - runs when onCooldown becomes true
  useEffect(() => {
    console.log('[Cooldown] Timer effect running:', { onCooldown, secondsRemaining })
    
    if (!onCooldown) {
      console.log('[Cooldown] Timer not started - onCooldown is false')
      return
    }

    console.log('[Cooldown] Starting timer interval')
    
    // Clear any existing timer before starting new one
    if (timerRef.current) {
      clearInterval(timerRef.current)
    }
    
    timerRef.current = setInterval(() => {
      setSecondsRemaining(prev => {
        const next = prev - 1
        console.log('[Cooldown] Tick:', { prev, next })
        
        if (next <= 0) {
          console.log('[Cooldown] Timer reached 0, clearing cooldown')
          setOnCooldown(false)
          return 0
        }
        return next
      })
    }, 1000)

    return () => {
      console.log('[Cooldown] Cleaning up timer')
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [onCooldown]) // Only re-run when onCooldown changes

  // Call this after a successful use to start the cooldown
  const startCooldown = useCallback(async () => {
    const currentUserId = userIdRef.current
    const currentTool = toolRef.current
    const currentIsExempt = isExemptRef.current
    
    console.log('[Cooldown] === START COOLDOWN ===', { isExempt: currentIsExempt, userId: currentUserId, tool: currentTool })
    
    // Block anon users and exempt users
    if (currentIsExempt || !currentUserId || currentUserId === 'anon') {
      console.log('[Cooldown] Skipped start - exempt, no userId, or anon')
      return
    }
    
    // OPTIMISTIC: Set state immediately for instant UI feedback
    console.log('[Cooldown] Setting optimistic cooldown state')
    setOnCooldown(true)
    setSecondsRemaining(60)
    
    // Send POST request to set cooldown on server (fire-and-forget)
    console.log('[Cooldown] POST /api/cooldown - fire and forget')
    try {
      fetch('/api/cooldown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId, tool: currentTool })
      }).then(() => {
        console.log('[Cooldown] POST completed')
      }).catch((e) => {
        console.error('[Cooldown] POST failed:', e)
      })
    } catch (e) {
      console.error('[Cooldown] POST error:', e)
    }
    
    console.log('[Cooldown] === START COOLDOWN END ===')
  }, []) // Empty deps - uses refs exclusively

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
    onCooldown: isExemptRef.current ? false : onCooldown,
    secondsRemaining,
    watchingAd,
    startCooldown,
    watchAdToSkip,
    formatTime,
    isExempt: isExemptRef.current
  }
}
