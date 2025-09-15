import { prisma } from '@/lib/db'
import { ShopifyService } from '@/services/shopify'

interface WebhookRegistrationResult {
  tenantId: string
  tenantName: string
  success: boolean
  webhooks: Array<{
    topic: string
    status: 'created' | 'exists' | 'failed' | 'deleted'
    id?: string | number
    error?: string
  }>
  error?: string
}

export class WebhookManager {
  private baseUrl: string

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || process.env.WEBHOOK_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000'
    console.log(`🌐 Webhook Manager initialized with baseUrl: ${this.baseUrl}`)
  }

  async registerWebhooksForAllTenants(): Promise<WebhookRegistrationResult[]> {
    const results: WebhookRegistrationResult[] = []

    try {
      const tenants = await prisma.tenant.findMany({
        where: {
          isActive: true,
          shopifyAccessToken: {
            not: null
          }
        }
      })

      console.log(`Registering webhooks for ${tenants.length} tenants`)

      for (const tenant of tenants) {
        try {
          const result = await this.registerWebhooksForTenant(tenant.id)
          results.push(result)
        } catch (error) {
          console.error(`Failed to register webhooks for tenant ${tenant.name}:`, error)
          results.push({
            tenantId: tenant.id,
            tenantName: tenant.name,
            success: false,
            webhooks: [],
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }
    } catch (error) {
      console.error('Error registering webhooks for all tenants:', error)
      throw error
    }

    return results
  }

  async registerWebhooksForTenant(tenantId: string): Promise<WebhookRegistrationResult> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId }
    })

    if (!tenant || !tenant.shopifyAccessToken) {
      throw new Error('Tenant not found or not configured')
    }

    try {
      const shopifyService = new ShopifyService({
        domain: tenant.shopifyDomain,
        accessToken: tenant.shopifyAccessToken,
        apiKey: tenant.apiKey || undefined,
        apiSecret: tenant.apiSecret || undefined,
        webhookSecret: tenant.webhookSecret || undefined
      }, tenant.id)

      const webhookResults = await shopifyService.registerWebhooks(this.baseUrl)

      // Log webhook registration
      await this.logWebhookRegistration(tenant.id, webhookResults)

      return {
        tenantId: tenant.id,
        tenantName: tenant.name,
        success: true,
        webhooks: webhookResults.map(r => ({
          topic: r.topic,
          status: r.status as 'created' | 'exists' | 'failed',
          id: r.id?.toString(),
          error: r.error
        }))
      }
    } catch (error) {
      console.error(`Error registering webhooks for tenant ${tenant.name}:`, error)
      return {
        tenantId: tenant.id,
        tenantName: tenant.name,
        success: false,
        webhooks: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  async unregisterWebhooksForTenant(tenantId: string): Promise<WebhookRegistrationResult> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId }
    })

    if (!tenant || !tenant.shopifyAccessToken) {
      throw new Error('Tenant not found or not configured')
    }

    try {
      const shopifyService = new ShopifyService({
        domain: tenant.shopifyDomain,
        accessToken: tenant.shopifyAccessToken,
        apiKey: tenant.apiKey || undefined,
        apiSecret: tenant.apiSecret || undefined,
        webhookSecret: tenant.webhookSecret || undefined
      }, tenant.id)

      const webhookResults = await shopifyService.unregisterWebhooks(this.baseUrl)

      return {
        tenantId: tenant.id,
        tenantName: tenant.name,
        success: true,
        webhooks: webhookResults.map(r => ({ ...r, status: 'deleted' as const }))
      }
    } catch (error) {
      console.error(`Error unregistering webhooks for tenant ${tenant.name}:`, error)
      return {
        tenantId: tenant.id,
        tenantName: tenant.name,
        success: false,
        webhooks: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  async updateWebhooksForTenant(tenantId: string): Promise<WebhookRegistrationResult> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId }
    })

    if (!tenant || !tenant.shopifyAccessToken) {
      throw new Error('Tenant not found or not configured')
    }

    try {
      const shopifyService = new ShopifyService({
        domain: tenant.shopifyDomain,
        accessToken: tenant.shopifyAccessToken,
        apiKey: tenant.apiKey || undefined,
        apiSecret: tenant.apiSecret || undefined,
        webhookSecret: tenant.webhookSecret || undefined
      }, tenant.id)

      const webhookResults = await shopifyService.updateWebhooks(this.baseUrl)

      // Log webhook update
      await this.logWebhookRegistration(tenant.id, webhookResults)

      return {
        tenantId: tenant.id,
        tenantName: tenant.name,
        success: true,
        webhooks: webhookResults.map(r => ({
          topic: r.topic,
          status: r.status as 'created' | 'exists' | 'failed' | 'deleted',
          id: r.id,
          error: r.error
        }))
      }
    } catch (error) {
      console.error(`Error updating webhooks for tenant ${tenant.name}:`, error)
      return {
        tenantId: tenant.id,
        tenantName: tenant.name,
        success: false,
        webhooks: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  async getWebhookStatusForTenant(tenantId: string) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId }
    })

    if (!tenant || !tenant.shopifyAccessToken) {
      throw new Error('Tenant not found or not configured')
    }

    try {
      const shopifyService = new ShopifyService({
        domain: tenant.shopifyDomain,
        accessToken: tenant.shopifyAccessToken,
        apiKey: tenant.apiKey || undefined,
        apiSecret: tenant.apiSecret || undefined,
        webhookSecret: tenant.webhookSecret || undefined
      }, tenant.id)

      const webhooks = await shopifyService.getWebhooks()
      const ourWebhooks = webhooks.filter((w: any) => 
        w.address && w.address.includes(this.baseUrl)
      )

      return {
        tenantId: tenant.id,
        tenantName: tenant.name,
        totalWebhooks: webhooks.length,
        ourWebhooks: ourWebhooks.length,
        webhooks: ourWebhooks.map((w: any) => ({
          id: w.id,
          topic: w.topic,
          address: w.address,
          createdAt: w.created_at,
          updatedAt: w.updated_at
        }))
      }
    } catch (error) {
      console.error(`Error getting webhook status for tenant ${tenant.name}:`, error)
      throw error
    }
  }

  private async logWebhookRegistration(tenantId: string, webhookResults: any[]) {
    try {
      for (const result of webhookResults) {
        await prisma.syncLog.create({
          data: {
            tenantId,
            syncType: `webhook_${result.topic.replace('/', '_')}`,
            success: result.status === 'created' || result.status === 'exists',
            recordsProcessed: 1,
            duration: 0,
            error: result.error || null,
            createdAt: new Date()
          }
        })
      }
    } catch (error) {
      console.error('Failed to log webhook registration:', error)
    }
  }

  // Auto-register webhooks when a new tenant is created
  async autoRegisterWebhooksForNewTenant(tenantId: string) {
    try {
      console.log(`Auto-registering webhooks for new tenant: ${tenantId}`)
      const result = await this.registerWebhooksForTenant(tenantId)
      
      if (result.success) {
        console.log(`Successfully auto-registered ${result.webhooks.length} webhooks for tenant ${tenantId}`)
      } else {
        console.error(`Failed to auto-register webhooks for tenant ${tenantId}:`, result.error)
      }

      return result
    } catch (error) {
      console.error(`Error auto-registering webhooks for tenant ${tenantId}:`, error)
      throw error
    }
  }

  // Validate webhook health by checking if they're still active
  async validateWebhookHealth(): Promise<{
    healthy: number
    unhealthy: number
    details: Array<{
      tenantId: string
      tenantName: string
      status: 'healthy' | 'unhealthy'
      webhookCount: number
      issues?: string[]
    }>
  }> {
    const tenants = await prisma.tenant.findMany({
      where: {
        isActive: true,
        shopifyAccessToken: { not: null }
      }
    })

    let healthy = 0
    let unhealthy = 0
    const details = []

    for (const tenant of tenants) {
      try {
        const status = await this.getWebhookStatusForTenant(tenant.id)
        const issues = []

        // Check if we have the minimum required webhooks
        const requiredTopics = [
          'orders/create', 'orders/updated', 'customers/create', 
          'customers/update', 'products/create', 'products/update'
        ]
        
        const activeTopics = status.webhooks.map((w: any) => w.topic)
        const missingTopics = requiredTopics.filter(topic => !activeTopics.includes(topic))

        if (missingTopics.length > 0) {
          issues.push(`Missing webhooks: ${missingTopics.join(', ')}`)
        }

        if (status.ourWebhooks === 0) {
          issues.push('No webhooks registered')
        }

        const isHealthy = issues.length === 0
        if (isHealthy) {
          healthy++
        } else {
          unhealthy++
        }

        details.push({
          tenantId: tenant.id,
          tenantName: tenant.name,
          status: isHealthy ? 'healthy' as const : 'unhealthy' as const,
          webhookCount: status.ourWebhooks,
          issues: issues.length > 0 ? issues : undefined
        })

      } catch (error) {
        unhealthy++
        details.push({
          tenantId: tenant.id,
          tenantName: tenant.name,
          status: 'unhealthy' as const,
          webhookCount: 0,
          issues: [`Error checking webhooks: ${error instanceof Error ? error.message : 'Unknown error'}`]
        })
      }
    }

    return { healthy, unhealthy, details }
  }
}

// Create a global instance
export const webhookManager = new WebhookManager()