import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthenticatedUser } from '@/lib/auth-middleware'

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const tenantId = searchParams.get('tenantId')
    const limit = parseInt(searchParams.get('limit') || '20')
    const eventType = searchParams.get('eventType')
    const days = parseInt(searchParams.get('days') || '7')

    // Date range for filtering
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Build where clause
    const whereClause: any = {
      createdAt: {
        gte: startDate
      }
    }

    if (tenantId) {
      whereClause.tenantId = tenantId
    }

    if (eventType) {
      whereClause.eventType = eventType
    }

    // Fetch custom events with customer data
    const events = await prisma.customEvent.findMany({
      where: whereClause,
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit
    })

    // Get event counts by type for summary
    const eventCounts = await prisma.customEvent.groupBy({
      by: ['eventType'],
      where: whereClause,
      _count: {
        id: true
      }
    })

    // Calculate abandonment rate for carts
    const cartCreated = await prisma.customEvent.count({
      where: {
        ...whereClause,
        eventType: 'cart_created'
      }
    })

    const cartAbandoned = await prisma.customEvent.count({
      where: {
        ...whereClause,
        eventType: 'cart_abandoned'
      }
    })

    const abandonmentRate = cartCreated > 0 ? ((cartAbandoned / cartCreated) * 100).toFixed(1) : '0'

    // Calculate total abandoned cart value
    const abandonedCartEvents = await prisma.customEvent.findMany({
      where: {
        ...whereClause,
        eventType: 'cart_abandoned'
      },
      select: {
        eventData: true
      }
    })

    const totalAbandonedValue = abandonedCartEvents.reduce((sum, event) => {
      const eventData = event.eventData as any
      return sum + (eventData?.totalPrice || 0)
    }, 0)

    // Group events by day for trend analysis
    const eventsByDay = await prisma.$queryRaw`
      SELECT 
        DATE(created_at) as date,
        event_type,
        COUNT(*) as count
      FROM custom_events 
      WHERE created_at >= ${startDate}
      ${tenantId ? prisma.$queryRaw`AND tenant_id = ${tenantId}` : prisma.$queryRaw``}
      GROUP BY DATE(created_at), event_type
      ORDER BY DATE(created_at) DESC
    `

    return NextResponse.json({
      success: true,
      events,
      summary: {
        totalEvents: events.length,
        eventCounts: eventCounts.reduce((acc, item) => {
          acc[item.eventType] = item._count.id
          return acc
        }, {} as Record<string, number>),
        cartAbandonmentRate: `${abandonmentRate}%`,
        totalAbandonedValue: totalAbandonedValue,
        checkoutStarted: eventCounts.find(e => e.eventType === 'checkout_started')?._count.id || 0,
        eventsByDay
      }
    })

  } catch (error) {
    console.error('Error fetching custom events:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to fetch custom events' 
    }, { status: 500 })
  }
}