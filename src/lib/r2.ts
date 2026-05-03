import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// R2 is S3-compatible
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'sdhq-uploads'

// R2 endpoint
const R2_ENDPOINT = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`

// Initialize S3 client for R2
export const r2Client = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID || '',
    secretAccessKey: R2_SECRET_ACCESS_KEY || '',
  },
})

function sanitizePathSegment(s: string): string {
  return s.replace(/^@/, '').toLowerCase().replace(/[^a-z0-9_-]/g, '_').slice(0, 64) || 'user'
}

/** Safe filename for object key (no path separators) */
function sanitizeFilename(filename: string): string {
  const base = filename.split(/[/\\]/).pop() || 'video.mp4'
  return base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 160)
}

export type GenerateUploadUrlOpts = {
  /** Clip analyzer: `uploads/clips/<user>/<ts>-<file>` so the analyze API can authorize deletes */
  clipUsername?: string
}

// Generate presigned URL for upload (valid for 5 minutes)
export async function generateUploadUrl(
  filename: string,
  contentType: string,
  opts?: GenerateUploadUrlOpts
): Promise<{ uploadUrl: string; fileKey: string; publicUrl: string } | null> {
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    console.error('R2 credentials not configured')
    return null
  }

  const timestamp = Date.now()
  const safeName = sanitizeFilename(filename)
  const fileKey = opts?.clipUsername
    ? `uploads/clips/${sanitizePathSegment(opts.clipUsername)}/${timestamp}-${safeName}`
    : `uploads/${timestamp}-${filename}`

  try {
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: fileKey,
      ContentType: contentType,
    })

    // URL expires in 5 minutes
    const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn: 300 })
    
    // Public URL for reading (requires public bucket or custom domain)
    const publicUrl = `${R2_ENDPOINT}/${R2_BUCKET_NAME}/${fileKey}`

    return { uploadUrl, fileKey, publicUrl }
  } catch (error) {
    console.error('Error generating upload URL:', error)
    return null
  }
}

// Get file from R2 for processing
export async function getFileFromR2(fileKey: string): Promise<Buffer | null> {
  try {
    console.log(`R2: Getting file from bucket ${R2_BUCKET_NAME}, key: ${fileKey}`)
    console.log(`R2: R2_ACCOUNT_ID present: ${!!R2_ACCOUNT_ID}`)
    console.log(`R2: R2_ACCESS_KEY_ID present: ${!!R2_ACCESS_KEY_ID}`)
    console.log(`R2: R2_SECRET_ACCESS_KEY present: ${!!R2_SECRET_ACCESS_KEY}`)
    
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: fileKey,
    })

    console.log(`R2: Sending GetObjectCommand...`)
    const response = await r2Client.send(command)
    
    if (!response.Body) {
      console.error('R2: Response body is empty')
      return null
    }

    console.log(`R2: Response received, streaming body...`)
    // Convert stream to buffer
    const chunks: Buffer[] = []
    for await (const chunk of response.Body as any) {
      chunks.push(chunk)
    }
    
    const buffer = Buffer.concat(chunks)
    console.log(`R2: File retrieved successfully, size: ${buffer.length} bytes`)
    return buffer
  } catch (error) {
    console.error('R2: Error getting file from R2:', error)
    if (error instanceof Error) {
      console.error('R2: Error name:', error.name)
      console.error('R2: Error message:', error.message)
      console.error('R2: Error stack:', error.stack)
    }
    return null
  }
}

// Delete file from R2 after processing
export async function deleteFileFromR2(fileKey: string): Promise<boolean> {
  try {
    const command = new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: fileKey,
    })

    await r2Client.send(command)
    console.log(`✅ Deleted file from R2: ${fileKey}`)
    return true
  } catch (error) {
    console.error('Error deleting file from R2:', error)
    return false
  }
}
