# Thumbnail Generator - Complete Code Review Package

## Overview
This is the complete Thumbnail Generator implementation for the Stream Dreams Creator Corner app.

**Stack:**
- Next.js 14 (App Router)
- `@google/genai` SDK (NOT `@google/generative-ai`)
- Cloudflare R2 for image storage
- Tailwind CSS + shadcn/ui

**Model:** `gemini-3.1-flash-image-preview`

---

## File 1: API Route - `/api/thumbnail-generator/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { GoogleGenAI, Modality } from "@google/genai";
import { v4 as uuidv4 } from "uuid";

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API! });

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mimeType, prompt, sessionId } = await req.json();

    if (!imageBase64 || !prompt) {
      return NextResponse.json({ error: "Missing imageBase64 or prompt" }, { status: 400 });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-image-preview",
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { data: imageBase64, mimeType: mimeType || "image/jpeg" } },
            { text: `You are a professional thumbnail designer. Transform this image into a striking YouTube/social media thumbnail.\n\nInstructions: ${prompt}\n\nRequirements:\n- High contrast, eye-catching composition\n- Bold visual hierarchy\n- Optimised for 1280x720 landscape format\n- Vibrant colours that pop on both dark and light backgrounds` },
          ],
        },
      ],
      config: {
        responseModalities: [Modality.TEXT, Modality.IMAGE],
      },
    });

    const parts = response.candidates?.[0]?.content?.parts ?? [];
    const imgPart = parts.find((p: any) => p.inlineData?.mimeType?.startsWith("image/"));

    if (!imgPart?.inlineData) {
      return NextResponse.json({ error: "Gemini did not return an image. Try rephrasing your prompt." }, { status: 500 });
    }

    const imgBuffer = Buffer.from(imgPart.inlineData.data, "base64");
    const ext = imgPart.inlineData.mimeType.split("/")[1]?.split(";")[0] || "png";
    const key = `thumbnails/${sessionId || uuidv4()}/${uuidv4()}.${ext}`;

    await r2.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      Body: imgBuffer,
      ContentType: imgPart.inlineData.mimeType,
      Metadata: { prompt: prompt.slice(0, 1024) },
    }));

    const textPart = parts.find((p: any) => p.text);

    return NextResponse.json({
      url: `/api/image?key=${key}`,
      key,
      description: textPart?.text || "",
    });

  } catch (err: any) {
    console.error("[Thumbnail] Gemini API error:", err);
    return NextResponse.json({ error: `Gemini error: ${err.message}` }, { status: 500 });
  }
}
```

---

## File 2: Image Proxy Route - `/api/image/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

const BUCKET = process.env.R2_BUCKET_NAME!

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const key = searchParams.get('key')

    if (!key) {
      return NextResponse.json({ error: 'Missing key parameter' }, { status: 400 })
    }

    // Security: Validate key format to prevent path traversal
    if (!key.startsWith('thumbnails/') && !key.startsWith('uploads/')) {
      return NextResponse.json({ error: 'Invalid key' }, { status: 403 })
    }

    const command = new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
    })

    const response = await r2.send(command)

    if (!response.Body) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 })
    }

    // Convert stream to buffer
    const chunks: Buffer[] = []
    for await (const chunk of response.Body as any) {
      chunks.push(chunk)
    }
    const buffer = Buffer.concat(chunks)

    // Return image with proper headers
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': response.ContentType || 'image/png',
        'Cache-Control': 'public, max-age=31536000', // 1 year cache
      },
    })
  } catch (error: any) {
    console.error('[Image Proxy] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch image' },
      { status: 500 }
    )
  }
}
```

---

## File 3: Frontend - React Component (from page.tsx)

### State Variables
```typescript
// Thumbnail Generator states
const [thumbnailImage, setThumbnailImage] = useState<File | null>(null)
const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null)
const [thumbnailPrompt, setThumbnailPrompt] = useState<string>('')
const [generatedThumbnail, setGeneratedThumbnail] = useState<string | null>(null)
const [isGeneratingThumbnail, setIsGeneratingThumbnail] = useState<boolean>(false)
const [thumbnailError, setThumbnailError] = useState<string>('')
const [thumbnailHistory, setThumbnailHistory] = useState<Array<{image: string, prompt: string}>>([])
```

### File Upload Handler
```typescript
const handleThumbnailImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0]
  if (file) {
    setThumbnailImage(file)
    const reader = new FileReader()
    reader.onloadend = () => {
      setThumbnailPreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }
}
```

### Main Generate Button Handler
```typescript
<Button
  onClick={async () => {
    if (!thumbnailPrompt.trim()) return
    
    setIsGeneratingThumbnail(true)
    setThumbnailError('')
    
    try {
      // Convert image to base64 if provided
      let imageBase64: string | undefined
      let mimeType: string | undefined
      
      if (thumbnailImage) {
        const reader = new FileReader()
        imageBase64 = await new Promise<string>((resolve) => {
          reader.onloadend = () => {
            const base64 = reader.result as string
            // Remove data:image/xxx;base64, prefix
            resolve(base64.split(',')[1])
          }
          reader.readAsDataURL(thumbnailImage)
        })
        mimeType = thumbnailImage.type
      }
      
      const response = await fetch('/api/thumbnail-generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: thumbnailPrompt,
          userId: user?.id || '',
          userType: userType,
          imageBase64,
          mimeType,
          sessionId: user?.id || 'anon'
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate thumbnail')
      }
      
      const data = await response.json()
      setGeneratedThumbnail(data.imageBase64)
    } catch (error: any) {
      setThumbnailError(error.message || 'Failed to generate thumbnail. Please try again.')
    } finally {
      setIsGeneratingThumbnail(false)
    }
  }}
  disabled={isGeneratingThumbnail || !thumbnailPrompt.trim()}
>
  {isGeneratingThumbnail ? 'Generating...' : 'Generate Thumbnail'}
</Button>
```

### Re-Prompt (Re-edit) Handler
```typescript
<Button
  onClick={async () => {
    if (!thumbnailPrompt.trim()) return
    
    setIsGeneratingThumbnail(true)
    setThumbnailError('')
    
    try {
      const response = await fetch('/api/thumbnail-generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: thumbnailPrompt,
          userId: user?.id || '',
          userType: userType,
          imageBase64: generatedThumbnail!,  // Use previously generated image
          mimeType: 'image/png',
          sessionId: user?.id || 'anon'
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate thumbnail')
      }
      
      const data = await response.json()
      
      // Save to history
      setThumbnailHistory(prev => [...prev, { 
        image: generatedThumbnail!, 
        prompt: thumbnailPrompt 
      }])
      
      setGeneratedThumbnail(data.imageBase64)
      setThumbnailPrompt('')
    } catch (error: any) {
      setThumbnailError(error.message || 'Failed to generate thumbnail. Please try again.')
    } finally {
      setIsGeneratingThumbnail(false)
    }
  }}
  disabled={isGeneratingThumbnail || !thumbnailPrompt.trim() || !generatedThumbnail}
>
  Re-prompt
</Button>
```

---

## File 4: Package.json Dependencies

```json
{
  "dependencies": {
    "@aws-sdk/client-s3": "^3.450.0",
    "@aws-sdk/s3-request-presigner": "^3.450.0",
    "@google/genai": "^1.0.0",
    "uuid": "^9.0.0"
  }
}
```

**Note:** `@google/generative-ai` has been removed in favor of `@google/genai`

---

## Environment Variables Required

```env
# Google Gemini API
GEMINI_API=your_gemini_api_key_here

# Cloudflare R2
R2_ACCOUNT_ID=your_cloudflare_account_id
R2_ACCESS_KEY_ID=your_r2_access_key
R2_SECRET_ACCESS_KEY=your_r2_secret_key
R2_BUCKET_NAME=sdhq-uploads
R2_PUBLIC_URL=https://your-custom-domain.com (optional, for direct URLs)
```

---

## API Request/Response Format

### Request
```json
{
  "imageBase64": "base64_encoded_image_data_without_prefix",
  "mimeType": "image/jpeg",
  "prompt": "Make it look like a gaming thumbnail with red lighting",
  "sessionId": "user-session-id",
  "userId": "user-id",
  "userType": "free"
}
```

### Response
```json
{
  "url": "/api/image?key=thumbnails/abc123/def456.png",
  "key": "thumbnails/abc123/def456.png",
  "description": "Generated thumbnail with gaming style"
}
```

---

## Key Features

1. **SDK:** Uses `@google/genai` with `GoogleGenAI` class and `Modality` enum
2. **Model:** `gemini-3.1-flash-image-preview` (supports image generation)
3. **R2 Storage:** All generated images saved to Cloudflare R2
4. **Image Proxy:** `/api/image?key=...` serves images through your domain
5. **Re-edit Support:** Can use generated image as input for further edits
6. **JSON API:** Frontend sends JSON (not FormData) with base64 images

---

## Current Status

✅ All code implemented
✅ npm install completed (removed `@google/generative-ai`, using `@google/genai`)
✅ Committed and pushed to git
⚠️ Waiting for Vercel redeploy (user out of deploy credits)
