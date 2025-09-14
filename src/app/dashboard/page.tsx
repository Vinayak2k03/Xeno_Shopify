"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/dashboard/metric-card";
import { OrdersByDateChart } from "@/components/dashboard/orders-chart";
import { TopCustomers } from "@/components/dashboard/top-customers";
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

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/auth/signin");
      return;
    }
    fetchTenants();
  }, [user, authLoading]);

  useEffect(() => {
    if (selectedTenant) {
      fetchMetrics();
    }
  }, [selectedTenant]);

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

  const fetchMetrics = async () => {
    if (!selectedTenant) return;

    setLoading(true);
    try {
      const response = await api.get(
        `/api/dashboard/metrics?tenantId=${selectedTenant}`
      );
      if (response.ok) {
        const data = await response.json();
        setMetrics(data);
      } else {
        console.error("Failed to fetch metrics:", await response.text());
      }
    } catch (error) {
      console.error("Error fetching metrics:", error);
    } finally {
      setLoading(false);
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
        // Refresh metrics after sync
        await fetchMetrics();
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
        ) : loading ? (
          <DashboardWireframe />
        ) : metrics ? (
          <>
            {/* Enhanced Metrics Cards */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                title="Total Customers"
                value={metrics.totalCustomers.toLocaleString()}
                description={`+${metrics.customersThisMonth} this month`}
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
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                }
              />
              <MetricCard
                title="Total Revenue"
                value={`$${metrics.totalRevenue.toFixed(2)}`}
                description={`+$${metrics.revenueThisMonth.toFixed(2)} this month`}
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                }
              />
              <MetricCard
                title="Avg Order Value"
                value={`$${metrics.totalOrders > 0 ? (metrics.totalRevenue / metrics.totalOrders).toFixed(2) : '0.00'}`}
                description="All time average"
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                }
              />
            </div>

            {/* Enhanced Charts and Tables */}
            <div className="grid gap-6 md:grid-cols-7">
              <OrdersByDateChart data={metrics.ordersByDate} />
              <TopCustomers customers={metrics.topCustomers} />
            </div>
          </>
        ) : (
          <NoDataWireframe />
        )}
      </main>
    </div>
  );
}