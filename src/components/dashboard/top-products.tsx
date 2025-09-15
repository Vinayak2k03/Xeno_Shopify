'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'

interface TopProduct {
  id: string
  title: string
  revenue: number
  unitsSold: number
  averagePrice: number
}

interface TopProductsProps {
  products: TopProduct[]
  className?: string
}

export function TopProducts({ products, className }: TopProductsProps) {
  if (!products || products.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            Top Products by Revenue
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-12">
            <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <p className="text-lg font-medium">No products data available</p>
            <p className="text-sm mt-2">Try syncing your Shopify data to see top performing products.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const maxRevenue = Math.max(...products.map(p => p.revenue))

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          Top Products by Revenue
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {products.slice(0, 10).map((product, index) => {
            const revenuePercentage = (product.revenue / maxRevenue) * 100

            return (
              <div key={product.id} className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white ${
                      index === 0 ? 'bg-yellow-500' :
                      index === 1 ? 'bg-gray-400' :
                      index === 2 ? 'bg-amber-600' :
                      'bg-primary'
                    }`}>
                      {index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm leading-none truncate">
                        {product.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {product.unitsSold.toLocaleString()} units sold
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-sm">
                      ${product.revenue.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      ${product.averagePrice.toFixed(2)} avg
                    </p>
                  </div>
                </div>
                <Progress value={revenuePercentage} className="h-2" />
              </div>
            )
          })}
          
          {products.length > 10 && (
            <div className="text-center pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Showing top 10 of {products.length} products
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}