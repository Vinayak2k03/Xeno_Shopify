import cron from 'node-cron'
import { prisma } from '@/lib/db'
import { ShopifyService } from '@/services/shopify'

// Different sync schedules for different types of data
const SCHEDULES = {
  // High priority data - every 15 minutes
  ORDERS: '*/15 * * * *',
  CUSTOMERS: '*/15 * * * *',
  
  // Medium priority - every 30 minutes  
  PRODUCTS: '*/30 * * * *',
  
  // Low priority - every hour
  ANALYTICS: '0 * * * *',
  
  // Cleanup old sync logs - daily at 2 AM
  CLEANUP: '0 2 * * *'
}

interface SyncOptions {
  force?: boolean
  types?: ('orders' | 'customers' | 'products' | 'analytics')[]
  tenantId?: string
}

interface SyncResult {
  success: boolean
  tenantId: string
  type: string
  recordsProcessed: number
  duration: number
  error?: string
}

export function startScheduler() {
  if (process.env.NODE_ENV === 'production') {
    console.log('Starting enhanced data sync scheduler...')
    
    // Schedule different sync types
    cron.schedule(SCHEDULES.ORDERS, () => scheduleSync('orders'))
    cron.schedule(SCHEDULES.CUSTOMERS, () => scheduleSync('customers'))
    cron.schedule(SCHEDULES.PRODUCTS, () => scheduleSync('products'))
    cron.schedule(SCHEDULES.ANALYTICS, () => scheduleSync('analytics'))
    cron.schedule(SCHEDULES.CLEANUP, () => cleanupSyncLogs())
    
    console.log('All schedulers started successfully')
  } else {
    console.log('Scheduler disabled in development mode')
  }
}

async function scheduleSync(type: string) {
  console.log(`Running scheduled ${type} sync...`)
  
  try {
    const results = await syncAllTenants({ types: [type as any] })
    console.log(`${type} sync completed:`, {
      totalTenants: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    })
  } catch (error) {
    console.error(`Error in scheduled ${type} sync:`, error)
  }
}

async function syncAllTenants(options: SyncOptions = {}): Promise<SyncResult[]> {
  const results: SyncResult[] = []
  
  try {
    const tenants = await prisma.tenant.findMany({
      where: {
        isActive: true,
        shopifyAccessToken: {
          not: null
        }
      }
    })

    console.log(`Found ${tenants.length} active tenants to sync`)

    // Process tenants in parallel but with rate limiting
    const batchSize = 3 // Process 3 tenants at a time to avoid overwhelming Shopify API
    
    for (let i = 0; i < tenants.length; i += batchSize) {
      const batch = tenants.slice(i, i + batchSize)
      
      const batchResults = await Promise.allSettled(
        batch.map(tenant => syncTenant(tenant, options))
      )
      
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(...result.value)
        } else {
          console.error(`Batch sync failed for tenant ${batch[index].name}:`, result.reason)
          results.push({
            success: false,
            tenantId: batch[index].id,
            type: 'batch_error',
            recordsProcessed: 0,
            duration: 0,
            error: result.reason.message
          })
        }
      })
      
      // Small delay between batches to be respectful to Shopify API
      if (i + batchSize < tenants.length) {
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }
  } catch (error) {
    console.error('Error in scheduled sync:', error)
    throw error
  }
  
  return results
}

async function syncTenant(tenant: any, options: SyncOptions = {}): Promise<SyncResult[]> {
  const results: SyncResult[] = []
  const startTime = Date.now()
  
  try {
    // Check if sync is needed (unless forced)
    if (!options.force && !await shouldSync(tenant.id, options.types || ['orders', 'customers', 'products'])) {
      console.log(`Skipping sync for tenant ${tenant.name} - recent sync exists`)
      return results
    }
    
    const shopifyService = new ShopifyService({
      domain: tenant.shopifyDomain,
      accessToken: tenant.shopifyAccessToken,
      apiKey: tenant.apiKey || undefined,
      apiSecret: tenant.apiSecret || undefined
    }, tenant.id)

    const syncTypes = options.types || ['orders', 'customers', 'products']
    
    // Execute syncs with retry logic
    for (const syncType of syncTypes) {
      const typeStartTime = Date.now()
      let recordsProcessed = 0
      
      try {
        switch (syncType) {
          case 'orders':
            if (options.force) {
              recordsProcessed = await retrySync(() => shopifyService.forceSyncOrders(100), 3)
            } else {
              recordsProcessed = await retrySync(() => shopifyService.syncOrders(100), 3)
            }
            break
          case 'customers':
            if (options.force) {
              recordsProcessed = await retrySync(() => shopifyService.forceSyncCustomers(100), 3)
            } else {
              recordsProcessed = await retrySync(() => shopifyService.syncCustomers(100), 3)
            }
            break
          case 'products':
            if (options.force) {
              recordsProcessed = await retrySync(() => shopifyService.forceSyncProducts(100), 3)
            } else {
              recordsProcessed = await retrySync(() => shopifyService.syncProducts(100), 3)
            }
            break
          case 'analytics':
            // Custom analytics sync logic would go here
            recordsProcessed = 0
            break
        }
        
        const duration = Date.now() - typeStartTime
        
        results.push({
          success: true,
          tenantId: tenant.id,
          type: syncType,
          recordsProcessed,
          duration,
        })
        
        // Log successful sync
        await logSyncResult(tenant.id, syncType, true, recordsProcessed, duration)
        
        console.log(`✓ Synced ${syncType} for ${tenant.name}: ${recordsProcessed} records in ${duration}ms`)
        
      } catch (error) {
        const duration = Date.now() - typeStartTime
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        
        results.push({
          success: false,
          tenantId: tenant.id,
          type: syncType,
          recordsProcessed: 0,
          duration,
          error: errorMessage
        })
        
        // Log failed sync
        await logSyncResult(tenant.id, syncType, false, 0, duration, errorMessage)
        
        console.error(`✗ Failed to sync ${syncType} for ${tenant.name}:`, errorMessage)
      }
      
      // Small delay between sync types to avoid rate limits
      if (syncTypes.indexOf(syncType) < syncTypes.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
    
  } catch (error) {
    console.error(`Error syncing tenant ${tenant.name}:`, error)
    throw error
  }
  
  return results
}

async function retrySync<T>(
  syncFn: () => Promise<T>, 
  maxRetries: number, 
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await syncFn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error')
      
      if (attempt === maxRetries) {
        throw lastError
      }
      
      // Exponential backoff
      const delay = baseDelay * Math.pow(2, attempt - 1)
      console.log(`Sync attempt ${attempt} failed, retrying in ${delay}ms...`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  throw lastError!
}

async function shouldSync(tenantId: string, types: string[]): Promise<boolean> {
  const minSyncInterval = 10 * 60 * 1000 // 10 minutes minimum between syncs
  
  for (const type of types) {
    const lastSync = await prisma.syncLog.findFirst({
      where: {
        tenantId,
        syncType: type,
        success: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })
    
    if (!lastSync || Date.now() - lastSync.createdAt.getTime() > minSyncInterval) {
      return true
    }
  }
  
  return false
}

async function logSyncResult(
  tenantId: string,
  syncType: string,
  success: boolean,
  recordsProcessed: number,
  duration: number,
  error?: string
) {
  try {
    await prisma.syncLog.create({
      data: {
        tenantId,
        syncType,
        success,
        recordsProcessed,
        duration,
        error,
        createdAt: new Date()
      }
    })
  } catch (error) {
    console.error('Failed to log sync result:', error)
  }
}

async function cleanupSyncLogs() {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    
    const deletedCount = await prisma.syncLog.deleteMany({
      where: {
        createdAt: {
          lt: thirtyDaysAgo
        }
      }
    })
    
    console.log(`Cleaned up ${deletedCount.count} old sync log entries`)
  } catch (error) {
    console.error('Error cleaning up sync logs:', error)
  }
}

// Manual sync endpoint for on-demand syncing
export async function syncTenantById(
  tenantId: string, 
  userId: string, 
  options: SyncOptions = {}
): Promise<SyncResult[]> {
  const tenant = await prisma.tenant.findFirst({
    where: {
      id: tenantId,
      userId,
      isActive: true
    }
  })

  if (!tenant || !tenant.shopifyAccessToken) {
    throw new Error('Tenant not found or not configured')
  }

  return await syncTenant(tenant, { ...options, force: true })
}