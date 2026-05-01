# SDHQ Creator Corner - Code Review Package for Claude

## Problem Summary

**File stuck in PROCESSING state for 2+ minutes, never becomes ACTIVE**

The frontend polls the Google Files API for 60 retries (2 minutes) but the file never transitions from PROCESSING to ACTIVE. This happens with a 43MB video file.

## Current Error

```
[ERROR] Gemini analysis error: {"error":{"code":400,"message":"The File r1153mb4nz53 is not in an ACTIVE state and usage is not allowed.","status":"FAILED_PRECONDITION"}}
```

## Architecture

### Flow:
1. Frontend uploads file directly to Google Files API using API key from `/api/gemini-api-key`
2. Frontend polls Files API status endpoint waiting for ACTIVE state
3. Once ACTIVE, frontend sends fileUri to `/api/clip-analyze` for analysis
4. Backend uses same GEMINI_API key to analyze the file

### Key Files:
- `src/app/page.tsx` - Frontend upload and polling logic
- `src/app/api/clip-analyze/route.ts` - Backend analysis endpoint
- `src/app/api/gemini-api-key/route.ts` - API key provider

## Frontend Code (page.tsx)

```typescript
// Upload file to Gemini Files API
const uploadRes = await fetch(uploadUrl, {
  method: 'POST',
  headers: {
    'x-goog-api-key': apiKey,
    'Content-Type': clipFile.type,
    'X-Goog-Upload-Protocol': 'resumable',
    'X-Goog-Upload-Command': 'upload, finalize',
    'X-Goog-Upload-Offset': '0'
  },
  body: clipFile
})

const uploadData = await uploadRes.json()
const fileUri = uploadData.file?.uri  // e.g., https://generativelanguage.googleapis.com/v1beta/files/39g7trkjialp
const fileState = uploadData.file?.state  // "PROCESSING"

// Poll for ACTIVE state
const maxRetries = 60
const retryDelay = 2000
let retryCount = 0
const fileId = fileUri.split('/').pop()  // "39g7trkjialp"

while (fileState !== 'ACTIVE' && retryCount < maxRetries) {
  await new Promise(resolve => setTimeout(resolve, retryDelay))
  
  const statusRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/files/${fileId}?key=${apiKey}`,
    { method: 'GET', headers: { 'Content-Type': 'application/json' } }
  )
  
  if (statusRes.ok) {
    const statusData = await statusRes.json()
    fileState = statusData.file?.state  // Always "PROCESSING"
  }
  
  retryCount++
}

// After 2 minutes, still PROCESSING, never becomes ACTIVE
// Then throws error and stops
```

## Backend Code (clip-analyze/route.ts)

```typescript
const geminiResponse = await Promise.race([
  genAI.models.generateContent({
    model: MODEL_NAME,
    contents: [{
      role: 'user',
      parts: [
        { fileData: { mimeType, fileUri } },
        { text: prompt }
      ]
    }]
  }),
  timeoutPromise
])
```

## Browser Console Logs

```
Clip Upload: File uploaded successfully. URI: https://generativelanguage.googleapis.com/v1beta/files/39g7trkjialp
Clip Upload: Initial state: PROCESSING
Clip Upload: File state is PROCESSING, waiting... (attempt 1/60)
...
Clip Upload: File state is PROCESSING, waiting... (attempt 60/60)
Clip Upload: File did not become ACTIVE after 60 retries
```

File stayed in PROCESSING for full 2 minutes, never became ACTIVE.

## Questions for Claude

1. **Why does the file never become ACTIVE?**
   - Is this a quota issue, file size issue, or API limitation?
   - Does Google Files API have known issues with video processing?

2. **Is the polling approach correct?**
   - Should we be checking a different endpoint?
   - Is there a webhook or callback instead of polling?

3. **Alternative approaches:**
   - Should we upload the file bytes directly in the generateContent call instead of using fileUri?
   - Should we use a different upload method (non-resumable)?
   - Should we implement chunked upload differently?

4. **API key vs OAuth:**
   - We're using API key for both upload and analysis
   - Should we be using OAuth/service account instead?

5. **File size limits:**
   - The file is 43MB, under the 250MB limit
   - Does Gemini have issues with certain video formats or sizes?

## Environment

- Vercel serverless deployment
- @google/genai v0.1.0
- gemini-2.5-flash model
- Video file: 43MB, MP4 format

## Complete Route Files

### clip-analyze/route.ts

```typescript
import { NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'

export const dynamic = 'force-dynamic'
const MODEL_NAME = 'gemini-2.5-flash'

// ... rate limiting code ...

export async function POST(request: Request) {
  // ... validation ...
  
  const geminiApiKey = process.env.GEMINI_API
  const genAI = new GoogleGenAI({ apiKey: geminiApiKey })
  
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Gemini API timeout after 52 seconds')), 52000)
  })
  
  const geminiResponse = await Promise.race([
    genAI.models.generateContent({
      model: MODEL_NAME,
      contents: [{
        role: 'user',
        parts: [
          { fileData: { mimeType, fileUri } },
          { text: prompt }
        ]
      }]
    }),
    timeoutPromise
  ]) as any
  
  // ... parse response ...
}
```

### gemini-api-key/route.ts

```typescript
export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API
  return NextResponse.json({ apiKey })
}
```

## What We've Tried

1. ✅ Added polling logic to wait for ACTIVE state
2. ✅ Increased polling to 2 minutes (60 retries)
3. ✅ Same API key used for upload and analysis
4. ❌ File never becomes ACTIVE

## Hypotheses

1. Google Files API video processing is broken or extremely slow
2. API key authentication doesn't work properly for video files
3. Need to use OAuth/service account instead of API key
4. Should upload bytes directly in generateContent instead of fileUri
5. Video format/encoding issue causing processing to hang
