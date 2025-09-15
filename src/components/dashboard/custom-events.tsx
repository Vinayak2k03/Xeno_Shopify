'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

interface CustomEvent {
  id: string
  eventType: string
  eventData: any
  createdAt: string
  customerId?: string
}

interface CustomEventsProps {
  events: CustomEvent[]
  className?: string
}

export function CustomEventsOverview({ events, className }: CustomEventsProps) {
  if (!events || events.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Custom Events Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-12">
            <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <p className="text-lg font-medium">No custom events data available</p>
            <p className="text-sm mt-2">Events like cart abandonment and checkout starts will appear here.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Group events by type
  const eventsByType = events.reduce((acc, event) => {
    acc[event.eventType] = (acc[event.eventType] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  // Prepare data for charts
  const eventTypeData = Object.entries(eventsByType).map(([type, count]) => ({
    eventType: type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    count,
    color: getEventColor(type)
  }))

  // Group events by date
  const eventsByDate = events.reduce((acc, event) => {
    const date = new Date(event.createdAt).toISOString().split('T')[0]
    if (!acc[date]) acc[date] = {}
    acc[date][event.eventType] = (acc[date][event.eventType] || 0) + 1
    return acc
  }, {} as Record<string, Record<string, number>>)

  const eventTimelineData = Object.entries(eventsByDate)
    .map(([date, events]) => ({
      date,
      ...events,
      total: Object.values(events).reduce((sum, count) => sum + count, 0)
    }))
    .sort((a, b) => a.date.localeCompare(b.date))

  // Calculate key metrics
  const totalEvents = events.length
  const cartAbandonments = events.filter(e => e.eventType === 'cart_abandoned').length
  const checkoutStarts = events.filter(e => e.eventType === 'checkout_started').length
  const cartCreations = events.filter(e => e.eventType === 'cart_created').length
  
  const abandonmentRate = cartCreations > 0 ? ((cartAbandonments / cartCreations) * 100).toFixed(1) : '0.0'

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <div>
                <p className="text-2xl font-bold">{totalEvents}</p>
                <p className="text-xs text-muted-foreground">Total Events</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-2.5 5M7 13h10M17 21a2 2 0 100-4 2 2 0 000 4zM9 21a2 2 0 100-4 2 2 0 000 4z" />
              </svg>
              <div>
                <p className="text-2xl font-bold">{cartAbandonments}</p>
                <p className="text-xs text-muted-foreground">Cart Abandonments</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-2xl font-bold">{checkoutStarts}</p>
                <p className="text-xs text-muted-foreground">Checkout Starts</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-2xl font-bold">{abandonmentRate}%</p>
                <p className="text-xs text-muted-foreground">Abandonment Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Event Types Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Events by Type</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={eventTypeData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                  label={(entry: any) => `${entry.eventType}: ${entry.count}`}
                >
                  {eventTypeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Events Timeline */}
        <Card>
          <CardHeader>
            <CardTitle>Events Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={eventTimelineData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => {
                    const date = new Date(value)
                    return `${date.getMonth() + 1}/${date.getDate()}`
                  }}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip 
                  labelFormatter={(value) => `Date: ${value}`}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Bar dataKey="cart_created" stackId="a" fill="#3b82f6" name="Cart Created" />
                <Bar dataKey="checkout_started" stackId="a" fill="#10b981" name="Checkout Started" />
                <Bar dataKey="cart_abandoned" stackId="a" fill="#f59e0b" name="Cart Abandoned" />
                <Bar dataKey="cart_updated" stackId="a" fill="#8b5cf6" name="Cart Updated" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent Events Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Events</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {events.slice(0, 10).map((event) => (
              <div key={event.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${getEventColorClass(event.eventType)}`} />
                  <div>
                    <p className="font-medium text-sm">
                      {event.eventType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(event.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  {event.eventData?.cartValue && (
                    <p className="text-sm font-medium">₹{Number(event.eventData.cartValue).toFixed(2)}</p>
                  )}
                  {event.eventData?.itemCount && (
                    <p className="text-xs text-muted-foreground">{event.eventData.itemCount} items</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function getEventColor(eventType: string): string {
  const colors: Record<string, string> = {
    cart_created: '#3b82f6',
    cart_updated: '#8b5cf6',
    cart_abandoned: '#f59e0b',
    checkout_started: '#10b981',
    checkout_updated: '#06b6d4'
  }
  return colors[eventType] || '#6b7280'
}

function getEventColorClass(eventType: string): string {
  const classes: Record<string, string> = {
    cart_created: 'bg-blue-500',
    cart_updated: 'bg-purple-500',
    cart_abandoned: 'bg-orange-500',
    checkout_started: 'bg-green-500',
    checkout_updated: 'bg-cyan-500'
  }
  return classes[eventType] || 'bg-gray-500'
}