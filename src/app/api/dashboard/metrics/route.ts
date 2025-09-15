import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Add a simple in-memory cache for frequently accessed data
const cache = new Map<string, { data: any; timestamp: number }>()
const authCache = new Map<string, { user: any; timestamp: number }>()
const CACHE_TTL = 10 * 60 * 1000 // 10 minutes (increased from 5)
const AUTH_CACHE_TTL = 5 * 60 * 1000 // 5 minutes for auth cache

function getCacheKey(tenantId: string, startDate?: string, endDate?: string): string {
  return `metrics:${tenantId}:${startDate || 'all'}:${endDate || 'all'}`
}

function isCacheValid(timestamp: number, ttl: number = CACHE_TTL): boolean {
  return Date.now() - timestamp < ttl
}

export async function GET(request: NextRequest) {
  try {
    // Optimize auth with caching
    const authHeader = request.headers.get('authorization')
    const authCookie = request.cookies.get('auth-token')?.value
    const authKey = authHeader || authCookie || 'no-auth'
    
    let user
    const cachedAuth = authCache.get(authKey)
    if (cachedAuth && isCacheValid(cachedAuth.timestamp, AUTH_CACHE_TTL)) {
      user = cachedAuth.user
      console.log('Using cached authentication')
    } else {
      // Verify authentication using JWT
      user = await getAuthenticatedUser(request)
      if (user) {
        authCache.set(authKey, { user, timestamp: Date.now() })
      }
    }
    
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
          lte: new Date(endDate + 'T23:59:59.999Z')
        }
      }
    }

    // Verify tenant belongs to user
    const tenant = await prisma.tenant.findFirst({
      where: {
        id: tenantId,
        userId: user.id
      }
    })

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found or access denied' }, { status: 404 })
    }

    // Check cache first
    const cacheKey = getCacheKey(tenantId, startDate || '', endDate || '')
    const cached = cache.get(cacheKey)
    if (cached && isCacheValid(cached.timestamp)) {
      console.log('Returning cached metrics for:', tenantId)
      return NextResponse.json(cached.data)
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

    const queryStartTime = Date.now()
    console.log('Starting database queries...')

    // OPTIMIZED: Use fewer queries with better joins
    const [ordersWithCustomers, topProductsData] = await Promise.all([
      // Single query to get orders with customer data
      prisma.order.findMany({
        where: { 
          tenantId,
          ...dateFilter
        },
        select: {
          id: true,
          totalPrice: true,
          createdAt: true,
          customerId: true,
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              createdAt: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      }),

      // Get top products using Prisma groupBy (safer than raw SQL)
      prisma.orderItem.groupBy({
        by: ['productId'],
        where: {
          productId: { not: null },
          order: {
            tenantId,
            createdAt: {
              gte: rangeStart,
              lte: rangeEnd
            }
          }
        },
        _sum: {
          price: true,
          quantity: true
        },
        orderBy: {
          _sum: {
            price: 'desc'
          }
        },
        take: 10
      })
    ])

    // Get product details efficiently
    const productIds = topProductsData
      .map(item => item.productId)
      .filter(id => id !== null) as string[]
    
    const products = productIds.length > 0 ? await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, title: true }
    }) : []

    const queryEndTime = Date.now()
    console.log(`Database queries completed in ${queryEndTime - queryStartTime}ms`)

    // Extract orders and customers from the joined data
    const ordersData = ordersWithCustomers
    const uniqueCustomers = new Map()
    
    ordersWithCustomers.forEach(order => {
      if (order.customer && order.customerId) {
        uniqueCustomers.set(order.customerId, order.customer)
      }
    })
    
    const customersData = Array.from(uniqueCustomers.values())

    // Calculate metrics from fetched data
    const totalCustomers = customersData.length
    const customersThisMonth = customersData.filter((c: any) => 
      new Date(c.createdAt) >= new Date(startOfThisMonth)
    ).length

    const totalOrders = ordersData.length
    const ordersThisMonth = ordersData.filter((o: any) => 
      new Date(o.createdAt) >= new Date(startOfThisMonth)
    ).length

    const totalRevenue = ordersData.reduce((sum: number, order: any) => sum + Number(order.totalPrice || 0), 0)
    const revenueThisMonth = ordersData
      .filter((o: any) => new Date(o.createdAt) >= new Date(startOfThisMonth))
      .reduce((sum: number, order: any) => sum + Number(order.totalPrice || 0), 0)

    // Process orders by date
    const ordersByDateMap = new Map<string, {orders: number, revenue: number}>()
    
    ordersData.forEach((order: any) => {
      const orderDate = new Date(order.createdAt)
      if (orderDate >= rangeStart && orderDate <= rangeEnd) {
        const dateStr = orderDate.toISOString().split('T')[0]
        const existing = ordersByDateMap.get(dateStr) || {orders: 0, revenue: 0}
        ordersByDateMap.set(dateStr, {
          orders: existing.orders + 1,
          revenue: existing.revenue + Number(order.totalPrice || 0)
        })
      }
    })

    const ordersByDate = Array.from(ordersByDateMap.entries())
      .map(([date, data]) => ({
        date,
        orders: data.orders,
        revenue: data.revenue
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

    // Process revenue trends
    const revenueTrendsMap = new Map<string, {revenue: number, orders: number, customers: number}>()
    
    ordersData.forEach((order: any) => {
      const orderDate = new Date(order.createdAt)
      if (orderDate >= rangeStart && orderDate <= rangeEnd) {
        const dateStr = orderDate.toISOString().split('T')[0]
        const existing = revenueTrendsMap.get(dateStr) || {revenue: 0, orders: 0, customers: 0}
        revenueTrendsMap.set(dateStr, {
          revenue: existing.revenue + Number(order.totalPrice || 0),
          orders: existing.orders + 1,
          customers: existing.customers
        })
      }
    })

    // Add customer data to revenue trends
    customersData.forEach((customer: any) => {
      const customerDate = new Date(customer.createdAt)
      if (customerDate >= rangeStart && customerDate <= rangeEnd) {
        const dateStr = customerDate.toISOString().split('T')[0]
        const existing = revenueTrendsMap.get(dateStr) || {revenue: 0, orders: 0, customers: 0}
        revenueTrendsMap.set(dateStr, {
          ...existing,
          customers: existing.customers + 1
        })
      }
    })

    const revenueTrends = Array.from(revenueTrendsMap.entries())
      .map(([date, data]) => ({
        date,
        revenue: data.revenue,
        orders: data.orders,
        customers: data.customers,
        averageOrderValue: data.orders > 0 ? data.revenue / data.orders : 0
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

    // Calculate customer spending and order counts from actual orders data
    const customerSpendingMap = new Map<string, {totalSpent: number, ordersCount: number}>()
    
    ordersData.forEach((order: any) => {
      if (order.customerId) {
        const existing = customerSpendingMap.get(order.customerId) || {totalSpent: 0, ordersCount: 0}
        customerSpendingMap.set(order.customerId, {
          totalSpent: existing.totalSpent + Number(order.totalPrice || 0),
          ordersCount: existing.ordersCount + 1
        })
      }
    })

    // Get top customers with calculated spending
    const topCustomers = customersData
      .map((customer: any) => {
        const spending = customerSpendingMap.get(customer.id) || {totalSpent: 0, ordersCount: 0}
        return {
          id: customer.id,
          name: `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Unknown',
          email: customer.email || 'No email',
          totalSpent: Number(spending.totalSpent),
          ordersCount: Number(spending.ordersCount)
        }
      })
      .sort((a, b) => b.totalSpent - a.totalSpent) // Sort by spending descending
      .slice(0, 5)

    // Process top products from Prisma groupBy results
    const productMap = products.reduce((acc, product) => {
      acc[product.id] = product
      return acc
    }, {} as Record<string, { id: string; title: string }>)

    const topProducts = topProductsData.map((item: any) => {
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

    // Prepare response data
    const metrics = {
      totalCustomers: Number(totalCustomers),
      totalOrders: Number(totalOrders),
      totalRevenue: totalRevenue,
      customersThisMonth: Number(customersThisMonth),
      ordersThisMonth: Number(ordersThisMonth),
      revenueThisMonth: revenueThisMonth,
      ordersByDate: ordersByDate,
      topCustomers,
      topProducts,
      revenueTrends: revenueTrends,
      customEvents: [] // Removed for performance - can be added back if needed
    }

    console.log('Metrics calculated for tenant:', tenantId, {
      ...metrics,
      topCustomers: metrics.topCustomers.map(c => ({
        ...c,
        totalSpentType: typeof c.totalSpent,
        ordersCountType: typeof c.ordersCount
      }))
    })

    // Cache the result
    cache.set(cacheKey, { data: metrics, timestamp: Date.now() })

    return NextResponse.json(metrics)

  } catch (error) {
    console.error('Error fetching dashboard metrics:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  } finally {
    // Ensure Prisma connection is properly closed
    await prisma.$disconnect()
  }
}