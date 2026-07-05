'use client'

import { BRAND_FULL, BRAND_LOGO_ALT, BRAND_LOGO_PATH, BRAND_SHORT } from '@/lib/destiny/branding'
import { cn } from '@/lib/utils'

interface Props {
  title?: string
  tagline?: string
  /** Compact height for nested panels */
  compact?: boolean
  className?: string
}

/**
 * Horizontal banner — logo crest left, title + tagline right.
 * Background echoes the logo's arc / solar split and bronze frame.
 */
export default function TopNestBrandBanner({ title, tagline, compact, className }: Props) {
  return (
    <header className={cn('tn-brand-banner', compact && 'tn-brand-banner-compact', className)}>
      <div className="tn-brand-banner-glow tn-brand-banner-glow-arc" aria-hidden />
      <div className="tn-brand-banner-glow tn-brand-banner-glow-solar" aria-hidden />
      <div className="tn-brand-banner-frame" aria-hidden />

      <div className="tn-brand-banner-inner">
        <div className="tn-brand-logo-wrap">
          <img
            src={BRAND_LOGO_PATH}
            alt={BRAND_LOGO_ALT}
            className="tn-brand-logo"
            width={compact ? 72 : 96}
            height={compact ? 72 : 96}
            decoding="async"
          />
        </div>

        <div className="tn-brand-copy min-w-0 flex-1">
          <p className="tn-brand-eyebrow">{BRAND_FULL}</p>
          <h1 className="tn-brand-title truncate">{title ?? BRAND_SHORT}</h1>
          {tagline ? <p className="tn-brand-tagline line-clamp-2">{tagline}</p> : null}
        </div>
      </div>
    </header>
  )
}

/** Small logo mark for tabs, loading states, empty states. */
export function TopNestLogoMark({
  size = 40,
  className,
}: {
  size?: number
  className?: string
}) {
  return (
    <img
      src={BRAND_LOGO_PATH}
      alt=""
      aria-hidden
      className={cn('tn-brand-mark object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]', className)}
      width={size}
      height={size}
    />
  )
}
