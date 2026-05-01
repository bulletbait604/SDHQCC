'use client'

import { useState, useEffect } from 'react'

export function useAdBlockDetect() {
  const [hasAdBlock, setHasAdBlock] = useState(false)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    const detectAdBlock = async () => {
      try {
        // Create a bait element that ad blockers typically target
        const bait = document.createElement('div')
        bait.className = 'adsbox ad ads doubleclick ad-placement ad-banner'
        bait.style.cssText = 'width: 1px; height: 1px; position: absolute; left: -9999px;'
        document.body.appendChild(bait)

        // Check if bait was blocked
        const isBlocked = !bait.offsetParent || 
                          getComputedStyle(bait).display === 'none' ||
                          getComputedStyle(bait).visibility === 'hidden'

        document.body.removeChild(bait)
        setHasAdBlock(isBlocked)
      } catch {
        setHasAdBlock(false)
      } finally {
        setChecked(true)
      }
    }

    // Delay detection slightly to let ad blockers do their work
    const timer = setTimeout(detectAdBlock, 2000)
    return () => clearTimeout(timer)
  }, [])

  return { hasAdBlock, checked }
}
