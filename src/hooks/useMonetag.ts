'use client'

interface UseMonetagOptions {
  userRole?: string
  isAdFree?: boolean
}

export function useMonetag(options?: UseMonetagOptions) {
  const { userRole, isAdFree } = options || {}
  
  // Check if user should see ads (free users only)
  const shouldShowAds = () => {
    if (isAdFree) return false
    // Ad-free roles: subscriber, lifetime, admin, owner, tester
    const adFreeRoles = ['subscriber', 'subscriber_lifetime', 'admin', 'owner', 'tester']
    if (userRole && adFreeRoles.includes(userRole)) return false
    return true
  }

  const showAd = (count: number = 1) => {
    return new Promise<void>((resolve) => {
      // Skip ads for subscribers/admins/owners
      if (!shouldShowAds()) {
        resolve()
        return
      }

      const showSingleAd = () => {
        return new Promise<void>((adResolve) => {
          try {
            // Trigger Monetag vignette
            if (typeof window !== 'undefined' && (window as any).monetag) {
              (window as any).monetag.show()
            }
          } catch (e) {
            console.warn('Monetag not loaded yet')
          }
          // Resolve after 5 seconds
          setTimeout(adResolve, 5000)
        })
      }

      // Show ads back-to-back
      const showAds = async () => {
        for (let i = 0; i < count; i++) {
          await showSingleAd()
        }
        resolve()
      }

      showAds()
    })
  }

  return { showAd, shouldShowAds }
}
