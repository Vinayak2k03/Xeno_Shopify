'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

interface Product {
  id: string
  title: string
  revenue: number
  unitsSold: number
  averagePrice: number
}

interface TopProductsProps {
  products: Product[]
  className?: string
}

export function TopProducts({ products, className }: TopProductsProps) {
  const maxRevenue = Math.max(...products.map(p => p.revenue), 1)

  return (
    <Card className={cn("", className)}>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <svg
            className="w-5 h-5 text-orange-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
            />
          </svg>
          <span>Top Products by Revenue</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {products.slice(0, 10).map((product, index) => {
            const revenuePercentage = (product.revenue / maxRevenue) * 100
            const position = index + 1
            const isTop3 = position <= 3

            return (
              <div key={product.id} className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <div 
                      className={cn(
                        "flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold",
                        isTop3 
                          ? "bg-gradient-to-r from-yellow-400 to-orange-500 text-white" 
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {position}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{product.title}</p>
                      <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                        <span>{product.unitsSold} sold</span>
                        <span>•</span>
                        <span className="flex items-center space-x-1">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
                          </svg>
                          <span>{revenuePercentage.toFixed(1)}%</span>
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-sm">
                      ₹{product.revenue.toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      ₹{product.averagePrice.toFixed(2)} avg
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
          
          {products.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
              <svg
                className="w-12 h-12 mx-auto mb-4 opacity-50"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
              <p className="font-medium">No product data available</p>
              <p className="text-sm mt-1">Sync your store data to see top products</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
