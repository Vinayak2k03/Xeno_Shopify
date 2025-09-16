import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import { makeShopifyRequest } from '@/services/shopify'
import { prisma } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    console.log('[SHOPIFY TEST] Starting Shopify API connectivity test')
    
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { tenantId } = body

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 })
    }

    // Get tenant
    const tenant = await prisma.tenant.findFirst({
      where: {
        id: tenantId,
        userId: user.id
      }
    })

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }

    console.log('[SHOPIFY TEST] Testing connectivity for tenant:', {
      name: tenant.name,
      domain: tenant.shopifyDomain,
      hasAccessToken: !!tenant.accessToken
    })

    // Test 1: Basic shop info
    console.log('[SHOPIFY TEST] Test 1: Fetching shop info')
    const shopInfo = await makeShopifyRequest(
      tenant.shopifyDomain,
      tenant.accessToken,
      'shop.json'
    )

    // Test 2: Count orders
    console.log('[SHOPIFY TEST] Test 2: Counting orders')
    const orderCount = await makeShopifyRequest(
      tenant.shopifyDomain,
      tenant.accessToken,
      'orders/count.json'
    )

    // Test 3: Fetch first page of orders
    console.log('[SHOPIFY TEST] Test 3: Fetching first page of orders')
    const firstOrders = await makeShopifyRequest(
      tenant.shopifyDomain,
      tenant.accessToken,
      'orders.json?limit=5&status=any'
    )

    const results = {
      shopInfo: shopInfo ? '✓ Success' : '✗ Failed',
      shopName: shopInfo?.shop?.name || 'Unknown',
      orderCount: orderCount?.count || 0,
      firstOrdersCount: firstOrders?.orders?.length || 0,
      apiConnectivity: '✓ All tests passed',
      timestamp: new Date().toISOString()
    }

    console.log('[SHOPIFY TEST] All tests completed:', results)

    return NextResponse.json({
      success: true,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        domain: tenant.shopifyDomain
      },
      tests: results
    })

  } catch (error) {
    console.error('[SHOPIFY TEST ERROR]:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: process.env.NODE_ENV === 'development' ? (error as Error)?.stack : undefined
    }, { status: 500 })
  }
}