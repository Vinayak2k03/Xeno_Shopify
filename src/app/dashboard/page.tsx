'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MetricCard } from '@/components/dashboard/metric-card'
import { OrdersByDateChart } from '@/components/dashboard/orders-chart'
import { TopCustomers } from '@/components/dashboard/top-customers'

interface Tenant {
  id: string
  name: string
  shopifyDomain: string
  isActive: boolean
}

interface DashboardMetrics {
  totalCustomers: number
  totalOrders: number
  totalRevenue: number
  customersThisMonth: number
  ordersThisMonth: number
  revenueThisMonth: number
  ordersByDate: Array<{
    date: string
    orders: number
    revenue: number
  }>
  topCustomers: Array<{
    id: string
    name: string
    email: string
    totalSpent: number
    ordersCount: number
  }>
}

export default function Dashboard() {
  const { user, loading: authLoading, signOut } = useAuth()
  const router = useRouter()
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [selectedTenant, setSelectedTenant] = useState<string>('')
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.push('/auth/signin')
      return
    }
    fetchTenants()
  }, [user, authLoading])

  useEffect(() => {
    if (selectedTenant) {
      fetchMetrics()
    }
  }, [selectedTenant])

  const fetchTenants = async () => {
    try {
      const response = await api.get('/api/tenants')
      if (response.ok) {
        const data = await response.json()
        setTenants(data)
        if (data.length > 0) {
          setSelectedTenant(data[0].id)
        }
      } else {
        console.error('Failed to fetch tenants:', await response.text())
      }
    } catch (error) {
      console.error('Error fetching tenants:', error)
    }
  }

  const fetchMetrics = async () => {
    if (!selectedTenant) return
    
    setLoading(true)
    try {
      const response = await api.get(`/api/dashboard/metrics?tenantId=${selectedTenant}`)
      if (response.ok) {
        const data = await response.json()
        setMetrics(data)
      } else {
        console.error('Failed to fetch metrics:', await response.text())
      }
    } catch (error) {
      console.error('Error fetching metrics:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSync = async () => {
    if (!selectedTenant) return
    
    setSyncing(true)
    try {
      const response = await api.post('/api/sync', { tenantId: selectedTenant })
      
      if (response.ok) {
        // Refresh metrics after sync
        await fetchMetrics()
        alert('Sync completed successfully!')
      } else {
        const error = await response.json()
        alert(`Sync failed: ${error.error}`)
      }
    } catch (error) {
      console.error('Error syncing:', error)
      alert('Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  if (authLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  if (!user) {
    return null
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="border-b">
        <div className="flex h-16 items-center px-4">
          <div className="flex items-center space-x-4 flex-1">
            <h1 className="text-xl font-semibold">Xeno Shopify Dashboard</h1>
            {tenants.length > 0 && (
              <select
                value={selectedTenant}
                onChange={(e) => setSelectedTenant(e.target.value)}
                className="border rounded-md px-3 py-1"
              >
                {tenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name} ({tenant.shopifyDomain})
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="flex items-center space-x-4">
            <Button 
              onClick={handleSync} 
              disabled={!selectedTenant || syncing}
              variant="outline"
            >
              {syncing ? 'Syncing...' : 'Sync Data'}
            </Button>
            <Button onClick={() => router.push('/tenants/new')} variant="outline">
              Add Store
            </Button>
            <Button onClick={() => signOut()} variant="outline">
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 space-y-4">
        {tenants.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No Tenants Found</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Please create a tenant first by setting up your Shopify store configuration.</p>
              <Button className="mt-4" onClick={() => router.push('/tenants/new')}>
                Add Tenant
              </Button>
            </CardContent>
          </Card>
        ) : loading ? (
          <div className="flex items-center justify-center py-8">
            <div>Loading dashboard...</div>
          </div>
        ) : metrics ? (
          <>
            {/* Metrics Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                title="Total Customers"
                value={metrics.totalCustomers.toLocaleString()}
                description={`+${metrics.customersThisMonth} this month`}
              />
              <MetricCard
                title="Total Orders"
                value={metrics.totalOrders.toLocaleString()}
                description={`+${metrics.ordersThisMonth} this month`}
              />
              <MetricCard
                title="Total Revenue"
                value={`$${metrics.totalRevenue.toFixed(2)}`}
                description={`+$${metrics.revenueThisMonth.toFixed(2)} this month`}
              />
              <MetricCard
                title="Avg Order Value"
                value={`$${metrics.totalOrders > 0 ? (metrics.totalRevenue / metrics.totalOrders).toFixed(2) : '0.00'}`}
                description="All time average"
              />
            </div>

            {/* Charts and Tables */}
            <div className="grid gap-4 md:grid-cols-7">
              <OrdersByDateChart data={metrics.ordersByDate} />
              <TopCustomers customers={metrics.topCustomers} />
            </div>
          </>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <p>No data available. Try syncing your Shopify data first.</p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}