import { NextResponse } from 'next/server'

export async function GET() {
  const environment = {
    NODE_ENV: process.env.NODE_ENV,
    VERCEL: process.env.VERCEL,
    VERCEL_ENV: process.env.VERCEL_ENV,
    DATABASE_URL: process.env.DATABASE_URL ? '✓ Set' : '✗ Missing',
    JWT_SECRET: process.env.JWT_SECRET ? '✓ Set' : '✗ Missing',
    timestamp: new Date().toISOString(),
    region: process.env.VERCEL_REGION || 'unknown',
    functionTimeout: process.env.VERCEL_FUNCTION_TIMEOUT || 'default'
  }

  console.log('[ENV DEBUG] Environment check:', environment)

  return NextResponse.json({
    success: true,
    environment,
    message: 'Environment debug endpoint'
  })
}