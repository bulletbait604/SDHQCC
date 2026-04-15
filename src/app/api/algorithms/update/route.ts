import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/algorithms`, {
      method: 'POST',
    })
    
    if (!response.ok) {
      throw new Error('Failed to update algorithms')
    }
    
    return NextResponse.json({ success: true, message: 'Algorithm data updated successfully' })
  } catch (error) {
    console.error('Error updating algorithms:', error)
    return NextResponse.json({ error: 'Failed to update algorithms' }, { status: 500 })
  }
}
