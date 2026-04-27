import { NextRequest, NextResponse } from 'next/server'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

// File path for persistent storage
const LOGS_FILE_PATH = path.join(process.cwd(), 'data', 'activity-logs.json')

// Load logs from file on startup
let activityLogs: any[] = []

async function loadLogsFromFile() {
  try {
    if (existsSync(LOGS_FILE_PATH)) {
      const data = await readFile(LOGS_FILE_PATH, 'utf-8')
      activityLogs = JSON.parse(data)
      console.log('Loaded activity logs from file:', activityLogs.length)
    } else {
      activityLogs = []
      console.log('No existing logs file found, starting fresh')
    }
  } catch (error) {
    console.error('Error loading logs from file:', error)
    activityLogs = []
  }
}

// Save logs to file
async function saveLogsToFile() {
  try {
    // Ensure data directory exists
    const dataDir = path.dirname(LOGS_FILE_PATH)
    if (!existsSync(dataDir)) {
      await mkdir(dataDir, { recursive: true })
    }
    await writeFile(LOGS_FILE_PATH, JSON.stringify(activityLogs, null, 2), 'utf-8')
    console.log('Saved activity logs to file:', activityLogs.length)
  } catch (error) {
    console.error('Error saving logs to file:', error)
  }
}

// Load logs on startup
loadLogsFromFile()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const username = searchParams.get('username')
    const action = searchParams.get('action')
    const limit = parseInt(searchParams.get('limit') || '100')

    // Filter logs based on query parameters
    let filteredLogs = [...activityLogs]
    
    if (username && username !== 'all') {
      filteredLogs = filteredLogs.filter(log => log.username === username)
    }
    
    if (action && action !== 'all') {
      filteredLogs = filteredLogs.filter(log => log.action === action)
    }
    
    // Return most recent logs first, limited by the limit parameter
    filteredLogs = filteredLogs
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit)

    return NextResponse.json({ logs: filteredLogs })
  } catch (error: any) {
    console.error('Error fetching activity logs:', error)
    return NextResponse.json({ error: error.message || 'Failed to fetch activity logs' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username, action, details } = body

    if (!username || !action) {
      return NextResponse.json({ error: 'Username and action are required' }, { status: 400 })
    }

    const newLog = {
      id: Date.now().toString(),
      username,
      timestamp: new Date().toISOString(),
      action,
      details: details || ''
    }

    activityLogs.push(newLog)
    
    // Keep only last 1000 logs to prevent memory/file size issues
    if (activityLogs.length > 1000) {
      activityLogs = activityLogs.slice(-1000)
    }

    // Save to file for persistence
    await saveLogsToFile()

    return NextResponse.json({ success: true, log: newLog })
  } catch (error: any) {
    console.error('Error logging activity:', error)
    return NextResponse.json({ error: error.message || 'Failed to log activity' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const username = searchParams.get('username')

    if (username) {
      // Delete logs for a specific user
      activityLogs = activityLogs.filter(log => log.username !== username)
    } else {
      // Clear all logs
      activityLogs = []
    }

    // Save to file for persistence
    await saveLogsToFile()

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error clearing activity logs:', error)
    return NextResponse.json({ error: error.message || 'Failed to clear activity logs' }, { status: 500 })
  }
}
