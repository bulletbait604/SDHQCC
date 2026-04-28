import { NextRequest, NextResponse } from 'next/server'
import { generateUploadUrl } from '@/lib/r2'

export async function POST(request: NextRequest) {
  try {
    const { filename, contentType } = await request.json()

    if (!filename || !contentType) {
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
      return NextResponse.json(
        { error: 'Invalid file type. Only video files are allowed.' },
        { status: 400 }
      )
    }

    // Generate presigned URL for R2 upload
    const result = await generateUploadUrl(filename, contentType)

    if (!result) {
      return NextResponse.json(
        { error: 'Failed to generate upload URL. R2 may not be configured.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      uploadUrl: result.uploadUrl,
      fileKey: result.fileKey,
      publicUrl: result.publicUrl,
      expiresIn: 300, // 5 minutes
    })
  } catch (error) {
    console.error('Error generating upload URL:', error)
    return NextResponse.json(
      { error: 'Failed to generate upload URL' },
      { status: 500 }
    )
  }
}
