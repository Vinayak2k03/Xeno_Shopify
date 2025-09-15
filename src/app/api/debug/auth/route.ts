import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    console.log('=== Debug Auth Endpoint ===')
    
    // Log all cookies
    const cookies = request.cookies.getAll()
    console.log('All cookies received:', cookies.map(c => ({ 
      name: c.name, 
      value: c.value.substring(0, 20) + '...',
      length: c.value.length 
    })))
    
    // Log headers
    const authHeaders = ['authorization', 'cookie', 'x-appwrite-session']
    authHeaders.forEach(header => {
      const value = request.headers.get(header)
      if (value) {
        console.log(`Header ${header}:`, value.substring(0, 50) + '...')
      }
    })
    
    // Get JWT token from cookie
    const token = request.cookies.get('authToken')?.value
    
    return NextResponse.json({ 
      success: !!token,
      hasToken: !!token,
      cookieCount: cookies.length,
      headers: Object.fromEntries(request.headers.entries())
    })
  } catch (error) {
    console.error('Debug auth error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : undefined
    
    return NextResponse.json({ 
      error: errorMessage,
      stack: errorStack 
    }, { status: 500 })
  }
}