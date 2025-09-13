import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { ShopifyService } from '@/services/shopify'
import crypto from 'crypto'

function verifyWebhook(body: string, signature: string, secret: string): boolean {
  const hmac = crypto.createHmac('sha256', secret)
  hmac.update(body, 'utf8')
  const calculatedSignature = hmac.digest('base64')
  
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'base64'),
    Buffer.from(calculatedSignature, 'base64')
  )
}

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get('x-shopify-hmac-sha256')
    const topic = request.headers.get('x-shopify-topic')
    const shopDomain = request.headers.get('x-shopify-shop-domain')
    
    if (!signature || !topic || !shopDomain) {
      return NextResponse.json({ error: 'Missing required headers' }, { status: 400 })
    }

    const body = await request.text()
    
    // Find tenant by shop domain
    const tenant = await prisma.tenant.findUnique({
      where: {
        shopifyDomain: shopDomain
      }
    })

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }

    // Verify webhook signature
    if (tenant.webhookSecret) {
      const isValid = verifyWebhook(body, signature, tenant.webhookSecret)
      if (!isValid) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    }

    const payload = JSON.parse(body)

    // Initialize Shopify service
    const shopifyService = new ShopifyService({
      domain: tenant.shopifyDomain,
      accessToken: tenant.shopifyAccessToken || '',
      apiKey: tenant.apiKey || undefined,
      apiSecret: tenant.apiSecret || undefined,
      webhookSecret: tenant.webhookSecret || undefined
    }, tenant.id)

    // Handle different webhook topics
    switch (topic) {
      case 'customers/create':
      case 'customers/update':
        await handleCustomerWebhook(payload, tenant.id)
        break
        
      case 'orders/create':
      case 'orders/updated':
      case 'orders/paid':
        await handleOrderWebhook(payload, tenant.id)
        break
        
      case 'products/create':
      case 'products/update':
        await handleProductWebhook(payload, tenant.id)
        break
        
      case 'carts/create':
      case 'carts/update':
        await handleCartWebhook(payload, tenant.id, topic)
        break
        
      case 'checkouts/create':
      case 'checkouts/update':
        await handleCheckoutWebhook(payload, tenant.id, topic)
        break
        
      default:
        console.log(`Unhandled webhook topic: ${topic}`)
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function handleCustomerWebhook(customer: any, tenantId: string) {
  await prisma.customer.upsert({
    where: {
      shopifyId_tenantId: {
        shopifyId: customer.id.toString(),
        tenantId
      }
    },
    update: {
      email: customer.email,
      firstName: customer.first_name,
      lastName: customer.last_name,
      phone: customer.phone,
      totalSpent: parseFloat(customer.total_spent || '0'),
      ordersCount: customer.orders_count || 0,
      tags: customer.tags ? customer.tags.split(', ') : [],
      acceptsMarketing: customer.accepts_marketing || false,
      updatedAt: new Date()
    },
    create: {
      shopifyId: customer.id.toString(),
      tenantId,
      email: customer.email,
      firstName: customer.first_name,
      lastName: customer.last_name,
      phone: customer.phone,
      totalSpent: parseFloat(customer.total_spent || '0'),
      ordersCount: customer.orders_count || 0,
      tags: customer.tags ? customer.tags.split(', ') : [],
      acceptsMarketing: customer.accepts_marketing || false
    }
  })
}

async function handleOrderWebhook(order: any, tenantId: string) {
  // First, ensure customer exists
  let customer = null
  if (order.customer?.id) {
    customer = await prisma.customer.findUnique({
      where: {
        shopifyId_tenantId: {
          shopifyId: order.customer.id.toString(),
          tenantId
        }
      }
    })
  }

  await prisma.order.upsert({
    where: {
      shopifyId_tenantId: {
        shopifyId: order.id.toString(),
        tenantId
      }
    },
    update: {
      orderNumber: order.order_number?.toString() || order.name,
      email: order.email,
      totalPrice: parseFloat(order.total_price),
      subtotalPrice: parseFloat(order.subtotal_price || '0'),
      totalTax: parseFloat(order.total_tax || '0'),
      currency: order.currency,
      financialStatus: order.financial_status,
      fulfillmentStatus: order.fulfillment_status,
      tags: order.tags ? order.tags.split(', ') : [],
      note: order.note,
      processedAt: order.processed_at ? new Date(order.processed_at) : null,
      cancelledAt: order.cancelled_at ? new Date(order.cancelled_at) : null,
      updatedAt: new Date()
    },
    create: {
      shopifyId: order.id.toString(),
      tenantId,
      customerId: customer?.id,
      orderNumber: order.order_number?.toString() || order.name,
      email: order.email,
      totalPrice: parseFloat(order.total_price),
      subtotalPrice: parseFloat(order.subtotal_price || '0'),
      totalTax: parseFloat(order.total_tax || '0'),
      currency: order.currency,
      financialStatus: order.financial_status,
      fulfillmentStatus: order.fulfillment_status,
      tags: order.tags ? order.tags.split(', ') : [],
      note: order.note,
      processedAt: order.processed_at ? new Date(order.processed_at) : null,
      cancelledAt: order.cancelled_at ? new Date(order.cancelled_at) : null
    }
  })
}

async function handleProductWebhook(product: any, tenantId: string) {
  await prisma.product.upsert({
    where: {
      shopifyId_tenantId: {
        shopifyId: product.id.toString(),
        tenantId
      }
    },
    update: {
      title: product.title,
      handle: product.handle,
      description: product.body_html,
      vendor: product.vendor,
      productType: product.product_type,
      tags: product.tags ? product.tags.split(', ') : [],
      status: product.status,
      images: product.images || [],
      variants: product.variants || [],
      updatedAt: new Date()
    },
    create: {
      shopifyId: product.id.toString(),
      tenantId,
      title: product.title,
      handle: product.handle,
      description: product.body_html,
      vendor: product.vendor,
      productType: product.product_type,
      tags: product.tags ? product.tags.split(', ') : [],
      status: product.status,
      images: product.images || [],
      variants: product.variants || []
    }
  })
}

async function handleCartWebhook(cart: any, tenantId: string, topic: string) {
  // Create custom event for cart activity
  await prisma.customEvent.create({
    data: {
      tenantId,
      customerId: cart.customer_id ? await getCustomerId(cart.customer_id.toString(), tenantId) : null,
      eventType: topic === 'carts/create' ? 'cart_created' : 'cart_updated',
      eventData: cart
    }
  })
}

async function handleCheckoutWebhook(checkout: any, tenantId: string, topic: string) {
  // Create custom event for checkout activity
  await prisma.customEvent.create({
    data: {
      tenantId,
      customerId: checkout.customer_id ? await getCustomerId(checkout.customer_id.toString(), tenantId) : null,
      eventType: topic === 'checkouts/create' ? 'checkout_started' : 'checkout_updated',
      eventData: checkout
    }
  })
}

async function getCustomerId(shopifyCustomerId: string, tenantId: string): Promise<string | null> {
  const customer = await prisma.customer.findUnique({
    where: {
      shopifyId_tenantId: {
        shopifyId: shopifyCustomerId,
        tenantId
      }
    }
  })
  return customer?.id || null
}