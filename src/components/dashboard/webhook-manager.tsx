'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { 
  Webhook, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  RefreshCw,
  Settings,
  Plus,
  Trash2
} from 'lucide-react'

interface WebhookData {
  tenantId: string
  tenantName: string
  totalWebhooks: number
  ourWebhooks: number
  webhooks: Array<{
    id: string
    topic: string
    address: string
    createdAt: string
    updatedAt: string
  }>
}

interface WebhookManagerProps {
  tenantId: string
  className?: string
}

export function WebhookManager({ tenantId, className }: WebhookManagerProps) {
  const [webhookData, setWebhookData] = useState<WebhookData | null>(null)
  const [loading, setLoading] = useState(true)
  const [managing, setManaging] = useState(false)

  const fetchWebhookStatus = async () => {
    if (!tenantId) {
      setLoading(false)
      return
    }
    
    try {
      const response = await fetch(`/api/webhooks?tenantId=${tenantId}`, {
        credentials: 'include'
      })
      
      if (response.ok) {
        const data = await response.json()
        setWebhookData(data)
      } else {
        const errorText = await response.text()
        console.error('Failed to fetch webhook status:', response.status, errorText)
      }
    } catch (error) {
      console.error('Error fetching webhook status:', error)
    } finally {
      setLoading(false)
    }
  }

  const manageWebhooks = async (action: 'register' | 'unregister' | 'update') => {
    setManaging(true)
    try {
      const response = await fetch('/api/webhooks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          tenantId,
          action
        })
      })

      const result = await response.json()
      
      if (response.ok) {
        console.log(`Webhook ${action} completed:`, result)
        // Refresh status after action
        setTimeout(fetchWebhookStatus, 2000)
      } else {
        console.error(`Webhook ${action} failed:`, result.error)
      }
    } catch (error) {
      console.error(`Webhook ${action} error:`, error)
    } finally {
      setManaging(false)
    }
  }

  useEffect(() => {
    fetchWebhookStatus()
  }, [tenantId])

  if (!tenantId) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="w-5 h-5" />
            Webhook Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            <Settings className="w-8 h-8 mx-auto mb-2" />
            <p>Please select a tenant to manage webhooks</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="w-5 h-5" />
            Webhook Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!webhookData) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">
            <AlertCircle className="w-8 h-8 mx-auto mb-2" />
            <p>Unable to load webhook data</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const getWebhookHealth = () => {
    if (webhookData.ourWebhooks === 0) {
      return {
        status: 'setup_required',
        message: 'No webhooks registered',
        color: 'text-yellow-600',
        bg: 'bg-yellow-100',
        icon: <AlertCircle className="w-4 h-4" />
      }
    } else if (webhookData.ourWebhooks >= 8) { // Expected minimum webhooks
      return {
        status: 'healthy',
        message: 'All webhooks active',
        color: 'text-green-600',
        bg: 'bg-green-100',
        icon: <CheckCircle className="w-4 h-4" />
      }
    } else {
      return {
        status: 'partial',
        message: 'Some webhooks missing',
        color: 'text-orange-600',
        bg: 'bg-orange-100',
        icon: <AlertCircle className="w-4 h-4" />
      }
    }
  }

  const webhookHealth = getWebhookHealth()

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getTopicBadgeColor = (topic: string) => {
    if (topic.includes('order')) return 'bg-blue-100 text-blue-800'
    if (topic.includes('customer')) return 'bg-green-100 text-green-800'
    if (topic.includes('product')) return 'bg-purple-100 text-purple-800'
    if (topic.includes('cart')) return 'bg-yellow-100 text-yellow-800'
    if (topic.includes('checkout')) return 'bg-orange-100 text-orange-800'
    return 'bg-gray-100 text-gray-800'
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Webhook className="w-5 h-5" />
            Webhook Management
            <Badge variant="outline">{webhookData.tenantName}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchWebhookStatus}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status Overview */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">Total Webhooks</div>
            <div className="text-2xl font-bold">{webhookData.totalWebhooks}</div>
          </div>
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">Our Webhooks</div>
            <div className="text-2xl font-bold text-blue-600">{webhookData.ourWebhooks}</div>
          </div>
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">Health Status</div>
            <div className={`flex items-center gap-2 ${webhookHealth.color}`}>
              {webhookHealth.icon}
              <span className="font-medium">{webhookHealth.message}</span>
            </div>
          </div>
        </div>

        {/* Health Alert */}
        <div className={`p-4 rounded-lg border ${webhookHealth.bg}`}>
          <div className="flex items-center gap-3">
            <div className={webhookHealth.color}>
              {webhookHealth.icon}
            </div>
            <div>
              <div className="font-medium">
                {webhookHealth.status === 'setup_required' && 'Webhook Setup Required'}
                {webhookHealth.status === 'partial' && 'Incomplete Webhook Setup'}
                {webhookHealth.status === 'healthy' && 'Webhooks Operating Normally'}
              </div>
              <div className="text-sm text-muted-foreground">
                {webhookHealth.status === 'setup_required' && 
                  'Register webhooks to enable real-time data synchronization from Shopify.'}
                {webhookHealth.status === 'partial' && 
                  'Some webhooks are missing. Consider updating to ensure complete coverage.'}
                {webhookHealth.status === 'healthy' && 
                  'All necessary webhooks are registered and functioning properly.'}
              </div>
            </div>
          </div>
        </div>

        {/* Webhook Actions */}
        <div className="space-y-3">
          <div className="text-sm font-medium">Webhook Actions</div>
          <div className="grid gap-3 md:grid-cols-3">
            <Button
              onClick={() => manageWebhooks('register')}
              disabled={managing}
              className="justify-start"
            >
              {managing ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              Register Webhooks
            </Button>
            <Button
              variant="outline"
              onClick={() => manageWebhooks('update')}
              disabled={managing}
              className="justify-start"
            >
              {managing ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Settings className="w-4 h-4 mr-2" />
              )}
              Update Webhooks
            </Button>
            <Button
              variant="outline"
              onClick={() => manageWebhooks('unregister')}
              disabled={managing}
              className="justify-start text-red-600 hover:text-red-700"
            >
              {managing ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Remove Webhooks
            </Button>
          </div>
        </div>

        {/* Active Webhooks List */}
        {webhookData.webhooks.length > 0 && (
          <div className="space-y-3">
            <div className="text-sm font-medium">Active Webhooks ({webhookData.ourWebhooks})</div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {webhookData.webhooks.map((webhook) => (
                <div key={webhook.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge className={getTopicBadgeColor(webhook.topic)}>
                          {webhook.topic}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        ID: {webhook.id}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">
                      Created: {formatDate(webhook.createdAt)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Updated: {formatDate(webhook.updatedAt)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {webhookData.ourWebhooks === 0 && (
          <div className="text-center py-8">
            <Webhook className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <h3 className="text-lg font-medium mb-2">No Webhooks Registered</h3>
            <p className="text-muted-foreground mb-4">
              Register webhooks to enable real-time data synchronization from your Shopify store.
            </p>
            <Button onClick={() => manageWebhooks('register')} disabled={managing}>
              {managing ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              Register Webhooks
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}