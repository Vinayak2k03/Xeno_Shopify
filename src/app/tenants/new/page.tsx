"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { AuthService } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TenantFormWireframe } from "@/components/forms/loading-states";

export default function NewTenant() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: "",
    shopifyDomain: "",
    shopifyAccessToken: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pageLoading, setPageLoading] = useState(true);

  // Debug: Check authentication and tokens
  useEffect(() => {
    if (typeof document !== "undefined") {
      console.log("=== Tenant Creation Debug ===");
      console.log("Current user:", user);
      console.log("Auth loading:", authLoading);
      console.log("Session token available:", !!AuthService.getToken());
      console.log("LocalStorage token:", AuthService.getToken());

      // Test auth endpoint only if user exists
      if (user) {
        api
          .get("/api/auth/me")
          .then((res) => {
            if (res.ok) {
              return res.json();
            } else {
              console.error(
                "Auth me response not ok:",
                res.status,
                res.statusText
              );
              return { error: "Non-200 response" };
            }
          })
          .then((data) => console.log("Auth me response:", data))
          .catch((err) => console.error("Auth me error:", err));
      }
    }
  }, [user, authLoading]);

  // Redirect if not authenticated
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      console.log("No user found, redirecting to sign in");
      router.push("/auth/signin");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPageLoading(false);
    }, 800);

    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      console.log("=== Creating Tenant ===");
      console.log("Form data:", formData);
      console.log("Current user:", user);
      console.log("Session token for request:", AuthService.getToken());

      // Create tenant using API helper
      const response = await api.post("/api/tenants", formData);

      console.log("Tenant creation response status:", response.status);
      console.log("Response headers:", [...response.headers.entries()]);

      if (response.ok) {
        const result = await response.json();
        console.log("Tenant created successfully:", result);
        router.push("/dashboard");
      } else {
        // Handle different error response types
        const contentType = response.headers.get("content-type");
        let errorMessage = "Failed to create tenant";

        if (contentType && contentType.includes("application/json")) {
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
            console.error("JSON error response:", errorData);
          } catch (jsonError) {
            console.error("Failed to parse JSON error response:", jsonError);
            errorMessage = `Server error: ${response.status}`;
          }
        } else {
          const errorText = await response.text();
          console.error("Non-JSON error response:", errorText);
          errorMessage = `Server error: ${
            response.status
          } - ${errorText.substring(0, 100)}`;
        }

        setError(errorMessage);
      }
    } catch (error) {
      console.error("Network/Request error:", error);
      setError(
        "Network error occurred. Please check your connection and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        Loading...
      </div>
    );
  }

  // Don't render if not authenticated (will redirect)
  if (!user) {
    return null;
  }

  if (pageLoading || authLoading) {
    return <TenantFormWireframe />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Add New Shopify Store</CardTitle>
          <p className="text-sm text-gray-600">Signed in as: {user.email}</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-1">
                Store Name
              </label>
              <input
                type="text"
                id="name"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="My Shopify Store"
              />
            </div>

            <div>
              <label
                htmlFor="shopifyDomain"
                className="block text-sm font-medium mb-1"
              >
                Shopify Domain
              </label>
              <input
                type="text"
                id="shopifyDomain"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.shopifyDomain}
                onChange={(e) =>
                  setFormData({ ...formData, shopifyDomain: e.target.value })
                }
                placeholder="your-store.myshopify.com"
              />
            </div>

            <div>
              <label
                htmlFor="shopifyAccessToken"
                className="block text-sm font-medium mb-1"
              >
                Access Token
              </label>
              <input
                type="password"
                id="shopifyAccessToken"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.shopifyAccessToken}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    shopifyAccessToken: e.target.value,
                  })
                }
                placeholder="shpat_..."
              />
            </div>

            {error && (
              <div className="text-red-600 text-sm bg-red-50 p-3 rounded">
                {error}
              </div>
            )}

            <div className="flex space-x-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/dashboard")}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? "Creating..." : "Create Tenant"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
