import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    // Verify authentication using JWT
    const user = await getAuthenticatedUser(request)
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get tenant ID from query parameters
    const url = new URL(request.url)
    const tenantId = url.searchParams.get('tenantId')

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 })
    }

    // Verify tenant belongs to user (use user.id instead of user.$id)
    const tenant = await prisma.tenant.findFirst({
      where: {
        id: tenantId,
        userId: user.id
      }
    })

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found or access denied' }, { status: 404 })
    }

    // Get current date for monthly calculations
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfThisMonth = startOfMonth.toISOString()

    // Fetch total customers
    const totalCustomers = await prisma.customer.count({
      where: { tenantId }
    })

    // Fetch customers this month
    const customersThisMonth = await prisma.customer.count({
      where: {
        tenantId,
        createdAt: {
          gte: startOfThisMonth
        }
      }
    })

    // Fetch total orders
    const totalOrders = await prisma.order.count({
      where: { tenantId }
    })

    // Fetch orders this month
    const ordersThisMonth = await prisma.order.count({
      where: {
        tenantId,
        createdAt: {
          gte: startOfThisMonth
        }
      }
    })

    // Fetch total revenue
    const totalRevenueResult = await prisma.order.aggregate({
      where: { tenantId },
      _sum: {
        totalPrice: true
      }
    })
    const totalRevenue = Number(totalRevenueResult._sum.totalPrice || 0)

    // Fetch revenue this month
    const revenueThisMonthResult = await prisma.order.aggregate({
      where: {
        tenantId,
        createdAt: {
          gte: startOfThisMonth
        }
      },
      _sum: {
        totalPrice: true
      }
    })
    const revenueThisMonth = Number(revenueThisMonthResult._sum.totalPrice || 0)

    // Fetch orders by date (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const ordersByDate = await prisma.order.groupBy({
      by: ['createdAt'],
      where: {
        tenantId,
        createdAt: {
          gte: thirtyDaysAgo.toISOString()
        }
      },
      _count: {
        id: true
      },
      _sum: {
        totalPrice: true
      },
      orderBy: {
        createdAt: 'asc'
      }
    })

    // Format orders by date data
    const ordersByDateFormatted = ordersByDate.map(item => ({
      date: item.createdAt.toISOString().split('T')[0], // YYYY-MM-DD format
      orders: Number(item._count.id),
      revenue: Number(item._sum.totalPrice || 0)
    }))

    // Group by date and sum values for same dates
    const groupedOrdersByDate = ordersByDateFormatted.reduce((acc, item) => {
      const existingItem = acc.find(x => x.date === item.date)
      if (existingItem) {
        existingItem.orders += item.orders
        existingItem.revenue += item.revenue
      } else {
        acc.push(item)
      }
      return acc
    }, [] as Array<{ date: string; orders: number; revenue: number }>)

    // Fetch top customers by total spent
    const topCustomersRaw = await prisma.customer.findMany({
      where: { tenantId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        totalSpent: true,
        ordersCount: true
      },
      orderBy: {
        totalSpent: 'desc'
      },
      take: 5
    })

    // Format top customers data with explicit type conversion
    const topCustomers = topCustomersRaw.map(customer => ({
      id: customer.id,
      name: `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Unknown',
      email: customer.email || 'No email',
      totalSpent: Number(customer.totalSpent || 0), // Ensure it's a number
      ordersCount: Number(customer.ordersCount || 0) // Ensure it's a number
    }))

    // Prepare response data
    const metrics = {
      totalCustomers: Number(totalCustomers),
      totalOrders: Number(totalOrders),
      totalRevenue: totalRevenue,
      customersThisMonth: Number(customersThisMonth),
      ordersThisMonth: Number(ordersThisMonth),
      revenueThisMonth: revenueThisMonth,
      ordersByDate: groupedOrdersByDate,
      topCustomers
    }

    console.log('Metrics calculated for tenant:', tenantId, {
      ...metrics,
      topCustomers: metrics.topCustomers.map(c => ({
        ...c,
        totalSpentType: typeof c.totalSpent,
        ordersCountType: typeof c.ordersCount
      }))
    })

    return NextResponse.json(metrics)

  } catch (error) {
    console.error('Error fetching dashboard metrics:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}