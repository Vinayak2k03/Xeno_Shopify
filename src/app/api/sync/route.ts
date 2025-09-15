import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import { syncTenantById } from '@/lib/scheduler'
import { webhookManager } from '@/lib/webhook-manager'
import { prisma } from '@/lib/db'

// POST /api/sync - Manual sync trigger
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { tenantId, types, force } = body

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

    // Trigger sync
    const results = await syncTenantById(tenantId, user.id, {
      types: types || ['orders', 'customers', 'products'],
      force: force || false
    })

    return NextResponse.json({
      success: true,
      tenantId,
      tenantName: tenant.name,
      results,
      totalRecords: results.reduce((sum, r) => sum + r.recordsProcessed, 0),
      totalDuration: results.reduce((sum, r) => sum + r.duration, 0),
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    })

  } catch (error) {
    console.error('Manual sync error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Internal server error'
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
    const syncStatus = {}
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

    // Get webhook status
    const webhookStatus = await webhookManager.getWebhookStatusForTenant(tenantId)

    return NextResponse.json({
      tenantId,
      tenantName: tenant.name,
      lastActivity: syncLogs[0]?.createdAt || tenant.createdAt,
      syncStatus,
      webhookStatus,
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