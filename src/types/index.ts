export interface ShopifyConfig {
  domain: string
  accessToken: string
  apiKey?: string
  apiSecret?: string
}

export interface TenantWithConfig {
  id: string
  name: string
  shopifyDomain: string
  shopifyAccessToken?: string
  apiKey?: string
  apiSecret?: string
  isActive: boolean
  userId: string
}

export interface DashboardMetrics {
  totalCustomers: number
  totalOrders: number
  totalRevenue: number
  revenueThisMonth: number
  ordersThisMonth: number
  customersThisMonth: number
  ordersByDate: OrdersByDate[]
  topCustomers: TopCustomer[]
}

export interface OrdersByDate {
  date: string
  orders: number
  revenue: number
}

export interface TopCustomer {
  id: string
  name: string
  email: string
  totalSpent: number
  ordersCount: number
}

export interface ShopifyCustomer {
  id: number
  email: string
  first_name: string
  last_name: string
  phone: string
  total_spent: string
  orders_count: number
  tags: string
  accepts_marketing: boolean
  created_at: string
  updated_at: string
}

export interface ShopifyOrder {
  id: number
  order_number: string
  email: string
  total_price: string
  subtotal_price: string
  total_tax: string
  currency: string
  financial_status: string
  fulfillment_status: string
  tags: string
  note: string
  processed_at: string
  cancelled_at: string
  created_at: string
  updated_at: string
  customer: {
    id: number
  }
  line_items: ShopifyLineItem[]
}

export interface ShopifyLineItem {
  id: number
  title: string
  quantity: number
  price: string
  variant_id: number
  product_id: number
}

export interface ShopifyProduct {
  id: number
  title: string
  handle: string
  body_html: string
  vendor: string
  product_type: string
  tags: string
  status: string
  images: any[]
  variants: any[]
  created_at: string
  updated_at: string
}