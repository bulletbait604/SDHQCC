'use client'

interface UseMonetagOptions {
  userRole?: string
  isAdFree?: boolean
}

const MONETAG_SHOW_FN = 'show_9103571'
const AD_WAIT_MS = 6000

export function useMonetag(options?: UseMonetagOptions) {
  const { userRole, isAdFree } = options || {}

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
              const fn = (window as any)[MONETAG_SHOW_FN]
              if (typeof fn === 'function') {
                fn()
                console.log('[Monetag] Ad triggered via', MONETAG_SHOW_FN)
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

  return { showAd, shouldShowAds }
}
