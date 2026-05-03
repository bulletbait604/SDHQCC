import { NextRequest, NextResponse } from 'next/server'
import { generateUploadUrl } from '@/lib/r2'
import { verifyAuth, AuthError, createAuthErrorResponse } from '@/lib/auth/verifyAuth'

const isProd = process.env.NODE_ENV === 'production'

export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth(request)

    console.log('Upload URL API: Request received')
    const body = await request.json()
    const { filename, contentType, purpose } = body as {
      filename?: string
      contentType?: string
      purpose?: string
    }
    console.log('Upload URL API: Request body:', { filename, contentType, purpose })

    if (!filename || !contentType) {
      console.error('Upload URL API: Missing filename or contentType')
      return NextResponse.json({ error: 'Filename and contentType are required' }, { status: 400 })
    }

    const validVideoTypes = [
      'video/mp4',
      'video/webm',
      'video/quicktime',
      'video/x-msvideo',
      'video/x-matroska',
    ]

    if (!validVideoTypes.includes(contentType)) {
      console.error('Upload URL API: Invalid content type:', contentType)
      return NextResponse.json(
        { error: `Invalid file type: ${contentType}. Only video files are allowed.` },
        { status: 400 }
      )
    }

    console.log('Upload URL API: Content type valid, generating presigned URL...')
    console.log('Upload URL API: R2_ACCOUNT_ID present:', !!process.env.R2_ACCOUNT_ID)
    console.log('Upload URL API: R2_ACCESS_KEY_ID present:', !!process.env.R2_ACCESS_KEY_ID)
    console.log('Upload URL API: R2_SECRET_ACCESS_KEY present:', !!process.env.R2_SECRET_ACCESS_KEY)
    console.log('Upload URL API: R2_BUCKET_NAME:', process.env.R2_BUCKET_NAME || 'sdhq-uploads (default)')

    if (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
      console.error('Upload URL API: MISSING R2 CREDENTIALS!')
      return NextResponse.json(
        {
          error: 'R2 credentials not configured',
          missing: {
            R2_ACCOUNT_ID: !process.env.R2_ACCOUNT_ID,
            R2_ACCESS_KEY_ID: !process.env.R2_ACCESS_KEY_ID,
            R2_SECRET_ACCESS_KEY: !process.env.R2_SECRET_ACCESS_KEY,
          },
        },
        { status: 500 }
      )
    }

    let result
    try {
      result = await generateUploadUrl(filename, contentType, {
        clipUsername: purpose === 'clip-analyzer' ? user.username : undefined,
      })
    } catch (generateError: unknown) {
      console.error('Upload URL API: Error in generateUploadUrl:', generateError)
      const genErrorMessage = generateError instanceof Error ? generateError.message : 'Unknown generate error'
      return NextResponse.json(
        isProd
          ? { error: 'Failed to generate upload URL' }
          : {
              error: `generateUploadUrl failed: ${genErrorMessage}`,
              stack: generateError instanceof Error ? generateError.stack : '',
            },
        { status: 500 }
      )
    }

    if (!result) {
      console.error('Upload URL API: Failed to generate upload URL - R2 credentials may be missing')
      return NextResponse.json({ error: 'Failed to generate upload URL. R2 may not be configured.' }, { status: 500 })
    }

    console.log('Upload URL API: Successfully generated presigned URL for fileKey:', result.fileKey)

    return NextResponse.json({
      uploadUrl: result.uploadUrl,
      fileKey: result.fileKey,
      publicUrl: result.publicUrl,
      expiresIn: 300,
    })
  } catch (error: unknown) {
    if (error instanceof AuthError) return createAuthErrorResponse(error)
    console.error('Upload URL API: CRITICAL ERROR:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    return NextResponse.json(
      isProd
        ? { error: 'Upload URL generation failed' }
        : {
            error: `Upload URL generation failed: ${errorMessage}`,
            errorName: error instanceof Error ? error.name : 'Unknown',
            errorStack: error instanceof Error ? error.stack : '',
            hint: 'Check if R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY are set in Vercel environment variables',
          },
      { status: 500 }
    )
  }
}
