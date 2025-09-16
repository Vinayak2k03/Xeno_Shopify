import { NextResponse } from 'next/server'

export async function GET() {
  try {
    console.log('[BASIC TEST] Testing basic connectivity from Vercel')
    
    // Test 1: Basic fetch to external API
    const testUrl = 'https://httpbin.org/get'
    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'ShopifyService/1.0'
      }
    })
    
    const testResult = response.ok ? 'Success' : 'Failed'
    
    // Test 2: DNS resolution test
    const dnsTest = await fetch('https://www.google.com', {
      method: 'HEAD'
    }).then(() => 'Success').catch(() => 'Failed')
    
    console.log('[BASIC TEST] Results:', { httpbin: testResult, dns: dnsTest })
    
    return NextResponse.json({
      success: true,
      tests: {
        httpBin: testResult,
        dnsResolution: dnsTest,
        timestamp: new Date().toISOString(),
        region: process.env.VERCEL_REGION || 'unknown'
      }
    })
    
  } catch (error) {
    console.error('[BASIC TEST ERROR]:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}