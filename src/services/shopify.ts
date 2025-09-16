import { prisma } from '@/lib/db'
import { ShopifyConfig } from '@/types'

export class ShopifyService {
  private shopName: string
  private accessToken: string
  private tenantId: string
  private apiVersion: string

  constructor(config: ShopifyConfig, tenantId: string) {
    this.shopName = config.domain
    this.accessToken = config.accessToken
    this.tenantId = tenantId
    this.apiVersion = process.env.SHOPIFY_API_VERSION || '2024-01'
  }

  private async makeShopifyRequest(endpoint: string, params: Record<string, any> = {}) {
    const url = new URL(`https://${this.shopName}/admin/api/${this.apiVersion}/${endpoint}`)
    
    // Add query parameters
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null) {
        url.searchParams.append(key, params[key].toString())
      }
    })

    console.log(`[SHOPIFY API] Making request to: ${endpoint}`, { params, tenantId: this.tenantId })

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': this.accessToken,
        'Content-Type': 'application/json',
      },
      // Add timeout for Vercel
      signal: AbortSignal.timeout(25000) // 25 seconds, well under Vercel's 30s limit
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[SHOPIFY API ERROR] ${response.status} ${response.statusText}:`, errorText)
      throw new Error(`Shopify API error: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const data = await response.json()
    console.log(`[SHOPIFY API SUCCESS] ${endpoint} returned ${data.orders?.length || data.customers?.length || data.products?.length || 0} items`)
    return data
  }

  async syncCustomers(limit = 250) {
    try {
      console.log(`Starting customer sync for tenant ${this.tenantId}`)
      
      // Get the last sync time for customers
      const lastSync = await this.getLastSyncTime('customers')
      
      const params: any = { 
        limit: Math.min(limit, 250) // Shopify API limit is 250
      }
      
      // For incremental sync, use last sync time
      if (lastSync) {
        params.updated_at_min = lastSync.toISOString()
        console.log(`Incremental customer sync since: ${lastSync.toISOString()}`)
      } else {
        console.log('Full customer sync - fetching ALL customers from store history')
      }
      
      let allCustomers = []
      let hasMorePages = true
      let pageInfo = null
      
      // Fetch all pages using proper pagination
      while (hasMorePages && allCustomers.length < 5000) { // Safety limit
        try {
          const pageParams = { ...params }
          if (pageInfo) {
            pageParams.page_info = pageInfo
          }
          
          console.log(`Fetching customers page...`)
          const data = await this.makeShopifyRequest('customers.json', pageParams)
          const customers = data.customers || []
          
          if (!customers || customers.length === 0) {
            hasMorePages = false
            console.log('No more customers to fetch')
          } else {
            allCustomers.push(...customers)
            console.log(`Fetched ${customers.length} customers (Total: ${allCustomers.length})`)
            
            // Check if we got a full page, if not, we're done
            if (customers.length < params.limit) {
              hasMorePages = false
            } else {
              // Use the last customer's ID for pagination
              pageInfo = customers[customers.length - 1].id
              // Small delay to respect API rate limits
              await new Promise(resolve => setTimeout(resolve, 500))
            }
          }
        } catch (pageError) {
          console.error(`Error fetching customer page:`, pageError)
          hasMorePages = false
        }
      }
      
      console.log(`Total customers fetched: ${allCustomers.length}`)
      
      // Process all customers
      let processed = 0
      for (const customer of allCustomers) {
        try {
          await this.upsertCustomer(customer)
          processed++
          
          // Log progress every 50 customers
          if (processed % 50 === 0) {
            console.log(`Processed ${processed}/${allCustomers.length} customers`)
          }
        } catch (error) {
          console.error(`Error processing customer ${customer.id}:`, error)
        }
      }
      
      // Update last sync time
      await this.updateLastSyncTime('customers')
      
      console.log(`Customer sync completed: ${processed} customers processed`)
      return processed
    } catch (error) {
      console.error('Error syncing customers:', error)
      throw error
    }
  }

  async syncOrders(limit = 250) {
    try {
      console.log(`[SYNC] Starting order sync for tenant ${this.tenantId}`)
      const syncStartTime = Date.now()
      
      // Get the last sync time for orders
      const lastSync = await this.getLastSyncTime('orders')
      
      const params: any = { 
        limit: Math.min(limit, 250), // Shopify API limit is 250
        status: 'any'
      }
      
      // For incremental sync, use last sync time
      if (lastSync) {
        params.updated_at_min = lastSync.toISOString()
        console.log(`[SYNC] Incremental order sync since: ${lastSync.toISOString()}`)
      } else {
        console.log('[SYNC] Full order sync - fetching ALL orders from store history')
      }
      
      let allOrders = []
      let hasMorePages = true
      let pageInfo = null
      let pageCount = 0
      
      // Fetch all pages using proper pagination
      while (hasMorePages && allOrders.length < 5000) { // Safety limit
        try {
          pageCount++
          const pageParams = { ...params }
          if (pageInfo) {
            pageParams.page_info = pageInfo
          }
          
          console.log(`[SYNC] Fetching orders page ${pageCount}...`)
          const data = await this.makeShopifyRequest('orders.json', pageParams)
          const orders = data.orders || []
          
          if (!orders || orders.length === 0) {
            hasMorePages = false
            console.log('[SYNC] No more orders to fetch')
          } else {
            allOrders.push(...orders)
            console.log(`[SYNC] Fetched ${orders.length} orders (Total: ${allOrders.length})`)
            
            // Check if we got a full page, if not, we're done
            if (orders.length < params.limit) {
              hasMorePages = false
            } else {
              // Use the last order's ID for pagination
              pageInfo = orders[orders.length - 1].id
              // Small delay to respect API rate limits
              await new Promise(resolve => setTimeout(resolve, 500))
            }
          }
        } catch (pageError) {
          console.error(`[SYNC ERROR] Error fetching order page ${pageCount}:`, pageError)
          hasMorePages = false
        }
      }
      
      console.log(`[SYNC] Total orders fetched: ${allOrders.length}`)
      
      // Process all orders
      let processed = 0
      for (const order of allOrders) {
        try {
          await this.upsertOrder(order)
          processed++
          
          // Log progress every 50 orders
          if (processed % 50 === 0) {
            console.log(`[SYNC] Processed ${processed}/${allOrders.length} orders`)
          }
        } catch (error) {
          console.error(`[SYNC ERROR] Error processing order ${order.id}:`, error)
        }
      }
      
      // Update last sync time
      await this.updateLastSyncTime('orders')
      
      const totalTime = Date.now() - syncStartTime
      console.log(`[SYNC COMPLETE] Order sync completed: ${processed} orders processed in ${totalTime}ms`)
      return processed
    } catch (error) {
      console.error('[SYNC ERROR] Error syncing orders:', error)
      throw error
    }
  }

  async syncProducts(limit = 250) {
    try {
      console.log(`Starting product sync for tenant ${this.tenantId}`)
      
      // Get the last sync time for products
      const lastSync = await this.getLastSyncTime('products')
      
      const params: any = { 
        limit: Math.min(limit, 250) // Shopify API limit is 250
      }
      
      if (lastSync) {
        params.updated_at_min = lastSync.toISOString()
        console.log(`Incremental product sync since: ${lastSync.toISOString()}`)
      } else {
        console.log('Full product sync - fetching ALL products from store')
      }
      
      let allProducts = []
      let hasMorePages = true
      let pageInfo = null
      
      // Fetch all pages using proper pagination
      while (hasMorePages && allProducts.length < 5000) { // Safety limit
        try {
          const pageParams = { ...params }
          if (pageInfo) {
            pageParams.page_info = pageInfo
          }
          
          console.log(`Fetching products page...`)
          const data = await this.makeShopifyRequest('products.json', pageParams)
          const products = data.products || []
          
          if (!products || products.length === 0) {
            hasMorePages = false
            console.log('No more products to fetch')
          } else {
            allProducts.push(...products)
            console.log(`Fetched ${products.length} products (Total: ${allProducts.length})`)
            
            // Check if we got a full page, if not, we're done
            if (products.length < params.limit) {
              hasMorePages = false
            } else {
              // Use the last product's ID for pagination
              pageInfo = products[products.length - 1].id
              // Small delay to respect API rate limits
              await new Promise(resolve => setTimeout(resolve, 500))
            }
          }
        } catch (pageError) {
          console.error(`Error fetching product page:`, pageError)
          hasMorePages = false
        }
      }
      
      console.log(`Total products fetched: ${allProducts.length}`)
      
      // Process all products
      let processed = 0
      for (const product of allProducts) {
        try {
          await this.upsertProduct(product)
          processed++
          
          // Log progress every 50 products
          if (processed % 50 === 0) {
            console.log(`Processed ${processed}/${allProducts.length} products`)
          }
        } catch (error) {
          console.error(`Error processing product ${product.id}:`, error)
        }
      }
      
      // Update last sync time
      await this.updateLastSyncTime('products')
      
      console.log(`Product sync completed: ${processed} products processed`)
      return processed
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

  // Reset sync time to force full sync
  async resetSyncTime(syncType: string): Promise<void> {
    try {
      await prisma.syncLog.deleteMany({
        where: {
          tenantId: this.tenantId,
          syncType
        }
      })
      console.log(`Reset sync time for ${syncType} - next sync will be full`)
    } catch (error) {
      console.error(`Error resetting sync time for ${syncType}:`, error)
    }
  }

  // Force sync methods that reset sync times first
  async forceSyncOrders(limit = 250): Promise<number> {
    await this.resetSyncTime('orders')
    return this.syncOrders(limit)
  }

  async forceSyncCustomers(limit = 250): Promise<number> {
    await this.resetSyncTime('customers')
    return this.syncCustomers(limit)
  }

  async forceSyncProducts(limit = 250): Promise<number> {
    await this.resetSyncTime('products')
    return this.syncProducts(limit)
  }

  // Batch sync methods for better performance
  async syncCustomersBatch(customerIds: string[]) {
    const results: any[] = []
    
    // This is a placeholder - batch sync is not needed for the current implementation
    console.log('Batch sync not implemented - use regular sync instead')
    
    return results
  }

  async syncOrdersBatch(orderIds: string[]) {
    const results: any[] = []
    
    // This is a placeholder - batch sync is not needed for the current implementation
    console.log('Batch sync not implemented - use regular sync instead')
    
    return results
  }

  // Advanced sync methods with filtering
  async syncRecentOrders(hours: number = 24) {
    // This is a placeholder - recent sync is handled by the main sync methods
    console.log('Recent sync not implemented - use regular sync instead')
    return 0
  }

  async syncOrdersByStatus(status: string) {
    // This is a placeholder - status filtering is handled by the main sync methods
    console.log('Status-based sync not implemented - use regular sync instead')
    return 0
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

      return {
        deletedLogs: deletedLogs.count
      }
    } catch (error) {
      console.error('Error cleaning up old records:', error)
      throw error
    }
  }

  // Force sync method - resets sync times to fetch all historical data
  async resetSyncTimes() {
    try {
      await prisma.syncLog.deleteMany({
        where: {
          tenantId: this.tenantId
        }
      })
      console.log(`Reset sync times for tenant ${this.tenantId}`)
    } catch (error) {
      console.error('Error resetting sync times:', error)
      throw error
    }
  }
}