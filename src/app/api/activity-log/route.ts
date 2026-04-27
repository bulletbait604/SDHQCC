import { NextRequest, NextResponse } from 'next/server'

// In-memory storage for activity logs (in production, this should be a database)
let activityLogs: any[] = []

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
    
    // Keep only last 1000 logs to prevent memory issues
    if (activityLogs.length > 1000) {
      activityLogs = activityLogs.slice(-1000)
    }

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

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error clearing activity logs:', error)
    return NextResponse.json({ error: error.message || 'Failed to clear activity logs' }, { status: 500 })
  }
}
