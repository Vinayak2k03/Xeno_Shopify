'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface TopCustomer {
  id: string
  name: string
  email: string
  totalSpent: number
  ordersCount: number
}

interface TopCustomersProps {
  customers: TopCustomer[]
}

export function TopCustomers({ customers }: TopCustomersProps) {
  return (
    <Card className="col-span-3">
      <CardHeader>
        <CardTitle>Top Customers by Spend</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {customers.map((customer, index) => {
            // Ensure totalSpent and ordersCount are numbers
            const totalSpent = typeof customer.totalSpent === 'number' 
              ? customer.totalSpent 
              : parseFloat(customer.totalSpent.toString()) || 0
            
            const ordersCount = typeof customer.ordersCount === 'number' 
              ? customer.ordersCount 
              : parseInt(customer.ordersCount.toString()) || 0

            return (
              <div key={customer.id} className="flex items-center">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-medium">
                  {index + 1}
                </div>
                <div className="ml-4 space-y-1 flex-1">
                  <p className="text-sm font-medium leading-none">
                    {customer.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {customer.email}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">
                    ₹{totalSpent.toFixed(2)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {ordersCount} orders
                  </p>
                </div>
              </div>
            )
          })}
          {customers.length === 0 && (
            <div className="text-center text-muted-foreground py-4">
              No customers found
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}