import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import { PrismaClient } from '@prisma/client'

// Optimized Prisma client with connection pooling
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  log: ['warn', 'error'], // Reduce logging overhead
})

// Add a simple in-memory cache for frequently accessed data
const cache = new Map<string, { data: any; timestamp: number }>()
const authCache = new Map<string, { user: any; timestamp: number }>()
const CACHE_TTL = 15 * 60 * 1000 // 15 minutes (increased for better performance)
const AUTH_CACHE_TTL = 10 * 60 * 1000 // 10 minutes for auth cache

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

    // For data fetching, we need to get ALL historical data if no dates specified
    // This ensures we have complete data for trends and totals
    const shouldFetchAllData = !startDate || !endDate

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

    // Check cache first with more granular keys
    const cacheKey = getCacheKey(tenantId, startDate || '', endDate || '')
    const cached = cache.get(cacheKey)
    if (cached && isCacheValid(cached.timestamp)) {
      console.log(`Returning cached metrics for: ${tenantId} (cached ${Math.round((Date.now() - cached.timestamp) / 1000)}s ago)`)
      return NextResponse.json(cached.data)
    }

    console.log(`Fetching metrics for tenant: ${tenantId}, dateRange: ${startDate} to ${endDate}`)
    
    // Quick count check to avoid expensive queries for empty datasets
    const quickOrderCount = await prisma.order.count({
      where: { 
        tenantId,
        // Only apply date filter for count if specific dates provided
        ...(shouldFetchAllData ? {} : dateFilter)
      }
    })

    if (quickOrderCount === 0) {
      console.log('No orders found, returning empty metrics')
      const emptyMetrics = {
        totalCustomers: 0,
        totalOrders: 0,
        totalRevenue: 0,
        customersThisMonth: 0,
        ordersThisMonth: 0,
        revenueThisMonth: 0,
        ordersByDate: [],
        topCustomers: [],
        topProducts: [],
        revenueTrends: []
      }
      // Cache empty results too
      cache.set(cacheKey, { data: emptyMetrics, timestamp: Date.now() })
      return NextResponse.json(emptyMetrics)
    }

    console.log(`Fetching metrics for tenant: ${tenantId}, dateRange: ${startDate} to ${endDate}`)
    
    // Get current date for monthly calculations
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfThisMonth = startOfMonth.toISOString()

    // Set default date range if not provided (last 30 days for display, but fetch ALL data)
    const defaultStartDate = new Date()
    defaultStartDate.setDate(defaultStartDate.getDate() - 30)
    
    const rangeStart = startDate ? new Date(startDate) : defaultStartDate
    const rangeEnd = endDate ? new Date(endDate + 'T23:59:59.999Z') : new Date()

    const queryStartTime = Date.now()
    console.log('Starting optimized single-query approach...')

    // ULTRA-AGGRESSIVE OPTIMIZATION: Single query with everything we need
    // For historical data completeness, fetch ALL data if no specific date range provided
    const ordersWithCustomersAndItems = await prisma.order.findMany({
      where: { 
        tenantId,
        // Only apply date filter if specific dates are provided for filtering
        ...(shouldFetchAllData ? {} : dateFilter)
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
        },
        orderItems: {
          select: {
            productId: true,
            price: true,
            quantity: true,
            product: {
              select: {
                id: true,
                title: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    const queryEndTime = Date.now()
    console.log(`Single comprehensive query completed in ${queryEndTime - queryStartTime}ms`)

    // Extract and process data from the single comprehensive query with optimized algorithms
    const ordersData = ordersWithCustomersAndItems
    const uniqueCustomers = new Map()
    const productRevenueMap = new Map<string, {revenue: number, units: number, title: string}>()
    const dailyStats = new Map<string, {revenue: number, orders: number}>()
    const customerSpending = new Map<string, number>()
    
    // Process all data in a single loop for maximum efficiency
    const processingStartTime = Date.now()
    
    // Separate totals (all data) from range-specific data
    let totalRevenue = 0
    let totalOrders = 0
    let rangeRevenue = 0
    let rangeOrders = 0
    let revenueThisMonth = 0
    let ordersThisMonth = 0
    
    ordersWithCustomersAndItems.forEach((order: any) => {
      const orderRevenue = Number(order.totalPrice || 0)
      const orderDate = new Date(order.createdAt)
      const isThisMonth = orderDate >= new Date(startOfThisMonth)
      const isInRange = orderDate >= rangeStart && orderDate <= rangeEnd
      const dayKey = orderDate.toISOString().split('T')[0]
      
      // Aggregate totals (all historical data)
      totalRevenue += orderRevenue
      totalOrders++
      
      // Range-specific aggregates (for trends and charts)
      if (isInRange) {
        rangeRevenue += orderRevenue
        rangeOrders++
      }
      
      if (isThisMonth) {
        revenueThisMonth += orderRevenue
        ordersThisMonth++
      }
      
      // Daily stats (only for data within range for charts)
      if (isInRange) {
        const dayStats = dailyStats.get(dayKey) || {revenue: 0, orders: 0}
        dayStats.revenue += orderRevenue
        dayStats.orders++
        dailyStats.set(dayKey, dayStats)
      }
      
      // Collect unique customers and their spending
      if (order.customer && order.customerId) {
        uniqueCustomers.set(order.customerId, order.customer)
        const currentSpending = customerSpending.get(order.customerId) || 0
        customerSpending.set(order.customerId, currentSpending + orderRevenue)
      }
      
      // Process order items for product metrics
      order.orderItems?.forEach((item: any) => {
        if (item.productId && item.product) {
          const itemRevenue = Number(item.price || 0)
          const itemQuantity = Number(item.quantity || 0)
          const existing = productRevenueMap.get(item.productId) || {revenue: 0, units: 0, title: item.product.title || 'Unknown'}
          productRevenueMap.set(item.productId, {
            revenue: existing.revenue + itemRevenue,
            units: existing.units + Number(item.quantity || 0),
            title: existing.title
          })
        }
      })
    })
    
    const processingEndTime = Date.now()
    console.log(`Data processing completed in ${processingEndTime - processingStartTime}ms`)
    
    const customersData = Array.from(uniqueCustomers.values())

    // Calculate remaining metrics from processed data
    const totalCustomers = customersData.length
    const customersThisMonth = customersData.filter((c: any) => 
      new Date(c.createdAt) >= new Date(startOfThisMonth)
    ).length

    // Convert daily stats to ordersByDate format (filtered to range)
    const ordersByDate = Array.from(dailyStats.entries())
      .map(([date, data]) => ({
        date,
        orders: data.orders,
        revenue: data.revenue
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

    // Process revenue trends using our pre-calculated daily stats (already filtered to range)
    const revenueTrends = Array.from(dailyStats.entries())
      .map(([date, data]) => {
        // Count customers who joined on this date
        const customersOnDate = customersData.filter((customer: any) => {
          const customerDate = new Date(customer.createdAt)
          return customerDate.toISOString().split('T')[0] === date
        }).length
        
        return {
          date,
          revenue: data.revenue,
          orders: data.orders,
          customers: customersOnDate,
          averageOrderValue: data.orders > 0 ? data.revenue / data.orders : 0
        }
      })
      .sort((a, b) => a.date.localeCompare(b.date))

    // Get top customers using pre-calculated spending
    const topCustomers = Array.from(customerSpending.entries())
      .map(([customerId, totalSpent]) => {
        const customer = uniqueCustomers.get(customerId)
        if (!customer) return null
        
        // Count orders for this customer
        const ordersCount = ordersData.filter((o: any) => o.customerId === customerId).length
        
        return {
          id: customer.id,
          name: `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Unknown',
          email: customer.email || 'No email',
          totalSpent: Number(totalSpent),
          ordersCount: Number(ordersCount)
        }
      })
      .filter((customer): customer is NonNullable<typeof customer> => customer !== null)
      .sort((a, b) => b.totalSpent - a.totalSpent) // Sort by spending descending
      .slice(0, 5)

    // Process top products from the single query data
    const topProducts = Array.from(productRevenueMap.entries())
      .map(([productId, data]) => ({
        id: productId,
        title: data.title,
        revenue: data.revenue,
        unitsSold: data.units,
        averagePrice: data.units > 0 ? data.revenue / data.units : 0
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)

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
      revenueTrends: revenueTrends
    }

    console.log('Metrics calculated for tenant:', tenantId, 'with optimized single query approach')

    // Cache the result with enhanced TTL
    cache.set(cacheKey, { data: metrics, timestamp: Date.now() })

    const totalTime = Date.now() - queryStartTime
    console.log(`Total metrics calculation completed in ${totalTime}ms`)

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