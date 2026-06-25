import { NextRequest, NextResponse } from 'next/server'
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { isSafeR2ObjectKey } from '@/lib/r2KeyValidation'
import { verifyAuth, AuthError } from '@/lib/auth/verifyAuth'

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

const BUCKET = process.env.R2_BUCKET_NAME!

function userOwnsUploadKey(key: string, username: string): boolean {
  const safeUser = username.replace(/^@/, '').toLowerCase().replace(/[^a-z0-9_-]/g, '_').slice(0, 64)
  return key.startsWith(`uploads/clips/${safeUser}/`)
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const key = searchParams.get('key')

    if (!key) {
      return NextResponse.json({ error: 'Missing key parameter' }, { status: 400 })
    }

    if (!isSafeR2ObjectKey(key)) {
      return NextResponse.json({ error: 'Invalid key' }, { status: 403 })
    }

    if (key.startsWith('uploads/')) {
      try {
        const user = await verifyAuth(request)
        if (!userOwnsUploadKey(key, user.username)) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
      } catch (error) {
        if (error instanceof AuthError) {
          return NextResponse.json({ error: error.message }, { status: error.statusCode })
        }
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
      }
    }

    const command = new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
    })

    const response = await r2.send(command)

    if (!response.Body) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 })
    }

    const chunks: Buffer[] = []
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
      chunks.push(Buffer.from(chunk))
    }
    const buffer = Buffer.concat(chunks)

    const cacheControl = key.startsWith('thumbnails/')
      ? 'public, max-age=31536000'
      : 'private, max-age=3600'

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': response.ContentType || 'image/png',
        'Cache-Control': cacheControl,
      },
    })
  } catch (error: unknown) {
    console.error('[Image Proxy] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch image' }, { status: 500 })
  }
}
