'use client'

export function useMonetag() {
  const showAd = () => {
    return new Promise<void>((resolve) => {
      try {
        // Trigger Monetag vignette
        if (typeof window !== 'undefined' && (window as any).monetag) {
          (window as any).monetag.show()
        }
      } catch (e) {
        console.warn('Monetag not loaded yet')
      }
      // Resolve after 5 seconds regardless — don't block the user forever
      setTimeout(resolve, 5000)
    })
  }

  return { showAd }
}
