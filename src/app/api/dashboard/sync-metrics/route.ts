import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import { prisma } from '@/lib/db'
import { webhookManager } from '@/lib/webhook-manager'

// GET /api/dashboard/sync-metrics - Get comprehensive sync metrics
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const tenantId = searchParams.get('tenantId')
    const days = parseInt(searchParams.get('days') || '7')

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

    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    // Get sync metrics
    const syncMetrics = await getSyncMetrics(tenantId, startDate)
    
    // Get webhook metrics
    const webhookMetrics = await getWebhookMetrics(tenantId, startDate)
    
    // Get data health metrics
    const dataHealth = await getDataHealthMetrics(tenantId)
    
    // Get performance metrics
    const performance = await getPerformanceMetrics(tenantId, startDate)

    return NextResponse.json({
      tenantId,
      tenantName: tenant.name,
      period: {
        days,
        startDate,
        endDate: new Date()
      },
      syncMetrics,
      webhookMetrics,
      dataHealth,
      performance
    })

  } catch (error) {
    console.error('Get sync metrics error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 })
  }
}

async function getSyncMetrics(tenantId: string, startDate: Date) {
  // Get sync logs for the period
  const syncLogs = await prisma.syncLog.findMany({
    where: {
      tenantId,
      createdAt: {
        gte: startDate
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  })

  // Group by sync type
  const byType = {}
  const syncTypes = ['orders', 'customers', 'products', 'analytics']

  for (const type of syncTypes) {
    const logs = syncLogs.filter(log => log.syncType === type)
    
    byType[type] = {
      totalSyncs: logs.length,
      successful: logs.filter(l => l.success).length,
      failed: logs.filter(l => !l.success).length,
      successRate: logs.length > 0 ? (logs.filter(l => l.success).length / logs.length * 100).toFixed(1) : '0',
      totalRecords: logs.reduce((sum, l) => sum + l.recordsProcessed, 0),
      avgDuration: logs.length > 0 ? (logs.reduce((sum, l) => sum + l.duration, 0) / logs.length).toFixed(0) : '0',
      lastSync: logs[0]?.createdAt || null,
      lastSuccess: logs.find(l => l.success)?.createdAt || null
    }
  }

  // Overall stats
  const overall = {
    totalSyncs: syncLogs.length,
    successful: syncLogs.filter(l => l.success).length,
    failed: syncLogs.filter(l => !l.success).length,
    successRate: syncLogs.length > 0 ? (syncLogs.filter(l => l.success).length / syncLogs.length * 100).toFixed(1) : '0',
    totalRecords: syncLogs.reduce((sum, l) => sum + l.recordsProcessed, 0),
    avgDuration: syncLogs.length > 0 ? (syncLogs.reduce((sum, l) => sum + l.duration, 0) / syncLogs.length).toFixed(0) : '0'
  }

  // Daily breakdown
  const dailyStats = []
  for (let i = 0; i < 7; i++) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)
    
    const dayLogs = syncLogs.filter(l => l.createdAt >= dayStart && l.createdAt < dayEnd)
    
    dailyStats.unshift({
      date: dayStart.toISOString().split('T')[0],
      syncs: dayLogs.length,
      successful: dayLogs.filter(l => l.success).length,
      failed: dayLogs.filter(l => !l.success).length,
      records: dayLogs.reduce((sum, l) => sum + l.recordsProcessed, 0)
    })
  }

  return {
    overall,
    byType,
    dailyStats
  }
}

async function getWebhookMetrics(tenantId: string, startDate: Date) {
  // Get webhook-related sync logs
  const webhookLogs = await prisma.syncLog.findMany({
    where: {
      tenantId,
      syncType: {
        startsWith: 'webhook_'
      },
      createdAt: {
        gte: startDate
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  })

  // Get webhook status
  let webhookStatus
  try {
    webhookStatus = await webhookManager.getWebhookStatusForTenant(tenantId)
  } catch (error) {
    webhookStatus = { error: 'Unable to fetch webhook status' }
  }

  // Group by webhook topic
  const byTopic = {}
  webhookLogs.forEach(log => {
    const topic = log.syncType.replace('webhook_', '').replace('_', '/')
    if (!byTopic[topic]) {
      byTopic[topic] = {
        total: 0,
        successful: 0,
        failed: 0,
        avgDuration: 0
      }
    }
    
    byTopic[topic].total++
    if (log.success) {
      byTopic[topic].successful++
    } else {
      byTopic[topic].failed++
    }
  })

  // Calculate averages
  Object.keys(byTopic).forEach(topic => {
    const logs = webhookLogs.filter(l => l.syncType === `webhook_${topic.replace('/', '_')}`)
    byTopic[topic].avgDuration = logs.length > 0 ? (logs.reduce((sum, l) => sum + l.duration, 0) / logs.length).toFixed(0) : '0'
    byTopic[topic].successRate = byTopic[topic].total > 0 ? (byTopic[topic].successful / byTopic[topic].total * 100).toFixed(1) : '0'
  })

  return {
    status: webhookStatus,
    totalWebhookEvents: webhookLogs.length,
    successfulEvents: webhookLogs.filter(l => l.success).length,
    failedEvents: webhookLogs.filter(l => !l.success).length,
    byTopic,
    recentEvents: webhookLogs.slice(0, 10).map(log => ({
      topic: log.syncType.replace('webhook_', '').replace('_', '/'),
      success: log.success,
      duration: log.duration,
      createdAt: log.createdAt,
      error: log.error
    }))
  }
}

async function getDataHealthMetrics(tenantId: string) {
  // Get record counts
  const [customerCount, orderCount, productCount, customEventCount] = await Promise.all([
    prisma.customer.count({ where: { tenantId } }),
    prisma.order.count({ where: { tenantId } }),
    prisma.product.count({ where: { tenantId } }),
    prisma.customEvent.count({ where: { tenantId } })
  ])

  // Get recent activity
  const [recentCustomers, recentOrders, recentProducts] = await Promise.all([
    prisma.customer.count({
      where: {
        tenantId,
        updatedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      }
    }),
    prisma.order.count({
      where: {
        tenantId,
        updatedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      }
    }),
    prisma.product.count({
      where: {
        tenantId,
        updatedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      }
    })
  ])

  // Get custom events breakdown
  const customEventTypes = await prisma.customEvent.groupBy({
    by: ['eventType'],
    where: { tenantId },
    _count: {
      eventType: true
    }
  })

  return {
    recordCounts: {
      customers: customerCount,
      orders: orderCount,
      products: productCount,
      customEvents: customEventCount
    },
    recentActivity: {
      customers: recentCustomers,
      orders: recentOrders,
      products: recentProducts
    },
    customEventTypes: customEventTypes.map(e => ({
      type: e.eventType,
      count: e._count.eventType
    }))
  }
}

async function getPerformanceMetrics(tenantId: string, startDate: Date) {
  // Get performance data from sync logs
  const syncLogs = await prisma.syncLog.findMany({
    where: {
      tenantId,
      success: true,
      createdAt: {
        gte: startDate
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  })

  if (syncLogs.length === 0) {
    return {
      avgSyncTime: 0,
      avgRecordsPerSync: 0,
      totalDataProcessed: 0,
      efficiency: 0
    }
  }

  const avgSyncTime = syncLogs.reduce((sum, l) => sum + l.duration, 0) / syncLogs.length
  const totalRecords = syncLogs.reduce((sum, l) => sum + l.recordsProcessed, 0)
  const avgRecordsPerSync = totalRecords / syncLogs.length
  const efficiency = totalRecords / (syncLogs.reduce((sum, l) => sum + l.duration, 0) / 1000) // records per second

  // Get sync frequency analysis
  const syncFrequency = {}
  syncLogs.forEach(log => {
    if (!syncFrequency[log.syncType]) {
      syncFrequency[log.syncType] = []
    }
    syncFrequency[log.syncType].push(log.createdAt)
  })

  // Calculate average time between syncs for each type
  const avgFrequency = {}
  Object.keys(syncFrequency).forEach(type => {
    const times = syncFrequency[type].sort((a, b) => a.getTime() - b.getTime())
    if (times.length > 1) {
      const intervals = []
      for (let i = 1; i < times.length; i++) {
        intervals.push(times[i].getTime() - times[i-1].getTime())
      }
      avgFrequency[type] = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length / (1000 * 60) // minutes
    } else {
      avgFrequency[type] = 0
    }
  })

  return {
    avgSyncTime: Math.round(avgSyncTime),
    avgRecordsPerSync: Math.round(avgRecordsPerSync),
    totalDataProcessed: totalRecords,
    efficiency: Math.round(efficiency * 100) / 100,
    avgFrequency
  }
}