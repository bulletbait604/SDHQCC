import { GoogleGenAI } from '@google/genai'
import { extractFirstJsonObject } from '@/lib/clip-editor/parseJson'
import { clipEditorGeminiModel, openAiFallbackEnabled } from '@/lib/clip-editor/env'
import { z, type ZodError } from 'zod'

function geminiClient(): GoogleGenAI {
  const apiKey = (process.env.GEMINI_API || process.env.GOOGLE_API_KEY || '').trim()
  if (!apiKey) throw new Error('GEMINI_API is not configured')
  return new GoogleGenAI({ apiKey })
}

function formatZodError(error: ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
    .join('; ')
}

async function callOpenAiJson(prompt: string): Promise<string> {
  const apiKey = (process.env.OPENAI_API_KEY || '').trim()
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured for fallback')
  const model = (process.env.CLIP_EDITOR_OPENAI_MODEL || 'gpt-4o-mini').trim()
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'Return valid JSON only. No markdown.' },
        { role: 'user', content: prompt },
      ],
    }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`OpenAI fallback failed (${res.status}): ${text.slice(0, 200)}`)
  }
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('OpenAI fallback returned empty content')
  return content
}

export async function geminiJsonPass<T extends z.ZodType>(
  schema: T,
  prompt: string,
  options?: {
    videoFileUri?: string
    mimeType?: string
    /** OpenAI cannot see video; default false when videoFileUri is set */
    allowOpenAiFallback?: boolean
    preprocess?: (parsed: unknown) => unknown
  }
): Promise<z.infer<T>> {
  const model = clipEditorGeminiModel()
  const allowFallback =
    options?.allowOpenAiFallback ?? (options?.videoFileUri ? false : true)
  let rawText = ''

  try {
    const ai = geminiClient()
    const parts: Array<{ text: string } | { fileData: { fileUri: string; mimeType: string } }> = [
      { text: prompt },
    ]
    if (options?.videoFileUri) {
      parts.unshift({
        fileData: {
          fileUri: options.videoFileUri,
          mimeType: options.mimeType || 'video/mp4',
        },
      })
    }
    const response = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts }],
      config: {
        temperature: 0.25,
        responseMimeType: 'application/json',
      },
    })
    rawText = response.text || ''
    if (!rawText.trim()) {
      throw new Error('Gemini returned empty response')
    }
  } catch (geminiError) {
    if (!allowFallback || !openAiFallbackEnabled()) {
      const msg = geminiError instanceof Error ? geminiError.message : String(geminiError)
      throw new Error(
        options?.videoFileUri
          ? `Gemini video analysis failed: ${msg}`
          : `Gemini request failed: ${msg}`
      )
    }
    rawText = await callOpenAiJson(prompt)
  }

  const jsonSlice = extractFirstJsonObject(rawText) || rawText.trim()
  let parsed: unknown
  try {
    parsed = JSON.parse(jsonSlice) as unknown
  } catch {
    throw new Error(
      `AI returned invalid JSON (${rawText.slice(0, 120).replace(/\s+/g, ' ')}...)`
    )
  }

  if (options?.preprocess) {
    parsed = options.preprocess(parsed)
  }

  try {
    return schema.parse(parsed)
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`AI response validation failed: ${formatZodError(error)}`)
    }
    throw error
  }
}
