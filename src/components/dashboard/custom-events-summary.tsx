'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface CustomEventsSummaryProps {
  data: {
    cartCreated: number;
    cartAbandoned: number;
    checkoutStarted: number;
    totalAbandonedValue: number;
    abandonmentRate: string;
  }
  className?: string
}

export function CustomEventsSummary({ data, className }: CustomEventsSummaryProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const getAbandonmentRateColor = (rate: string) => {
    const numRate = parseFloat(rate)
    if (numRate < 30) return 'bg-green-100 text-green-800'
    if (numRate < 60) return 'bg-yellow-100 text-yellow-800'
    return 'bg-red-100 text-red-800'
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Custom Events Overview (Last 30 Days)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Cart Created */}
          <div className="flex items-center space-x-3 p-3 rounded-lg border">
            <div className="text-2xl">🛒</div>
            <div>
              <div className="text-2xl font-bold text-blue-600">{data.cartCreated}</div>
              <div className="text-sm text-gray-600">Carts Created</div>
            </div>
          </div>

          {/* Cart Abandoned */}
          <div className="flex items-center space-x-3 p-3 rounded-lg border">
            <div className="text-2xl">💔</div>
            <div>
              <div className="text-2xl font-bold text-red-600">{data.cartAbandoned}</div>
              <div className="text-sm text-gray-600">Carts Abandoned</div>
              <Badge className={`text-xs ${getAbandonmentRateColor(data.abandonmentRate)}`}>
                {data.abandonmentRate}% rate
              </Badge>
            </div>
          </div>

          {/* Checkout Started */}
          <div className="flex items-center space-x-3 p-3 rounded-lg border">
            <div className="text-2xl">🎯</div>
            <div>
              <div className="text-2xl font-bold text-green-600">{data.checkoutStarted}</div>
              <div className="text-sm text-gray-600">Checkouts Started</div>
            </div>
          </div>

          {/* Abandoned Value */}
          <div className="flex items-center space-x-3 p-3 rounded-lg border">
            <div className="text-2xl">💰</div>
            <div>
              <div className="text-lg font-bold text-orange-600">
                {formatCurrency(data.totalAbandonedValue)}
              </div>
              <div className="text-sm text-gray-600">Lost Revenue</div>
              <div className="text-xs text-red-500">
                💸 Potential recovery opportunity
              </div>
            </div>
          </div>
        </div>

        {/* Insights Section */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="font-semibold text-gray-800 mb-2">📊 Key Insights</h4>
          <div className="space-y-2 text-sm">
            {data.cartAbandoned > 0 && (
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                <span>
                  <strong>{data.cartAbandoned}</strong> customers abandoned their carts worth{' '}
                  <strong>{formatCurrency(data.totalAbandonedValue)}</strong>
                </span>
              </div>
            )}
            
            {data.checkoutStarted > 0 && (
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                <span>
                  <strong>{data.checkoutStarted}</strong> customers showed high purchase intent by starting checkout
                </span>
              </div>
            )}

            {parseFloat(data.abandonmentRate) > 70 && (
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                <span className="text-orange-700">
                  ⚠️ High abandonment rate ({data.abandonmentRate}%) - consider cart recovery campaigns
                </span>
              </div>
            )}

            {data.cartCreated === 0 && data.checkoutStarted === 0 && (
              <div className="text-gray-500 text-center py-4">
                No custom events tracked yet. Events will appear once customers interact with carts and checkouts.
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}