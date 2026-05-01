'use client'

import { useState, useEffect } from 'react'

interface UseMonetagOptions {
  userRole?: string
  isAdFree?: boolean
}

const AD_WAIT_MS = 6000

export function useMonetag(options?: UseMonetagOptions) {
  const { userRole, isAdFree } = options || {}
  const [adReady, setAdReady] = useState(false)

  useEffect(() => {
    // Check if Monetag show function is available
    const checkAdReady = () => {
      if (typeof window !== 'undefined') {
        const fnName = Object.keys(window).find(
          key => /^show_\d{7,}$/.test(key) && typeof (window as any)[key] === 'function'
        )
        if (fnName) {
          setAdReady(true)
          console.log('[Monetag] Ad ready:', fnName)
        }
      }
    }

    // Check immediately and then every 500ms for up to 10 seconds
    checkAdReady()
    const interval = setInterval(checkAdReady, 500)
    const timeout = setTimeout(() => clearInterval(interval), 10000)

    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }, [])

  const shouldShowAds = (): boolean => {
    if (isAdFree) return false
    const adFreeRoles = ['subscriber', 'subscriber_lifetime', 'admin', 'owner', 'tester']
    if (userRole && adFreeRoles.includes(userRole)) return false
    return true
  }

  const showAd = (count: number = 1): Promise<void> => {
    return new Promise<void>((resolve) => {
      if (!shouldShowAds()) {
        resolve()
        return
      }

      const triggerOne = (): Promise<void> => {
        return new Promise<void>((done) => {
          try {
            if (typeof window !== 'undefined') {
              // Dynamically find the Monetag show function (e.g., show_1234567)
              const fnName = Object.keys(window).find(
                key => /^show_\d{7,}$/.test(key) && typeof (window as any)[key] === 'function'
              )
              if (fnName) {
                const fn = (window as any)[fnName]
                fn()
                console.log('[Monetag] Ad triggered via', fnName)
              } else {
                console.warn('[Monetag] show function not ready yet')
              }
            }
          } catch (e) {
            console.warn('[Monetag] Error triggering ad:', e)
          }
          setTimeout(done, AD_WAIT_MS)
        })
      }

      const runAll = async () => {
        for (let i = 0; i < count; i++) {
          await triggerOne()
        }
        resolve()
      }

      runAll()
    })
  }

  return { showAd, shouldShowAds, adReady }
}
