'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { 
  RefreshCw, 
  Database, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Settings,
  Activity,
  BarChart3
} from 'lucide-react'

interface SyncStatus {
  lastSync: string | null
  success: boolean
  recordsProcessed: number
  duration: number
  error: string | null
  totalSyncs: number
  successRate: string
}

interface SyncData {
  tenantId: string
  tenantName: string
  lastActivity: string
  syncStatus: Record<string, SyncStatus>
  recentLogs: Array<{
    id: string
    type: string
    success: boolean
    recordsProcessed: number
    duration: number
    createdAt: string
    error: string | null
  }>
}

interface SyncManagerProps {
  tenantId: string
  className?: string
  onSyncComplete?: () => void
}

export function SyncManager({ tenantId, className, onSyncComplete }: SyncManagerProps) {
  const [syncData, setSyncData] = useState<SyncData | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [selectedTypes, setSelectedTypes] = useState(['orders', 'customers', 'products'])

  const fetchSyncStatus = async () => {
    try {
      const response = await fetch(`/api/sync?tenantId=${tenantId}`, {
        credentials: 'include'
      })
      
      if (response.ok) {
        const data = await response.json()
        setSyncData(data)
      } else {
        console.error('Failed to fetch sync status')
      }
    } catch (error) {
      console.error('Error fetching sync status:', error)
    } finally {
      setLoading(false)
    }
  }

  const triggerSync = async (types?: string[], force = false, historical = false) => {
    setSyncing(true)
    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          tenantId,
          types: types || selectedTypes,
          force,
          historical
        })
      })

      const result = await response.json()
      
      if (response.ok) {
        console.log('Sync completed:', result)
        // Refresh status after sync
        setTimeout(fetchSyncStatus, 1000)
        // Call the completion callback
        onSyncComplete?.()
      } else {
        console.error('Sync failed:', result.error)
      }
    } catch (error) {
      console.error('Sync error:', error)
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => {
    fetchSyncStatus()
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchSyncStatus, 30000)
    return () => clearInterval(interval)
  }, [tenantId])

  if (loading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              Sync Management
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
      </div>
    )
  }

  if (!syncData) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">
            <AlertCircle className="w-8 h-8 mx-auto mb-2" />
            <p>Unable to load sync data</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const getStatusIcon = (success: boolean) => {
    return success ? (
      <CheckCircle className="w-4 h-4 text-green-500" />
    ) : (
      <XCircle className="w-4 h-4 text-red-500" />
    )
  }

  const getStatusBadge = (success: boolean, successRate: string) => {
    if (success && parseFloat(successRate) >= 95) {
      return <Badge className="bg-green-100 text-green-800">Healthy</Badge>
    } else if (parseFloat(successRate) >= 80) {
      return <Badge className="bg-yellow-100 text-yellow-800">Warning</Badge>
    } else {
      return <Badge className="bg-red-100 text-red-800">Error</Badge>
    }
  }

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`
    return `${Math.floor(diffMins / 1440)}d ago`
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              Sync Management
              <Badge variant="outline">{syncData.tenantName}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchSyncStatus}
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                onClick={() => triggerSync(undefined, true)}
                disabled={syncing}
                size="sm"
              >
                {syncing ? (
                  <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Sync Now
              </Button>
              <Button
                variant="secondary"
                onClick={() => triggerSync(undefined, false, true)}
                disabled={syncing}
                size="sm"
              >
                {syncing ? (
                  <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Database className="w-4 h-4 mr-2" />
                )}
                Full Historical Sync
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            Last activity: {formatDate(syncData.lastActivity)}
          </div>
        </CardContent>
      </Card>

      {/* Sync Status Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Object.entries(syncData.syncStatus).map(([type, status]) => (
          <Card key={type}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="font-medium capitalize">{type}</div>
                {getStatusIcon(status.success)}
              </div>
              
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Records:</span>
                  <span>{status.recordsProcessed}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Duration:</span>
                  <span>{formatDuration(status.duration)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Success Rate:</span>
                  <span>{status.successRate}%</span>
                </div>
                {status.lastSync && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Last Sync:</span>
                    <span>{formatDate(status.lastSync)}</span>
                  </div>
                )}
              </div>

              <div className="mt-3 flex justify-between items-center">
                {getStatusBadge(status.success, status.successRate)}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => triggerSync([type])}
                  disabled={syncing}
                >
                  {syncing ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3 h-3" />
                  )}
                </Button>
              </div>

              {status.error && (
                <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-600">
                  {status.error}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Sync Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Recent Sync Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {syncData.recentLogs.length === 0 ? (
              <div className="text-center text-muted-foreground py-4">
                No recent sync activity
              </div>
            ) : (
              syncData.recentLogs.map((log) => (
                <div key={log.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(log.success)}
                    <div>
                      <div className="font-medium capitalize">{log.type}</div>
                      <div className="text-sm text-muted-foreground">
                        {log.recordsProcessed} records • {formatDuration(log.duration)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground">
                      {formatDate(log.createdAt)}
                    </div>
                    {log.error && (
                      <div className="text-xs text-red-500 max-w-32 truncate">
                        {log.error}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Quick sync options - Use &quot;Historical Sync&quot; if you&apos;re missing older data
            </div>
            
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <Button
                variant="outline"
                onClick={() => triggerSync(['orders'], true)}
                disabled={syncing}
                className="justify-start"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                Sync Orders
              </Button>
              <Button
                variant="outline"
                onClick={() => triggerSync(['customers'], true)}
                disabled={syncing}
                className="justify-start"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                Sync Customers
              </Button>
              <Button
                variant="outline"
                onClick={() => triggerSync(['products'], true)}
                disabled={syncing}
                className="justify-start"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                Sync Products
              </Button>
              <Button
                variant="outline"
                onClick={() => triggerSync(undefined, true)}
                disabled={syncing}
                className="justify-start"
              >
                <Database className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                Full Sync
              </Button>
            </div>

            <div className="border-t pt-4">
              <div className="text-sm font-medium mb-2">Historical Data Sync</div>
              <div className="text-xs text-muted-foreground mb-3">
                Fetches data from the last 30 days. Use this if you&apos;re missing previous orders or customer data.
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Button
                  variant="secondary"
                  onClick={() => triggerSync(['orders'], false, true)}
                  disabled={syncing}
                  className="justify-start"
                >
                  <BarChart3 className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                  Historical Orders
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => triggerSync(undefined, false, true)}
                  disabled={syncing}
                  className="justify-start"
                >
                  <BarChart3 className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                  Full Historical Sync
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}