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
      const customers = await this.shopify.customer.list({ limit })
      
      for (const customer of customers) {
        await this.upsertCustomer(customer)
      }
      
      return customers.length
    } catch (error) {
      console.error('Error syncing customers:', error)
      throw error
    }
  }

  async syncOrders(limit = 250) {
    try {
      const orders = await this.shopify.order.list({ 
        limit,
        status: 'any'
      })
      
      for (const order of orders) {
        await this.upsertOrder(order)
      }
      
      return orders.length
    } catch (error) {
      console.error('Error syncing orders:', error)
      throw error
    }
  }

  async syncProducts(limit = 250) {
    try {
      const products = await this.shopify.product.list({ limit })
      
      for (const product of products) {
        await this.upsertProduct(product)
      }
      
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
}