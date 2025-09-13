import cron from 'node-cron'
import { prisma } from '@/lib/db'
import { ShopifyService } from '@/services/shopify'

// Run every 30 minutes
const SYNC_SCHEDULE = '*/30 * * * *'

export function startScheduler() {
  if (process.env.NODE_ENV === 'production') {
    console.log('Starting data sync scheduler...')
    
    cron.schedule(SYNC_SCHEDULE, async () => {
      console.log('Running scheduled sync...')
      await syncAllTenants()
    })
  }
}

async function syncAllTenants() {
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

    for (const tenant of tenants) {
      try {
        await syncTenant(tenant)
        console.log(`Synced tenant: ${tenant.name}`)
      } catch (error) {
        console.error(`Error syncing tenant ${tenant.name}:`, error)
      }
    }
  } catch (error) {
    console.error('Error in scheduled sync:', error)
  }
}

async function syncTenant(tenant: any) {
  const shopifyService = new ShopifyService({
    domain: tenant.shopifyDomain,
    accessToken: tenant.shopifyAccessToken,
    apiKey: tenant.apiKey || undefined,
    apiSecret: tenant.apiSecret || undefined,
    webhookSecret: tenant.webhookSecret || undefined
  }, tenant.id)

  // Sync in smaller batches to avoid rate limits
  await Promise.all([
    shopifyService.syncCustomers(50),
    shopifyService.syncProducts(50),
    shopifyService.syncOrders(50)
  ])
}

// Manual sync endpoint for on-demand syncing
export async function syncTenantById(tenantId: string, userId: string) {
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

  await syncTenant(tenant)
}