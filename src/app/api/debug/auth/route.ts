import { NextRequest, NextResponse } from 'next/server'
import { getAppwriteUser } from '@/lib/auth-middleware'

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
    
    // Try to get user
    const user = await getAppwriteUser(request)
    
    return NextResponse.json({ 
      success: !!user,
      user: user ? { 
        id: user.$id, 
        email: user.email, 
        name: user.name 
      } : null,
      cookieCount: cookies.length,
      appwriteProjectId: process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID,
      appwriteEndpoint: process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT
    })
  } catch (error) {
    console.error('Debug auth error:', error)
    return NextResponse.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 })
  }
}