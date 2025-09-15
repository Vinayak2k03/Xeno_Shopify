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
  console.log(`📄 Processing ${topic} for cart ${cart.id}`);
  
  // Find customer if exists
  let customerId = null;
  if (cart.customer_id) {
    customerId = await getCustomerId(cart.customer_id.toString(), tenantId);
  }

  // Create custom event for cart activity
  await prisma.customEvent.create({
    data: {
      tenantId,
      customerId,
      eventType: topic === 'carts/create' ? 'cart_created' : 'cart_updated',
      eventData: {
        cartId: cart.id,
        cartToken: cart.token,
        totalPrice: parseFloat(cart.total_price || '0'),
        itemCount: cart.line_items?.length || 0,
        currency: cart.currency,
        customerId: cart.customer_id,
        email: cart.email,
        lineItems: cart.line_items?.map((item: any) => ({
          productId: item.product_id,
          variantId: item.variant_id,
          quantity: item.quantity,
          price: item.price,
          title: item.title
        })) || [],
        createdAt: cart.created_at,
        updatedAt: cart.updated_at
      }
    }
  });

  console.log(`✅ Created ${topic === 'carts/create' ? 'cart_created' : 'cart_updated'} event for cart ${cart.id}`);

  // For cart updates, schedule abandonment detection later
  if (topic === 'carts/update' && cart.line_items?.length > 0) {
    setTimeout(async () => {
      await detectCartAbandonment(cart, tenantId, customerId);
    }, 60000); // Check for abandonment after 1 minute
  }
}
async function handleCheckoutWebhook(checkout: any, tenantId: string, topic: string) {
  console.log(`🛒 Processing ${topic} for checkout ${checkout.id}`);
  
  // Find customer if exists
  let customerId = null;
  if (checkout.customer_id) {
    customerId = await getCustomerId(checkout.customer_id.toString(), tenantId);
  }

  // Create custom event for checkout activity
  await prisma.customEvent.create({
    data: {
      tenantId,
      customerId,
      eventType: topic === 'checkouts/create' ? 'checkout_started' : 'checkout_updated',
      eventData: {
        checkoutId: checkout.id,
        checkoutToken: checkout.token,
        totalPrice: parseFloat(checkout.total_price || '0'),
        subtotalPrice: parseFloat(checkout.subtotal_price || '0'),
        totalTax: parseFloat(checkout.total_tax || '0'),
        currency: checkout.currency,
        email: checkout.email,
        phone: checkout.phone,
        customerId: checkout.customer_id,
        shippingAddress: checkout.shipping_address,
        billingAddress: checkout.billing_address,
        completedAt: checkout.completed_at,
        lineItems: checkout.line_items?.map((item: any) => ({
          productId: item.product_id,
          variantId: item.variant_id,
          quantity: item.quantity,
          price: item.price,
          title: item.title
        })) || [],
        createdAt: checkout.created_at,
        updatedAt: checkout.updated_at
      }
    }
  });

  console.log(`✅ Created ${topic === 'checkouts/create' ? 'checkout_started' : 'checkout_updated'} event for checkout ${checkout.id}`);
}

// Detect cart abandonment
async function detectCartAbandonment(cart: any, tenantId: string, customerId: string | null) {
  try {
    // Check if cart still exists and has items
    if (!cart.line_items || cart.line_items.length === 0) {
      return;
    }

    // Check if there's already an abandonment event for this cart
    const existingAbandonment = await prisma.customEvent.findFirst({
      where: {
        tenantId,
        eventType: 'cart_abandoned',
        eventData: {
          path: ['cartId'],
          equals: cart.id
        }
      }
    });

    if (existingAbandonment) {
      console.log(`⏭️ Cart ${cart.id} already marked as abandoned`);
      return;
    }

    // Check if an order was created from this cart
    const recentOrder = await prisma.order.findFirst({
      where: {
        tenantId,
        customerId,
        createdAt: {
          gte: new Date(cart.updated_at)
        }
      }
    });

    if (recentOrder) {
      console.log(`✅ Cart ${cart.id} was converted to order ${recentOrder.id}`);
      return;
    }

    // Check if there's a recent checkout for this customer
    const recentCheckout = await prisma.customEvent.findFirst({
      where: {
        tenantId,
        customerId,
        eventType: 'checkout_started',
        createdAt: {
          gte: new Date(cart.updated_at)
        }
      }
    });

    if (recentCheckout) {
      console.log(`✅ Cart ${cart.id} progressed to checkout`);
      return;
    }

    // Mark cart as abandoned
    await prisma.customEvent.create({
      data: {
        tenantId,
        customerId,
        eventType: 'cart_abandoned',
        eventData: {
          cartId: cart.id,
          cartToken: cart.token,
          totalPrice: parseFloat(cart.total_price || '0'),
          itemCount: cart.line_items.length,
          currency: cart.currency,
          email: cart.email,
          abandonedAt: new Date(),
          timeToAbandon: Date.now() - new Date(cart.updated_at).getTime(),
          lineItems: cart.line_items.map((item: any) => ({
            productId: item.product_id,
            variantId: item.variant_id,
            quantity: item.quantity,
            price: item.price,
            title: item.title
          }))
        }
      }
    });

    console.log(`🛒💔 Cart ${cart.id} marked as abandoned (value: $${cart.total_price})`);
  } catch (error) {
    console.error(`❌ Error detecting cart abandonment for cart ${cart.id}:`, error);
  }
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