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

    // Get tenant ID and date range from query parameters
    const url = new URL(request.url)
    const tenantId = url.searchParams.get('tenantId')
    const startDate = url.searchParams.get('startDate')
    const endDate = url.searchParams.get('endDate')

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 })
    }

    // Set up date range for filtering
    let dateFilter: any = {}
    if (startDate && endDate) {
      dateFilter = {
        createdAt: {
          gte: new Date(startDate),
          lte: new Date(endDate + 'T23:59:59.999Z') // Include the entire end date
        }
      }
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

    console.log(`Fetching metrics for tenant: ${tenantId}, dateRange: ${startDate} to ${endDate}`)

    // Get current date for monthly calculations
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfThisMonth = startOfMonth.toISOString()

    // Set default date range if not provided (last 30 days)
    const defaultStartDate = new Date()
    defaultStartDate.setDate(defaultStartDate.getDate() - 30)
    
    const rangeStart = startDate ? new Date(startDate) : defaultStartDate
    const rangeEnd = endDate ? new Date(endDate + 'T23:59:59.999Z') : new Date()

    // Fetch total customers
    const totalCustomers = await prisma.customer.count({
      where: { 
        tenantId,
        ...dateFilter
      }
    })

    // Fetch customers this month (for growth calculation)
    const customersThisMonth = await prisma.customer.count({
      where: {
        tenantId,
        createdAt: {
          gte: startOfThisMonth
        }
      }
    })

    // Fetch total orders in range
    const totalOrders = await prisma.order.count({
      where: { 
        tenantId,
        ...dateFilter
      }
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

    // Fetch total revenue in range
    const totalRevenueResult = await prisma.order.aggregate({
      where: { 
        tenantId,
        ...dateFilter
      },
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

    // Fetch orders by date within the specified range
    const ordersByDate = await prisma.order.groupBy({
      by: ['createdAt'],
      where: {
        tenantId,
        createdAt: {
          gte: rangeStart,
          lte: rangeEnd
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
      date: item.createdAt.toISOString().split('T')[0],
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

    // Generate revenue trends data (optimized)
    const revenueTrends = await prisma.order.groupBy({
      by: ['createdAt'],
      where: {
        tenantId,
        createdAt: {
          gte: rangeStart,
          lte: rangeEnd
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

    // Get customer data for the entire range (single query)
    const customersInRange = await prisma.customer.groupBy({
      by: ['createdAt'],
      where: {
        tenantId,
        createdAt: {
          gte: rangeStart,
          lte: rangeEnd
        }
      },
      _count: {
        id: true
      },
      orderBy: {
        createdAt: 'asc'
      }
    })

    // Create a map of customers by date
    const customersByDate = customersInRange.reduce((acc, item) => {
      const date = item.createdAt.toISOString().split('T')[0]
      acc[date] = (acc[date] || 0) + item._count.id
      return acc
    }, {} as Record<string, number>)

    // Format revenue trends with customer data (no async operations)
    const revenueTrendsFormatted = revenueTrends.map((item) => {
      const date = item.createdAt.toISOString().split('T')[0]
      const orders = Number(item._count.id)
      const revenue = Number(item._sum.totalPrice || 0)
      const customers = customersByDate[date] || 0

      return {
        date,
        revenue,
        orders,
        customers,
        averageOrderValue: orders > 0 ? revenue / orders : 0
      }
    })

    // Group revenue trends by date
    const groupedRevenueTrends = revenueTrendsFormatted.reduce((acc, item) => {
      const existingItem = acc.find(x => x.date === item.date)
      if (existingItem) {
        existingItem.orders += item.orders
        existingItem.revenue += item.revenue
        existingItem.customers += item.customers
        existingItem.averageOrderValue = existingItem.orders > 0 ? existingItem.revenue / existingItem.orders : 0
      } else {
        acc.push(item)
      }
      return acc
    }, [] as Array<{ date: string; revenue: number; orders: number; customers: number; averageOrderValue: number }>)

    // First get order IDs that match our criteria
    const ordersInRange = await prisma.order.findMany({
      where: {
        tenantId,
        createdAt: {
          gte: rangeStart,
          lte: rangeEnd
        }
      },
      select: {
        id: true
      }
    })

    const orderIds = ordersInRange.map(order => order.id)

    // Fetch top products by revenue (optimized query)
    const topProductsRaw = await prisma.orderItem.groupBy({
      by: ['productId'],
      where: {
        productId: {
          not: null
        },
        orderId: {
          in: orderIds
        }
      },
      _sum: {
        price: true,
        quantity: true
      },
      _count: {
        productId: true
      },
      orderBy: {
        _sum: {
          price: 'desc'
        }
      },
      take: 10
    })

    // Get product details for top products (optimized with single query)
    const productIds = topProductsRaw
      .map(item => item.productId)
      .filter(id => id !== null) as string[]
    
    const products = await prisma.product.findMany({
      where: {
        id: {
          in: productIds
        }
      },
      select: {
        id: true,
        title: true
      }
    })

    const productMap = products.reduce((acc, product) => {
      acc[product.id] = product
      return acc
    }, {} as Record<string, { id: string; title: string }>)

    // Format top products data
    const topProducts = topProductsRaw.map((item) => {
      const product = productMap[item.productId || '']
      const revenue = Number(item._sum.price || 0)
      const unitsSold = Number(item._sum.quantity || 0)

      return {
        id: item.productId || '',
        title: product?.title || 'Unknown Product',
        revenue,
        unitsSold,
        averagePrice: unitsSold > 0 ? revenue / unitsSold : 0
      }
    })

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

     

    // Fetch custom events in the date range
    const customEvents = await prisma.customEvent.findMany({
      where: {
        tenantId,
        createdAt: {
          gte: rangeStart,
          lte: rangeEnd
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 100 // Limit to last 100 events
    })

    // Prepare response data
    const metrics = {
      totalCustomers: Number(totalCustomers),
      totalOrders: Number(totalOrders),
      totalRevenue: totalRevenue,
      customersThisMonth: Number(customersThisMonth),
      ordersThisMonth: Number(ordersThisMonth),
      revenueThisMonth: revenueThisMonth,
      ordersByDate: groupedOrdersByDate,
      topCustomers,
      topProducts,
      revenueTrends: groupedRevenueTrends,
      customEvents
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
  }
}