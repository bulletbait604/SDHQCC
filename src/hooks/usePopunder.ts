'use client'

import { useState, useEffect, useCallback } from 'react'

export function usePopunder() {
  const [popunderReady, setPopunderReady] = useState(false)

  useEffect(() => {
    // Check if Monetag popunder function is available
    const checkReady = () => {
      if (typeof window !== 'undefined') {
        // Monetag popunder scripts typically expose a function like show_XXXXXX
        const fnName = Object.keys(window).find(
          key => /^show_\d{7,}$/.test(key) && typeof (window as any)[key] === 'function'
        )
        if (fnName) {
          setPopunderReady(true)
          console.log('[Popunder] Ready:', fnName)
        }
      }
    }

    checkReady()
    const interval = setInterval(checkReady, 500)
    const timeout = setTimeout(() => clearInterval(interval), 15000)

    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }, [])

  const showPopunder = useCallback(() => {
    if (typeof window !== 'undefined') {
      const fnName = Object.keys(window).find(
        key => /^show_\d{7,}$/.test(key) && typeof (window as any)[key] === 'function'
      )
      if (fnName) {
        try {
          ;(window as any)[fnName]()
          console.log('[Popunder] Triggered via', fnName)
        } catch (e) {
          console.warn('[Popunder] Error:', e)
        }
      } else {
        console.warn('[Popunder] Function not ready yet')
      }
    }
  }, [])

  return { showPopunder, popunderReady }
}
