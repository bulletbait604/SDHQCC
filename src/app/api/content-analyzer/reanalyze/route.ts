import { legacyRouteGone } from '@/lib/http/legacyRouteDeprecation'

export const dynamic = 'force-dynamic'

/** @deprecated Re-run analysis via POST /api/clip-analyze with a new platform selection. */
export async function POST() {
  return legacyRouteGone({
    message: 'Platform reanalysis is handled by Clip Analyze.',
    successorPath: '/api/clip-analyze',
  })
}
