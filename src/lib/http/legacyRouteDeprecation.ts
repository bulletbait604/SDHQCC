import { NextResponse } from 'next/server'

/** Standard 410 Gone for removed legacy API routes (RFC 8594 Deprecation headers). */
export function legacyRouteGone(options: {
  message: string
  successorPath: string
}): NextResponse {
  const res = NextResponse.json(
    {
      error: 'Gone',
      message: options.message,
      successor: options.successorPath,
    },
    { status: 410 }
  )
  res.headers.set('Deprecation', 'true')
  res.headers.set('Sunset', 'Sat, 01 Jan 2028 00:00:00 GMT')
  res.headers.set('Link', `<${options.successorPath}>; rel="successor-version"`)
  return res
}
