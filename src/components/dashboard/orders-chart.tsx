'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface OrdersByDateProps {
  data: Array<{
    date: string
    orders: number
    revenue: number
  }>
}

export function OrdersByDateChart({ data }: OrdersByDateProps) {
  return (
    <Card className="col-span-4">
      <CardHeader>
        <CardTitle>Orders & Revenue Over Time</CardTitle>
      </CardHeader>
      <CardContent className="pl-2">
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => {
                const date = new Date(value)
                return `${date.getMonth() + 1}/${date.getDate()}`
              }}
            />
            <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
            <Tooltip 
              labelFormatter={(value) => `Date: ${value}`}
              formatter={(value: any, name: string) => [
                name === 'orders' ? value : `$${value.toFixed(2)}`,
                name === 'orders' ? 'Orders' : 'Revenue'
              ]}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="orders"
              stroke="#8884d8"
              strokeWidth={2}
              name="orders"
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="revenue"
              stroke="#82ca9d"
              strokeWidth={2}
              name="revenue"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}