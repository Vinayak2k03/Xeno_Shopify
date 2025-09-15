import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import { webhookManager } from '@/lib/webhook-manager'
import { prisma } from '@/lib/db'

// GET /api/webhooks - Get webhook status for tenant
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const tenantId = searchParams.get('tenantId')

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 })
    }

    // Verify user owns the tenant
    const tenant = await prisma.tenant.findFirst({
      where: {
        id: tenantId,
        userId: user.id
      }
    })

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }

    const webhookStatus = await webhookManager.getWebhookStatusForTenant(tenantId)
    return NextResponse.json(webhookStatus)

  } catch (error) {
    console.error('Get webhook status error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 })
  }
}

// POST /api/webhooks - Register webhooks for tenant
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { tenantId, action } = body

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 })
    }

    if (!action || !['register', 'unregister', 'update'].includes(action)) {
      return NextResponse.json({ error: 'Valid action is required (register, unregister, update)' }, { status: 400 })
    }

    // Verify user owns the tenant
    const tenant = await prisma.tenant.findFirst({
      where: {
        id: tenantId,
        userId: user.id
      }
    })

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }

    let result
    switch (action) {
      case 'register':
        result = await webhookManager.registerWebhooksForTenant(tenantId)
        break
      case 'unregister':
        result = await webhookManager.unregisterWebhooksForTenant(tenantId)
        break
      case 'update':
        result = await webhookManager.updateWebhooksForTenant(tenantId)
        break
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('Webhook management error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 })
  }
}

// PUT /api/webhooks/health - Check webhook health for all tenants (admin only)
export async function PUT(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // For now, allow any authenticated user to check health
    // In production, you might want to add admin role checking
    
    const healthCheck = await webhookManager.validateWebhookHealth()
    return NextResponse.json(healthCheck)

  } catch (error) {
    console.error('Webhook health check error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 })
  }
}