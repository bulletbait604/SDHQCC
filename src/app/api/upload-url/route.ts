import { NextRequest, NextResponse } from 'next/server'
import { generateUploadUrl } from '@/lib/r2'

export async function POST(request: NextRequest) {
  try {
    console.log('Upload URL API: Request received')
    const { filename, contentType } = await request.json()
    console.log('Upload URL API: Request body:', { filename, contentType })

    if (!filename || !contentType) {
      console.error('Upload URL API: Missing filename or contentType')
      return NextResponse.json(
        { error: 'Filename and contentType are required' },
        { status: 400 }
      )
    }

    // Validate content type is a video
    const validVideoTypes = [
      'video/mp4',
      'video/webm', 
      'video/quicktime',
      'video/x-msvideo',
      'video/x-matroska'
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

    // Check credentials before calling generateUploadUrl
    if (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
      console.error('Upload URL API: MISSING R2 CREDENTIALS!')
      console.error('Upload URL API: R2_ACCOUNT_ID:', process.env.R2_ACCOUNT_ID ? 'Set' : 'MISSING')
      console.error('Upload URL API: R2_ACCESS_KEY_ID:', process.env.R2_ACCESS_KEY_ID ? 'Set' : 'MISSING')
      console.error('Upload URL API: R2_SECRET_ACCESS_KEY:', process.env.R2_SECRET_ACCESS_KEY ? 'Set' : 'MISSING')
      return NextResponse.json(
        { 
          error: 'R2 credentials not configured',
          missing: {
            R2_ACCOUNT_ID: !process.env.R2_ACCOUNT_ID,
            R2_ACCESS_KEY_ID: !process.env.R2_ACCESS_KEY_ID,
            R2_SECRET_ACCESS_KEY: !process.env.R2_SECRET_ACCESS_KEY
          }
        },
        { status: 500 }
      )
    }

    // Generate presigned URL for R2 upload
    let result
    try {
      result = await generateUploadUrl(filename, contentType)
    } catch (generateError) {
      console.error('Upload URL API: Error in generateUploadUrl:', generateError)
      const genErrorMessage = generateError instanceof Error ? generateError.message : 'Unknown generate error'
      const genErrorStack = generateError instanceof Error ? generateError.stack : ''
      return NextResponse.json(
        { 
          error: `generateUploadUrl failed: ${genErrorMessage}`,
          stack: genErrorStack
        },
        { status: 500 }
      )
    }

    if (!result) {
      console.error('Upload URL API: Failed to generate upload URL - R2 credentials may be missing')
      return NextResponse.json(
        { error: 'Failed to generate upload URL. R2 may not be configured.' },
        { status: 500 }
      )
    }

    console.log('Upload URL API: Successfully generated presigned URL for fileKey:', result.fileKey)

    return NextResponse.json({
      uploadUrl: result.uploadUrl,
      fileKey: result.fileKey,
      publicUrl: result.publicUrl,
      expiresIn: 300, // 5 minutes
    })
  } catch (error) {
    console.error('Upload URL API: CRITICAL ERROR:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : ''
    const errorName = error instanceof Error ? error.name : 'Unknown'
    
    console.error('Upload URL API: Error name:', errorName)
    console.error('Upload URL API: Error message:', errorMessage)
    console.error('Upload URL API: Error stack:', errorStack)
    
    // Return full error details for debugging
    return NextResponse.json(
      { 
        error: `Upload URL generation failed: ${errorMessage}`,
        errorName: errorName,
        errorStack: errorStack,
        hint: 'Check if R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY are set in Vercel environment variables'
      },
      { status: 500 }
    )
  }
}
