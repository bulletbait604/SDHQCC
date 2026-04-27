import { NextRequest, NextResponse } from 'next/server'
import { kv } from '@vercel/kv'

// Activity log storage using Vercel KV (Redis) for persistence
const LOGS_KEY = 'activity-logs'
const MAX_LOGS = 1000

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const username = searchParams.get('username')
    const action = searchParams.get('action')
    const limit = parseInt(searchParams.get('limit') || '100')

    // Fetch logs from Vercel KV
    const logs = await kv.get(LOGS_KEY)
    let activityLogs = Array.isArray(logs) ? logs : []
    
    // Filter logs based on query parameters
    let filteredLogs = [...activityLogs]
    
    if (username && username !== 'all') {
      filteredLogs = filteredLogs.filter((log: any) => log.username === username)
    }
    
    if (action && action !== 'all') {
      filteredLogs = filteredLogs.filter((log: any) => log.action === action)
    }
    
    // Return most recent logs first, limited by the limit parameter
    filteredLogs = filteredLogs
      .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
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

    console.log('Activity log received:', { username, action, details })

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

    // Fetch existing logs
    const logs = await kv.get(LOGS_KEY)
    let activityLogs = Array.isArray(logs) ? logs : []
    
    // Add new log
    activityLogs.push(newLog)
    console.log('Current activity logs count:', activityLogs.length)
    
    // Keep only last MAX_LOGS to prevent storage bloat
    if (activityLogs.length > MAX_LOGS) {
      activityLogs = activityLogs.slice(-MAX_LOGS)
    }

    // Save to Vercel KV
    await kv.set(LOGS_KEY, activityLogs)
    console.log('Successfully saved to Vercel KV')

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

    // Fetch existing logs
    const logs = await kv.get(LOGS_KEY)
    let activityLogs = Array.isArray(logs) ? logs : []

    if (username) {
      // Delete logs for a specific user
      activityLogs = activityLogs.filter((log: any) => log.username !== username)
    } else {
      // Clear all logs
      activityLogs = []
    }

    // Save to Vercel KV
    await kv.set(LOGS_KEY, activityLogs)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error clearing activity logs:', error)
    return NextResponse.json({ error: error.message || 'Failed to clear activity logs' }, { status: 500 })
  }
}
