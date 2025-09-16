import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import { syncTenantById } from '@/lib/scheduler'
import { prisma } from '@/lib/db'

// POST /api/sync - Manual sync trigger
export async function POST(request: NextRequest) {
  try {
    console.log('[SYNC API] Manual sync triggered')
    console.log('[SYNC API] Environment check:', {
      NODE_ENV: process.env.NODE_ENV,
      VERCEL: process.env.VERCEL,
      DATABASE_URL: process.env.DATABASE_URL ? '✓ Set' : '✗ Missing',
      JWT_SECRET: process.env.JWT_SECRET ? '✓ Set' : '✗ Missing'
    })
    
    const startTime = Date.now()
    
    const user = await getAuthenticatedUser(request)
    if (!user) {
      console.log('[SYNC API] Unauthorized request')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { tenantId, types, force, historical } = body
    console.log('[SYNC API] Request body:', { tenantId, types, force, historical })

    if (!tenantId) {
      console.log('[SYNC API] Missing tenant ID')
      return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 })
    }

    // Verify user owns the tenant
    const tenant = await prisma.tenant.findFirst({
      where: {
        id: tenantId,
        userId: user.id
      }
    })

    if (!tenant) {
      console.log('[SYNC API] Tenant not found for user')
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }

    console.log('[SYNC API] Found tenant:', { 
      name: tenant.name, 
      domain: tenant.shopifyDomain,
      accessToken: tenant.shopifyAccessToken ? '✓ Set' : '✗ Missing'
    })

    // Validate tenant credentials
    if (!tenant.shopifyDomain || !tenant.shopifyAccessToken) {
      console.error('[SYNC API] Missing tenant credentials')
      return NextResponse.json({ 
        error: 'Tenant is missing required Shopify credentials',
        details: {
          domain: tenant.shopifyDomain ? '✓' : '✗',
          accessToken: tenant.shopifyAccessToken ? '✓' : '✗'
        }
      }, { status: 400 })
    }

    // If historical sync is requested, force a full sync
    const syncOptions = {
      types: types || ['orders', 'customers', 'products'],
      force: force || historical || false
    }

    console.log('[SYNC API] Starting sync with options:', syncOptions)

    // Trigger sync
    const results = await syncTenantById(tenantId, user.id, syncOptions)

    const totalTime = Date.now() - startTime
    console.log(`[SYNC API] Sync completed in ${totalTime}ms:`, results)

    return NextResponse.json({
      success: true,
      tenantId,
      tenantName: tenant.name,
      results,
      totalRecords: results.reduce((sum, r) => sum + r.recordsProcessed, 0),
      totalDuration: results.reduce((sum, r) => sum + r.duration, 0),
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      syncType: historical ? 'historical' : force ? 'force' : 'incremental'
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    const errorStack = error instanceof Error ? error.stack : 'No stack trace'
    
    console.error('[SYNC API ERROR] Manual sync failed:', {
      message: errorMessage,
      stack: errorStack,
      error: error
    })
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? errorStack : undefined
    }, { status: 500 })
  }
}

// GET /api/sync?tenantId=xxx - Get sync status
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const tenantId = searchParams.get('tenantId')

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 })
    }

    // Verify user owns the tenant
    const tenant = await prisma.tenant.findFirst({
      where: {
        id: tenantId,
        userId: user.id
      }
    })

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }

    // Get recent sync logs
    const syncLogs = await prisma.syncLog.findMany({
      where: {
        tenantId
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 50
    })

    // Group by sync type and get latest status
    const syncStatus: Record<string, any> = {}
    const syncTypes = ['orders', 'customers', 'products', 'analytics']

    for (const type of syncTypes) {
      const logs = syncLogs.filter(log => log.syncType === type)
      const lastLog = logs[0]
      
      syncStatus[type] = {
        lastSync: lastLog?.createdAt || null,
        success: lastLog?.success || false,
        recordsProcessed: lastLog?.recordsProcessed || 0,
        duration: lastLog?.duration || 0,
        error: lastLog?.error || null,
        totalSyncs: logs.length,
        successRate: logs.length > 0 ? (logs.filter(l => l.success).length / logs.length * 100).toFixed(1) : '0'
      }
    }

    return NextResponse.json({
      tenantId,
      tenantName: tenant.name,
      lastActivity: syncLogs[0]?.createdAt || tenant.createdAt,
      syncStatus,
      recentLogs: syncLogs.slice(0, 10).map(log => ({
        id: log.id,
        type: log.syncType,
        success: log.success,
        recordsProcessed: log.recordsProcessed,
        duration: log.duration,
        createdAt: log.createdAt,
        error: log.error
      }))
    })

  } catch (error) {
    console.error('Get sync status error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 })
  }
}