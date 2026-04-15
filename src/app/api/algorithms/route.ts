import { NextResponse } from 'next/server'
import OpenAI from 'openai'

const platforms = [
  { id: 'tiktok', name: 'TikTok' },
  { id: 'instagram', name: 'Instagram' },
  { id: 'youtube-shorts', name: 'YouTube Shorts' },
  { id: 'youtube-long', name: 'YouTube Long' },
  { id: 'facebook-reels', name: 'Facebook Reels' }
]

// Simple file-based storage (in production, use a proper database)
const DATA_FILE = './algorithm-data.json'

async function readData() {
  try {
    const fs = await import('fs/promises')
    const path = await import('path')
    const filePath = path.join(process.cwd(), 'algorithm-data.json')
    const data = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    return { data: {}, lastUpdated: null }
  }
}

async function writeData(data: any) {
  try {
    const fs = await import('fs/promises')
    const path = await import('path')
    const filePath = path.join(process.cwd(), 'algorithm-data.json')
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
  } catch (error) {
    console.error('Error writing data:', error)
  }
}

async function researchAlgorithm(platform: string, apiKey: string) {
  const openai = new OpenAI({ apiKey })
  
  const prompt = `Research the current ${platform} algorithm and provide the following information in JSON format:
{
  "keyChanges": "Summary of key changes in how the algorithm works",
  "editingTips": "Tips for editing content for ${platform}",
  "postingTips": "Tips for when to post and posting frequency",
  "titleTips": "Tips for creating effective titles",
  "descriptionTips": "Tips for writing descriptions"
}

Focus on recent changes and best practices as of 2026. Be specific and actionable.`

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are an expert in social media algorithms and content optimization. Provide specific, actionable advice based on current best practices.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' }
    })

    const content = response.choices[0].message.content
    return JSON.parse(content || '{}')
  } catch (error) {
    console.error(`Error researching ${platform}:`, error)
    return null
  }
}

export async function GET() {
  const data = await readData()
  return NextResponse.json(data)
}

export async function POST() {
  const openaiKey = process.env.OPENAI_API_KEY
  const deepseekKey = process.env.DEEPSEEK_API_KEY

  if (!openaiKey && !deepseekKey) {
    return NextResponse.json({ error: 'No API keys configured' }, { status: 500 })
  }

  const apiKey = openaiKey || deepseekKey
  const data: any = { data: {} }

  for (const platform of platforms) {
    console.log(`Researching ${platform.name}...`)
    const result = await researchAlgorithm(platform.name, apiKey!)
    if (result) {
      data.data[platform.id] = result
    }
  }

  data.lastUpdated = new Date().toISOString()
  await writeData(data)

  return NextResponse.json(data)
}
