'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface DateRangeProps {
  onDateRangeChange: (startDate: string, endDate: string) => void
  initialStartDate?: string
  initialEndDate?: string
  className?: string
}

export function DateRangeFilter({ onDateRangeChange, initialStartDate, initialEndDate, className }: DateRangeProps) {
  const [selectedRange, setSelectedRange] = useState('30d')
  const [customStart, setCustomStart] = useState(initialStartDate || '')
  const [customEnd, setCustomEnd] = useState(initialEndDate || '')

  // Remove the automatic useEffect that was causing infinite loops
  // The parent component will handle setting initial values

  const predefinedRanges = [
    { label: 'Last 7 days', value: '7d' },
    { label: 'Last 30 days', value: '30d' },
    { label: 'Last 3 months', value: '3m' },
    { label: 'Last 6 months', value: '6m' },
    { label: 'Last year', value: '1y' },
    { label: 'Custom', value: 'custom' }
  ]

  const calculateDateRange = (range: string) => {
    const now = new Date()
    let startDate = new Date()

    switch (range) {
      case '7d':
        startDate.setDate(now.getDate() - 7)
        break
      case '30d':
        startDate.setDate(now.getDate() - 30)
        break
      case '3m':
        startDate.setMonth(now.getMonth() - 3)
        break
      case '6m':
        startDate.setMonth(now.getMonth() - 6)
        break
      case '1y':
        startDate.setFullYear(now.getFullYear() - 1)
        break
      default:
        return
    }

    return {
      start: startDate.toISOString().split('T')[0],
      end: now.toISOString().split('T')[0]
    }
  }

  const handleRangeSelect = (range: string) => {
    setSelectedRange(range)
    
    if (range !== 'custom') {
      const dates = calculateDateRange(range)
      if (dates) {
        onDateRangeChange(dates.start, dates.end)
      }
    }
  }

  const handleCustomDateApply = () => {
    if (customStart && customEnd) {
      onDateRangeChange(customStart, customEnd)
    }
  }

  return (
    <Card className={cn("mb-6", className)}>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Date Range
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {predefinedRanges.map((range) => (
            <Button
              key={range.value}
              variant={selectedRange === range.value ? "default" : "outline"}
              size="sm"
              onClick={() => handleRangeSelect(range.value)}
              className="text-xs"
            >
              {range.label}
            </Button>
          ))}
        </div>

        {selectedRange === 'custom' && (
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="text-sm font-medium">Start Date</label>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-200"
              />
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium">End Date</label>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-200"
              />
            </div>
            <Button 
              onClick={handleCustomDateApply}
              disabled={!customStart || !customEnd}
              size="sm"
            >
              Apply
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}