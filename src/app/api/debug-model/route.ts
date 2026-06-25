import { NextResponse } from 'next/server'
import { isProductionDeployment } from '@/lib/auth/staffAccess'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (isProductionDeployment()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({
    success: true,
    model: 'gemini-2.5-flash',
    message: 'Debug endpoint (non-production only)',
    timestamp: new Date().toISOString(),
  })
}
