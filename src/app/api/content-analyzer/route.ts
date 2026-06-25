import { legacyRouteGone } from '@/lib/http/legacyRouteDeprecation'

export const dynamic = 'force-dynamic'

/** @deprecated Use POST /api/clip-analyze instead. */
export async function POST() {
  return legacyRouteGone({
    message: 'Content Analyzer has been replaced by Clip Analyze.',
    successorPath: '/api/clip-analyze',
  })
}
