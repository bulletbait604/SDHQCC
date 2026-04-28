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

// Generate presigned URL for upload (valid for 5 minutes)
export async function generateUploadUrl(filename: string, contentType: string): Promise<{ uploadUrl: string; fileKey: string; publicUrl: string } | null> {
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    console.error('R2 credentials not configured')
    return null
  }

  const timestamp = Date.now()
  const fileKey = `uploads/${timestamp}-${filename}`

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
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: fileKey,
    })

    const response = await r2Client.send(command)
    
    if (!response.Body) {
      return null
    }

    // Convert stream to buffer
    const chunks: Buffer[] = []
    for await (const chunk of response.Body as any) {
      chunks.push(chunk)
    }
    
    return Buffer.concat(chunks)
  } catch (error) {
    console.error('Error getting file from R2:', error)
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
