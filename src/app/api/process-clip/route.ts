import { legacyRouteGone } from '@/lib/http/legacyRouteDeprecation'

export const dynamic = 'force-dynamic'

/** @deprecated Clip Editor has been removed. */
export async function POST() {
  return legacyRouteGone({
    message: 'This endpoint has been removed.',
    successorPath: '/api/viral-clip-gen',
  })
}
