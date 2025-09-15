import Shopify from 'shopify-api-node'
import { prisma } from '@/lib/db'
import { ShopifyConfig } from '@/types'

export class ShopifyService {
  private shopify: Shopify
  private tenantId: string

  constructor(config: ShopifyConfig, tenantId: string) {
    this.shopify = new Shopify({
      shopName: config.domain,
      accessToken: config.accessToken,
      apiVersion: process.env.SHOPIFY_API_VERSION || '2024-01'
    })
    this.tenantId = tenantId
  }

  async syncCustomers(limit = 250) {
    try {
      // Get the last sync time for customers
      const lastSync = await this.getLastSyncTime('customers')
      
      const params: any = { limit }
      if (lastSync) {
        params.updated_at_min = lastSync.toISOString()
        console.log(`Incremental customer sync since: ${lastSync.toISOString()}`)
      } else {
        console.log('Full customer sync (first time)')
      }
      
      const customers = await this.shopify.customer.list(params)
      
      for (const customer of customers) {
        await this.upsertCustomer(customer)
      }
      
      // Update last sync time
      await this.updateLastSyncTime('customers')
      
      return customers.length
    } catch (error) {
      console.error('Error syncing customers:', error)
      throw error
    }
  }

  async syncOrders(limit = 250) {
    try {
      // Get the last sync time for orders
      const lastSync = await this.getLastSyncTime('orders')
      
      const params: any = { 
        limit,
        status: 'any'
      }
      if (lastSync) {
        params.updated_at_min = lastSync.toISOString()
        console.log(`Incremental order sync since: ${lastSync.toISOString()}`)
      } else {
        console.log('Full order sync (first time)')
      }
      
      const orders = await this.shopify.order.list(params)
      
      for (const order of orders) {
        await this.upsertOrder(order)
      }
      
      // Update last sync time
      await this.updateLastSyncTime('orders')
      
      return orders.length
    } catch (error) {
      console.error('Error syncing orders:', error)
      throw error
    }
  }

  async syncProducts(limit = 250) {
    try {
      // Get the last sync time for products
      const lastSync = await this.getLastSyncTime('products')
      
      const params: any = { limit }
      if (lastSync) {
        params.updated_at_min = lastSync.toISOString()
        console.log(`Incremental product sync since: ${lastSync.toISOString()}`)
      } else {
        console.log('Full product sync (first time)')
      }
      
      const products = await this.shopify.product.list(params)
      
      for (const product of products) {
        await this.upsertProduct(product)
      }
      
      // Update last sync time
      await this.updateLastSyncTime('products')
      
      return products.length
    } catch (error) {
      console.error('Error syncing products:', error)
      throw error
    }
  }

  private async upsertCustomer(shopifyCustomer: any) {
    return await prisma.customer.upsert({
      where: {
        shopifyId_tenantId: {
          shopifyId: shopifyCustomer.id.toString(),
          tenantId: this.tenantId
        }
      },
      update: {
        email: shopifyCustomer.email,
        firstName: shopifyCustomer.first_name,
        lastName: shopifyCustomer.last_name,
        phone: shopifyCustomer.phone,
        totalSpent: parseFloat(shopifyCustomer.total_spent || '0'),
        ordersCount: shopifyCustomer.orders_count || 0,
        tags: shopifyCustomer.tags ? shopifyCustomer.tags.split(', ') : [],
        acceptsMarketing: shopifyCustomer.accepts_marketing || false,
        updatedAt: new Date()
      },
      create: {
        shopifyId: shopifyCustomer.id.toString(),
        tenantId: this.tenantId,
        email: shopifyCustomer.email,
        firstName: shopifyCustomer.first_name,
        lastName: shopifyCustomer.last_name,
        phone: shopifyCustomer.phone,
        totalSpent: parseFloat(shopifyCustomer.total_spent || '0'),
        ordersCount: shopifyCustomer.orders_count || 0,
        tags: shopifyCustomer.tags ? shopifyCustomer.tags.split(', ') : [],
        acceptsMarketing: shopifyCustomer.accepts_marketing || false
      }
    })
  }

  private async upsertOrder(shopifyOrder: any) {
    // First, ensure customer exists
    let customer = null
    if (shopifyOrder.customer?.id) {
      customer = await prisma.customer.findUnique({
        where: {
          shopifyId_tenantId: {
            shopifyId: shopifyOrder.customer.id.toString(),
            tenantId: this.tenantId
          }
        }
      })
    }

    const order = await prisma.order.upsert({
      where: {
        shopifyId_tenantId: {
          shopifyId: shopifyOrder.id.toString(),
          tenantId: this.tenantId
        }
      },
      update: {
        orderNumber: shopifyOrder.order_number?.toString() || shopifyOrder.name,
        email: shopifyOrder.email,
        totalPrice: parseFloat(shopifyOrder.total_price),
        subtotalPrice: parseFloat(shopifyOrder.subtotal_price || '0'),
        totalTax: parseFloat(shopifyOrder.total_tax || '0'),
        currency: shopifyOrder.currency,
        financialStatus: shopifyOrder.financial_status,
        fulfillmentStatus: shopifyOrder.fulfillment_status,
        tags: shopifyOrder.tags ? shopifyOrder.tags.split(', ') : [],
        note: shopifyOrder.note,
        processedAt: shopifyOrder.processed_at ? new Date(shopifyOrder.processed_at) : null,
        cancelledAt: shopifyOrder.cancelled_at ? new Date(shopifyOrder.cancelled_at) : null,
        updatedAt: new Date()
      },
      create: {
        shopifyId: shopifyOrder.id.toString(),
        tenantId: this.tenantId,
        customerId: customer?.id,
        orderNumber: shopifyOrder.order_number?.toString() || shopifyOrder.name,
        email: shopifyOrder.email,
        totalPrice: parseFloat(shopifyOrder.total_price),
        subtotalPrice: parseFloat(shopifyOrder.subtotal_price || '0'),
        totalTax: parseFloat(shopifyOrder.total_tax || '0'),
        currency: shopifyOrder.currency,
        financialStatus: shopifyOrder.financial_status,
        fulfillmentStatus: shopifyOrder.fulfillment_status,
        tags: shopifyOrder.tags ? shopifyOrder.tags.split(', ') : [],
        note: shopifyOrder.note,
        processedAt: shopifyOrder.processed_at ? new Date(shopifyOrder.processed_at) : null,
        cancelledAt: shopifyOrder.cancelled_at ? new Date(shopifyOrder.cancelled_at) : null
      }
    })

    // Handle order items
    if (shopifyOrder.line_items) {
      // Delete existing order items
      await prisma.orderItem.deleteMany({
        where: { orderId: order.id }
      })

      // Create new order items
      for (const lineItem of shopifyOrder.line_items) {
        let product = null
        if (lineItem.product_id) {
          product = await prisma.product.findUnique({
            where: {
              shopifyId_tenantId: {
                shopifyId: lineItem.product_id.toString(),
                tenantId: this.tenantId
              }
            }
          })
        }

        await prisma.orderItem.create({
          data: {
            orderId: order.id,
            productId: product?.id,
            variantId: lineItem.variant_id?.toString(),
            title: lineItem.title,
            quantity: lineItem.quantity,
            price: parseFloat(lineItem.price),
            totalDiscount: parseFloat(lineItem.total_discount || '0')
          }
        })
      }
    }

    return order
  }

  private async upsertProduct(shopifyProduct: any) {
    return await prisma.product.upsert({
      where: {
        shopifyId_tenantId: {
          shopifyId: shopifyProduct.id.toString(),
          tenantId: this.tenantId
        }
      },
      update: {
        title: shopifyProduct.title,
        handle: shopifyProduct.handle,
        description: shopifyProduct.body_html,
        vendor: shopifyProduct.vendor,
        productType: shopifyProduct.product_type,
        tags: shopifyProduct.tags ? shopifyProduct.tags.split(', ') : [],
        status: shopifyProduct.status,
        images: shopifyProduct.images || [],
        variants: shopifyProduct.variants || [],
        updatedAt: new Date()
      },
      create: {
        shopifyId: shopifyProduct.id.toString(),
        tenantId: this.tenantId,
        title: shopifyProduct.title,
        handle: shopifyProduct.handle,
        description: shopifyProduct.body_html,
        vendor: shopifyProduct.vendor,
        productType: shopifyProduct.product_type,
        tags: shopifyProduct.tags ? shopifyProduct.tags.split(', ') : [],
        status: shopifyProduct.status,
        images: shopifyProduct.images || [],
        variants: shopifyProduct.variants || []
      }
    })
  }

  async createWebhook(topic: string, address: string) {
    try {
      const webhook = await this.shopify.webhook.create({
        topic: topic as any,
        address,
        format: 'json'
      })
      return webhook
    } catch (error) {
      console.error('Error creating webhook:', error)
      throw error
    }
  }

  async getWebhooks() {
    try {
      return await this.shopify.webhook.list()
    } catch (error) {
      console.error('Error getting webhooks:', error)
      throw error
    }
  }

  async registerWebhooks(baseUrl: string) {
    const webhooks = [
      {
        topic: 'orders/create',
        address: `${baseUrl}/api/webhooks/shopify`,
        format: 'json'
      },
      {
        topic: 'orders/updated',
        address: `${baseUrl}/api/webhooks/shopify`,
        format: 'json'
      },
      {
        topic: 'orders/paid',
        address: `${baseUrl}/api/webhooks/shopify`,
        format: 'json'
      },
      {
        topic: 'orders/cancelled',
        address: `${baseUrl}/api/webhooks/shopify`,
        format: 'json'
      },
      {
        topic: 'customers/create',
        address: `${baseUrl}/api/webhooks/shopify`,
        format: 'json'
      },
      {
        topic: 'customers/update',
        address: `${baseUrl}/api/webhooks/shopify`,
        format: 'json'
      },
      {
        topic: 'products/create',
        address: `${baseUrl}/api/webhooks/shopify`,
        format: 'json'
      },
      {
        topic: 'products/update',
        address: `${baseUrl}/api/webhooks/shopify`,
        format: 'json'
      },
      {
        topic: 'carts/create',
        address: `${baseUrl}/api/webhooks/shopify`,
        format: 'json'
      },
      {
        topic: 'carts/update',
        address: `${baseUrl}/api/webhooks/shopify`,
        format: 'json'
      },
      {
        topic: 'checkouts/create',
        address: `${baseUrl}/api/webhooks/shopify`,
        format: 'json'
      },
      {
        topic: 'checkouts/update',
        address: `${baseUrl}/api/webhooks/shopify`,
        format: 'json'
      }
    ]

    const results = []
    const existingWebhooks = await this.getWebhooks()

    for (const webhook of webhooks) {
      try {
        // Check if webhook already exists
        const existing = existingWebhooks.find(
          (w: any) => w.topic === webhook.topic && w.address === webhook.address
        )

        if (existing) {
          console.log(`Webhook for ${webhook.topic} already exists`)
          results.push({ topic: webhook.topic, status: 'exists', id: existing.id })
        } else {
          const created = await this.shopify.webhook.create(webhook)
          console.log(`Webhook for ${webhook.topic} created successfully`)
          results.push({ topic: webhook.topic, status: 'created', id: created.id })
        }
      } catch (error) {
        console.error(`Failed to create webhook for ${webhook.topic}:`, error)
        results.push({ 
          topic: webhook.topic, 
          status: 'failed', 
          error: error instanceof Error ? error.message : 'Unknown error' 
        })
      }
    }

    return results
  }

  async unregisterWebhooks(baseUrl: string) {
    try {
      const webhooks = await this.getWebhooks()
      const toDelete = webhooks.filter((w: any) => 
        w.address && w.address.includes(baseUrl)
      )

      const results = []
      for (const webhook of toDelete) {
        try {
          await this.shopify.webhook.delete(webhook.id)
          console.log(`Webhook ${webhook.id} (${webhook.topic}) deleted successfully`)
          results.push({ id: webhook.id, topic: webhook.topic, status: 'deleted' })
        } catch (error) {
          console.error(`Failed to delete webhook ${webhook.id}:`, error)
          results.push({ 
            id: webhook.id, 
            topic: webhook.topic, 
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error' 
          })
        }
      }

      return results
    } catch (error) {
      console.error('Error unregistering webhooks:', error)
      throw error
    }
  }

  async updateWebhooks(baseUrl: string) {
    try {
      // First unregister old webhooks, then register new ones
      await this.unregisterWebhooks(baseUrl)
      await new Promise(resolve => setTimeout(resolve, 2000)) // Wait 2 seconds
      return await this.registerWebhooks(baseUrl)
    } catch (error) {
      console.error('Error updating webhooks:', error)
      throw error
    }
  }

  // Real-time sync methods triggered by webhooks
  async syncOrderFromWebhook(orderData: any) {
    try {
      return await this.upsertOrder(orderData)
    } catch (error) {
      console.error('Error syncing order from webhook:', error)
      throw error
    }
  }

  async syncCustomerFromWebhook(customerData: any) {
    try {
      return await this.upsertCustomer(customerData)
    } catch (error) {
      console.error('Error syncing customer from webhook:', error)
      throw error
    }
  }

  async syncProductFromWebhook(productData: any) {
    try {
      return await this.upsertProduct(productData)
    } catch (error) {
      console.error('Error syncing product from webhook:', error)
      throw error
    }
  }

  // Incremental sync helper methods
  private async getLastSyncTime(syncType: string): Promise<Date | null> {
    try {
      const lastLog = await prisma.syncLog.findFirst({
        where: {
          tenantId: this.tenantId,
          syncType,
          success: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      })

      return lastLog ? lastLog.createdAt : null
    } catch (error) {
      console.error(`Error getting last sync time for ${syncType}:`, error)
      return null
    }
  }

  private async updateLastSyncTime(syncType: string): Promise<void> {
    try {
      await prisma.syncLog.create({
        data: {
          tenantId: this.tenantId,
          syncType,
          success: true,
          recordsProcessed: 0, // Will be updated by the calling function
          duration: 0, // Will be updated by the calling function
          createdAt: new Date()
        }
      })
    } catch (error) {
      console.error(`Error updating last sync time for ${syncType}:`, error)
    }
  }

  // Batch sync methods for better performance
  async syncCustomersBatch(customerIds: string[]) {
    const results = []
    const batchSize = 50

    for (let i = 0; i < customerIds.length; i += batchSize) {
      const batch = customerIds.slice(i, i + batchSize)
      
      try {
        for (const customerId of batch) {
          const customer = await this.shopify.customer.get(customerId)
          await this.upsertCustomer(customer)
          results.push({ id: customerId, success: true })
        }
      } catch (error) {
        console.error(`Error syncing customer batch:`, error)
        batch.forEach(id => results.push({ id, success: false, error: error.message }))
      }

      // Small delay between batches
      if (i + batchSize < customerIds.length) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    return results
  }

  async syncOrdersBatch(orderIds: string[]) {
    const results = []
    const batchSize = 50

    for (let i = 0; i < orderIds.length; i += batchSize) {
      const batch = orderIds.slice(i, i + batchSize)
      
      try {
        for (const orderId of batch) {
          const order = await this.shopify.order.get(orderId)
          await this.upsertOrder(order)
          results.push({ id: orderId, success: true })
        }
      } catch (error) {
        console.error(`Error syncing order batch:`, error)
        batch.forEach(id => results.push({ id, success: false, error: error.message }))
      }

      // Small delay between batches
      if (i + batchSize < orderIds.length) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    return results
  }

  // Advanced sync methods with filtering
  async syncRecentOrders(hours: number = 24) {
    try {
      const sinceDate = new Date(Date.now() - hours * 60 * 60 * 1000)
      
      const orders = await this.shopify.order.list({
        updated_at_min: sinceDate.toISOString(),
        status: 'any',
        limit: 250
      })

      for (const order of orders) {
        await this.upsertOrder(order)
      }

      return orders.length
    } catch (error) {
      console.error('Error syncing recent orders:', error)
      throw error
    }
  }

  async syncOrdersByStatus(status: string) {
    try {
      const orders = await this.shopify.order.list({
        financial_status: status,
        limit: 250
      })

      for (const order of orders) {
        await this.upsertOrder(order)
      }

      return orders.length
    } catch (error) {
      console.error(`Error syncing orders with status ${status}:`, error)
      throw error
    }
  }

  // Cleanup methods
  async cleanupOldRecords(days: number = 90) {
    try {
      const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      
      // Clean up old sync logs
      const deletedLogs = await prisma.syncLog.deleteMany({
        where: {
          tenantId: this.tenantId,
          createdAt: {
            lt: cutoffDate
          }
        }
      })

      // Clean up old custom events
      const deletedEvents = await prisma.customEvent.deleteMany({
        where: {
          tenantId: this.tenantId,
          createdAt: {
            lt: cutoffDate
          }
        }
      })

      return {
        deletedLogs: deletedLogs.count,
        deletedEvents: deletedEvents.count
      }
    } catch (error) {
      console.error('Error cleaning up old records:', error)
      throw error
    }
  }
}