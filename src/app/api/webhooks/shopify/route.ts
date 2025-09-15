import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { ShopifyService } from '@/services/shopify'
import crypto from 'crypto'

// Rate limiting for webhook requests
const requestCounts = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100 // Max 100 requests per minute per domain

function checkRateLimit(domain: string): boolean {
  const now = Date.now()
  const key = domain
  const current = requestCounts.get(key)

  if (!current || now > current.resetTime) {
    requestCounts.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW })
    return true
  }

  if (current.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false
  }

  current.count++
  return true
}

function verifyWebhook(body: string, signature: string, secret: string): boolean {
  try {
    const hmac = crypto.createHmac('sha256', secret)
    hmac.update(body, 'utf8')
    const calculatedSignature = hmac.digest('base64')
    
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'base64'),
      Buffer.from(calculatedSignature, 'base64')
    )
  } catch (error) {
    console.error('Error verifying webhook signature:', error)
    return false
  }
}

async function logWebhookRequest(
  tenantId: string,
  topic: string,
  success: boolean,
  processingTime: number,
  error?: string
) {
  try {
    await prisma.syncLog.create({
      data: {
        tenantId,
        syncType: `webhook_${topic.replace('/', '_')}`,
        success,
        recordsProcessed: success ? 1 : 0,
        duration: processingTime,
        error,
        createdAt: new Date()
      }
    })
  } catch (logError) {
    console.error('Failed to log webhook request:', logError)
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  let tenantId: string | undefined
  let topic: string | null = null

  try {
    // Extract headers
    const signature = request.headers.get('x-shopify-hmac-sha256')
    topic = request.headers.get('x-shopify-topic')
    const shopDomain = request.headers.get('x-shopify-shop-domain')
    const apiVersion = request.headers.get('x-shopify-api-version')
    const webhookId = request.headers.get('x-shopify-webhook-id')
    
    // Validate required headers
    if (!signature || !topic || !shopDomain) {
      console.error('Missing required headers:', { signature: !!signature, topic, shopDomain })
      return NextResponse.json({ error: 'Missing required headers' }, { status: 400 })
    }

    // Rate limiting
    if (!checkRateLimit(shopDomain)) {
      console.warn(`Rate limit exceeded for domain: ${shopDomain}`)
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    // Get request body
    const body = await request.text()
    
    // Basic body validation
    if (!body || body.length === 0) {
      return NextResponse.json({ error: 'Empty request body' }, { status: 400 })
    }

    // Find tenant by shop domain
    const tenant = await prisma.tenant.findUnique({
      where: {
        shopifyDomain: shopDomain
      }
    })

    if (!tenant) {
      console.error(`Tenant not found for domain: ${shopDomain}`)
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }

    tenantId = tenant.id

    // Verify webhook signature if secret is configured
    if (tenant.webhookSecret) {
      const isValid = verifyWebhook(body, signature, tenant.webhookSecret)
      if (!isValid) {
        console.error(`Invalid webhook signature for tenant: ${tenant.name}`)
        await logWebhookRequest(tenant.id, topic, false, Date.now() - startTime, 'Invalid signature')
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    } else {
      console.warn(`No webhook secret configured for tenant: ${tenant.name}`)
    }

    // Parse payload
    let payload
    try {
      payload = JSON.parse(body)
    } catch (parseError) {
      console.error('Failed to parse webhook payload:', parseError)
      await logWebhookRequest(tenant.id, topic, false, Date.now() - startTime, 'Invalid JSON payload')
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
    }

    // Log webhook request details for debugging
    console.log(`📨 Webhook received: ${topic} for ${shopDomain} (ID: ${webhookId}, API: ${apiVersion})`)

    // Initialize Shopify service
    const shopifyService = new ShopifyService({
      domain: tenant.shopifyDomain,
      accessToken: tenant.shopifyAccessToken || '',
      apiKey: tenant.apiKey || undefined,
      apiSecret: tenant.apiSecret || undefined,
      webhookSecret: tenant.webhookSecret || undefined
    }, tenant.id)

    // Handle different webhook topics with error isolation
    try {
      switch (topic) {
        case 'customers/create':
        case 'customers/update':
          await handleCustomerWebhook(payload, tenant.id, shopifyService)
          break
          
        case 'orders/create':
        case 'orders/updated':
        case 'orders/paid':
        case 'orders/cancelled':
          await handleOrderWebhook(payload, tenant.id, shopifyService)
          break
          
        case 'products/create':
        case 'products/update':
          await handleProductWebhook(payload, tenant.id, shopifyService)
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
          console.log(`⚠️ Unhandled webhook topic: ${topic}`)
          // Still log as successful since we received it properly
      }

      // Log successful processing
      const processingTime = Date.now() - startTime
      await logWebhookRequest(tenant.id, topic, true, processingTime)
      
      console.log(`✅ Webhook ${topic} processed successfully for ${shopDomain} in ${processingTime}ms`)
      
      return NextResponse.json({ 
        success: true, 
        processed: topic,
        processingTime: processingTime
      })

    } catch (handlerError) {
      // Log handler-specific errors
      const processingTime = Date.now() - startTime
      const errorMessage = handlerError instanceof Error ? handlerError.message : 'Unknown handler error'
      
      await logWebhookRequest(tenant.id, topic, false, processingTime, errorMessage)
      
      console.error(`❌ Error handling webhook ${topic} for ${shopDomain}:`, handlerError)
      
      // Return success to Shopify to prevent retries for application errors
      return NextResponse.json({ 
        success: false, 
        error: 'Processing error',
        topic,
        processingTime
      }, { status: 200 })
    }

  } catch (error) {
    // Log general errors
    const processingTime = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    if (tenantId && topic) {
      await logWebhookRequest(tenantId, topic, false, processingTime, errorMessage)
    }
    
    console.error('❌ General webhook error:', error)
    
    return NextResponse.json({ 
      error: 'Internal server error',
      processingTime
    }, { status: 500 })
  }
}

async function handleCustomerWebhook(customer: any, tenantId: string, shopifyService: ShopifyService) {
  try {
    await shopifyService.syncCustomerFromWebhook(customer)
    console.log(`👤 Customer ${customer.id} synced successfully`)
  } catch (error) {
    console.error(`❌ Error syncing customer ${customer.id}:`, error)
    throw error
  }
}

async function handleOrderWebhook(order: any, tenantId: string, shopifyService: ShopifyService) {
  try {
    await shopifyService.syncOrderFromWebhook(order)
    console.log(`📦 Order ${order.id} synced successfully`)
  } catch (error) {
    console.error(`❌ Error syncing order ${order.id}:`, error)
    throw error
  }
}

async function handleProductWebhook(product: any, tenantId: string, shopifyService: ShopifyService) {
  try {
    await shopifyService.syncProductFromWebhook(product)
    console.log(`🛍️ Product ${product.id} synced successfully`)
  } catch (error) {
    console.error(`❌ Error syncing product ${product.id}:`, error)
    throw error
  }
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

    console.log(`🛒💔 Cart ${cart.id} marked as abandoned (value: ₹${cart.total_price})`);
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