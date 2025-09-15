"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/dashboard/metric-card";
import { OrdersByDateChart } from "@/components/dashboard/orders-chart";
import { TopCustomers } from "@/components/dashboard/top-customers";
import { TopProducts } from "@/components/dashboard/top-products";
import { RevenueTrends } from "@/components/dashboard/revenue-trends";
import { DateRangeFilter } from "@/components/dashboard/date-range-filter";
import { CustomEventsSummary } from "@/components/dashboard/custom-events-summary";
import { SyncManager } from "@/components/dashboard/sync-manager";
import { WebhookManager } from "@/components/dashboard/webhook-manager";
import { cn } from "@/lib/utils";

// Import wireframe components
import { 
  DashboardWireframe, 
  WelcomeCardWireframe, 
  AuthLoadingWireframe,
  SyncLoadingWireframe,
  NoDataWireframe
} from "@/components/dashboard/loading-states";

interface Tenant {
  id: string;
  name: string;
  shopifyDomain: string;
  isActive: boolean;
}

interface DashboardMetrics {
  totalCustomers: number;
  totalOrders: number;
  totalRevenue: number;
  customersThisMonth: number;
  ordersThisMonth: number;
  revenueThisMonth: number;
  ordersByDate: Array<{
    date: string;
    orders: number;
    revenue: number;
  }>;
  topCustomers: Array<{
    id: string;
    name: string;
    email: string;
    totalSpent: number;
    ordersCount: number;
  }>;
  topProducts: Array<{
    id: string;
    title: string;
    revenue: number;
    unitsSold: number;
    averagePrice: number;
  }>;
  revenueTrends: Array<{
    date: string;
    revenue: number;
    orders: number;
    customers: number;
    averageOrderValue: number;
  }>;
  customEvents: {
    cartCreated: number;
    cartAbandoned: number;
    checkoutStarted: number;
    totalAbandonedValue: number;
    abandonmentRate: string;
  };
}

export default function Dashboard() {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<string>("");
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [tenantsLoading, setTenantsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'analytics' | 'sync'>('analytics');
  
  // Use a ref to prevent multiple simultaneous API calls
  const fetchingRef = useRef(false);
  
  // Initialize with default date range (last 30 days)
  const getDefaultDates = () => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 30);
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    };
  };

  const [startDate, setStartDate] = useState(() => getDefaultDates().start);
  const [endDate, setEndDate] = useState(() => getDefaultDates().end);

  // Memoize the date range to prevent unnecessary re-renders
  const dateRange = useMemo(() => ({ start: startDate, end: endDate }), [startDate, endDate]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/auth/signin");
      return;
    }
    fetchTenants();
  }, [user, authLoading, router]);

  // Clear metrics when tenant changes to show loading state immediately
  useEffect(() => {
    if (selectedTenant) {
      setMetrics(null); // Clear previous metrics to show loading state
    }
  }, [selectedTenant]);

  // Use refs to track the last fetched parameters to avoid unnecessary refetches
  const lastFetchParamsRef = useRef<{tenantId: string, startDate: string, endDate: string} | null>(null);

  const fetchMetrics = useCallback(async (forceRefetch = false) => {
    if (!selectedTenant) return;

    // Check if we already have data for these exact parameters
    const currentParams = { tenantId: selectedTenant, startDate, endDate };
    if (!forceRefetch && lastFetchParamsRef.current && 
        lastFetchParamsRef.current.tenantId === currentParams.tenantId &&
        lastFetchParamsRef.current.startDate === currentParams.startDate &&
        lastFetchParamsRef.current.endDate === currentParams.endDate) {
      console.log('Skipping fetch - data already loaded for these parameters:', currentParams);
      return;
    }

    if (fetchingRef.current) {
      console.log('Skipping fetch - already in progress');
      return;
    }

    fetchingRef.current = true;
    setLoading(true);
    
    try {
      let url = `/api/dashboard/metrics?tenantId=${selectedTenant}`;
      if (startDate && endDate) {
        url += `&startDate=${startDate}&endDate=${endDate}`;
      }
      
      console.log('Fetching metrics:', currentParams);
      
      const response = await api.get(url);
      if (response.ok) {
        const data = await response.json();
        setMetrics(data);
        lastFetchParamsRef.current = currentParams; // Cache the successful fetch parameters
        console.log('Metrics fetched successfully');
      } else {
        console.error("Failed to fetch metrics:", await response.text());
      }
    } catch (error) {
      console.error("Error fetching metrics:", error);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [selectedTenant, startDate, endDate]);

  // Single useEffect to handle metrics fetching with proper debouncing and caching
  useEffect(() => {
    if (!selectedTenant) return;

    // Clear cache when tenant changes
    if (lastFetchParamsRef.current && lastFetchParamsRef.current.tenantId !== selectedTenant) {
      lastFetchParamsRef.current = null;
      console.log('Tenant changed, clearing cache');
    }

    // Debounce the fetch to prevent rapid successive calls
    const timeoutId = setTimeout(() => {
      fetchMetrics();
    }, 300);
    
    return () => clearTimeout(timeoutId);
  }, [selectedTenant, startDate, endDate]); // Only depend on the actual data parameters

  const fetchTenants = async () => {
    setTenantsLoading(true);
    try {
      const response = await api.get("/api/tenants");
      if (response.ok) {
        const data = await response.json();
        setTenants(data);
        if (data.length > 0) {
          setSelectedTenant(data[0].id);
        }
      } else {
        console.error("Failed to fetch tenants:", await response.text());
      }
    } catch (error) {
      console.error("Error fetching tenants:", error);
    } finally {
      setTenantsLoading(false);
    }
  };

  const handleSync = async () => {
    if (!selectedTenant) return;

    setSyncing(true);
    try {
      const response = await api.post("/api/sync", {
        tenantId: selectedTenant,
      });

      if (response.ok) {
        await fetchMetrics(true); // Force refresh after sync
        alert("Sync completed successfully!");
      } else {
        const error = await response.json();
        alert(`Sync failed: ${error.error}`);
      }
    } catch (error) {
      console.error("Error syncing:", error);
      alert("Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const handleDateRangeChange = useCallback((start: string, end: string) => {
    console.log('Date range changed:', { start, end });
    setStartDate(start);
    setEndDate(end);
  }, []);

  // Show auth loading wireframe
  if (authLoading) {
    return <AuthLoadingWireframe />;
  }

  if (!user) {
    return null;
  }

  // Show dashboard loading wireframe while fetching tenants
  if (tenantsLoading) {
    return <DashboardWireframe />;
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Sync loading overlay */}
      {syncing && <SyncLoadingWireframe />}

      {/* Enhanced Header */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-xl">
        <div className="flex h-16 items-center px-6">
          <div className="flex items-center space-x-6 flex-1">
            <div className="flex items-center space-x-3">
              <div className="h-8 w-8 bg-gradient-primary rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">X</span>
              </div>
              <h1 className="text-xl font-semibold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
                Xeno Shopify Dashboard
              </h1>
            </div>
            
            {tenants.length > 0 && (
              <select
                value={selectedTenant}
                onChange={(e) => setSelectedTenant(e.target.value)}
                className={cn(
                  "border border-border rounded-xl px-4 py-2 bg-background",
                  "focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent",
                  "transition-all duration-200"
                )}
              >
                {tenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name} ({tenant.shopifyDomain})
                  </option>
                ))}
              </select>
            )}
          </div>
          
          <div className="flex items-center space-x-3">
            <Button 
              onClick={handleSync} 
              disabled={!selectedTenant || syncing}
              variant="outline"
              loading={syncing}
              size="sm"
            >
              Sync Data
            </Button>
            <Button 
              onClick={() => router.push('/tenants/new')} 
              variant="outline"
              size="sm"
            >
              Add Store
            </Button>
            <Button 
              onClick={() => signOut()} 
              variant="ghost"
              size="sm"
            >
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Enhanced Main Content */}
      <main className="flex-1 p-6 space-y-8 animate-fade-in">
        {tenants.length === 0 ? (
          <WelcomeCardWireframe />
        ) : (
          <>
            {/* Tab Navigation */}
            <div className="flex space-x-1 bg-muted p-1 rounded-lg w-fit">
              <button
                onClick={() => setActiveTab('analytics')}
                className={cn(
                  "px-4 py-2 rounded-md text-sm font-medium transition-all duration-200",
                  activeTab === 'analytics'
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Analytics Dashboard
              </button>
              <button
                onClick={() => setActiveTab('sync')}
                className={cn(
                  "px-4 py-2 rounded-md text-sm font-medium transition-all duration-200",
                  activeTab === 'sync'
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Sync Management
              </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'analytics' ? (
              loading ? (
                <DashboardWireframe />
              ) : metrics ? (
                <>
                  {/* Date Range Filter */}
                  <DateRangeFilter 
                    onDateRangeChange={handleDateRangeChange}
                    initialStartDate={startDate}
                    initialEndDate={endDate}
                  />

                  {/* Enhanced Metrics Cards */}
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                    <MetricCard
                      title="Total Customers"
                      value={metrics.totalCustomers.toLocaleString()}
                      description={`+${metrics.customersThisMonth} this month`}
                      trend={{
                        value: metrics.customersThisMonth > 0 ? 
                          ((metrics.customersThisMonth / Math.max(metrics.totalCustomers - metrics.customersThisMonth, 1)) * 100) : 0,
                        isPositive: metrics.customersThisMonth > 0
                      }}
                      icon={
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      }
                      gradient={true}
                    />
                    <MetricCard
                      title="Total Orders"
                      value={metrics.totalOrders.toLocaleString()}
                      description={`+${metrics.ordersThisMonth} this month`}
                      trend={{
                        value: metrics.ordersThisMonth > 0 ? 
                          ((metrics.ordersThisMonth / Math.max(metrics.totalOrders - metrics.ordersThisMonth, 1)) * 100) : 0,
                        isPositive: metrics.ordersThisMonth > 0
                      }}
                      icon={
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                        </svg>
                      }
                    />
                    <MetricCard
                      title="Total Revenue"
                      value={`₹${metrics.totalRevenue.toFixed(2)}`}
                      description={`+₹${metrics.revenueThisMonth.toFixed(2)} this month`}
                      trend={{
                        value: metrics.revenueThisMonth > 0 ? 
                          ((metrics.revenueThisMonth / Math.max(metrics.totalRevenue - metrics.revenueThisMonth, 1)) * 100) : 0,
                        isPositive: metrics.revenueThisMonth > 0
                      }}
                      icon={
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                        </svg>
                      }
                    />
                    <MetricCard
                      title="Avg Order Value"
                      value={`₹${metrics.totalOrders > 0 ? (metrics.totalRevenue / metrics.totalOrders).toFixed(2) : '0.00'}`}
                      description="All time average"
                      icon={
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      }
                    />
                  </div>

                  {/* Revenue Trends */}
                  <RevenueTrends data={metrics.revenueTrends || []} />

                  {/* Charts and Tables */}
                  <div className="grid gap-6 md:grid-cols-12">
                    <OrdersByDateChart data={metrics.ordersByDate} className="md:col-span-8" />
                    <TopCustomers customers={metrics.topCustomers} className="md:col-span-4" />
                  </div>

                  {/* Top Products */}
                  <TopProducts products={metrics.topProducts || []} />

                  {/* Custom Events */}
                  <CustomEventsSummary data={metrics.customEvents} />
                </>
              ) : (
                <NoDataWireframe />
              )
            ) : (
              /* Sync Management Tab */
              <div className="space-y-6">
                <div className="grid gap-6 lg:grid-cols-2">
                  <SyncManager 
                    tenantId={selectedTenant}
                    onSyncComplete={() => {
                      // Refresh analytics data if we're on analytics tab
                      if (activeTab === 'analytics') {
                        fetchMetrics(true);
                      }
                    }}
                  />
                  <WebhookManager tenantId={selectedTenant} />
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}