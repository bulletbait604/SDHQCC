import { legacyRouteGone } from '@/lib/http/legacyRouteDeprecation'

export const dynamic = 'force-dynamic'

/** @deprecated Use POST /api/clip-editor/jobs and the clip-editor pipeline instead. */
export async function POST() {
  return legacyRouteGone({
    message: 'This endpoint has been removed. Use the Clip Editor job API instead.',
    successorPath: '/api/clip-editor/jobs',
  })
}
