import type { Metadata } from 'next'
import PricingView from '@/app/pricing/PricingView'

export const metadata: Metadata = {
  title: 'Pricing · Stream Dreams Creator Corner',
  description:
    'Free daily analyses and tags, Pro from $9.50 CAD/month, annual Pro, a lifetime pass, and coin packs.',
}

export default function PricingPage() {
  return <PricingView />
}
