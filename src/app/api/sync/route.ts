import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { ShopifyService } from '@/services/shopify'
import { getAuthenticatedUser } from '@/lib/auth-middleware'

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { tenantId } = await request.json()

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 })
    }

    // Get tenant and verify ownership
    const tenant = await prisma.tenant.findFirst({
      where: {
        id: tenantId,
        userId: user.id,
        isActive: true
      }
    })

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }

    if (!tenant.shopifyAccessToken) {
      return NextResponse.json({ error: 'Shopify access token not configured' }, { status: 400 })
    }

    // Initialize Shopify service
    const shopifyService = new ShopifyService({
      domain: tenant.shopifyDomain,
      accessToken: tenant.shopifyAccessToken,
      apiKey: tenant.apiKey,
      apiSecret: tenant.apiSecret,
      webhookSecret: tenant.webhookSecret
    }, tenant.id)

    // Sync data
    const results = {
      customers: 0,
      orders: 0,
      products: 0
    }

    try {
      results.customers = await shopifyService.syncCustomers()
    } catch (error) {
      console.error('Error syncing customers:', error)
    }

    try {
      results.products = await shopifyService.syncProducts()
    } catch (error) {
      console.error('Error syncing products:', error)
    }

    try {
      results.orders = await shopifyService.syncOrders()
    } catch (error) {
      console.error('Error syncing orders:', error)
    }

    return NextResponse.json({
      message: 'Sync completed',
      results
    })

  } catch (error) {
    console.error('Error during sync:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}