'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface MetricCardProps {
  title: string
  value: string | number
  description?: string
  trend?: {
    value: number
    isPositive: boolean
  }
  icon?: React.ReactNode
  gradient?: boolean
  className?: string
}

export function MetricCard({ 
  title, 
  value, 
  description, 
  trend, 
  icon, 
  gradient = false,
  className 
}: MetricCardProps) {
  return (
    <Card 
      className={cn(
        "relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1",
        gradient && "bg-gradient-primary text-white border-white/20",
        className
      )}
      hover
    >
      {gradient && (
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
      )}
      
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className={cn(
          "text-sm font-medium",
          gradient ? "text-white/90" : "text-muted-foreground"
        )}>
          {title}
        </CardTitle>
        {icon && (
          <div className={cn(
            "h-5 w-5",
            gradient ? "text-white/80" : "text-muted-foreground"
          )}>
            {icon}
          </div>
        )}
      </CardHeader>
      
      <CardContent className="space-y-2">
        <div className={cn(
          "text-3xl font-bold tracking-tight",
          gradient ? "text-white" : "text-foreground"
        )}>
          {value}
        </div>
        
        <div className="flex items-center space-x-2">
          {description && (
            <p className={cn(
              "text-xs",
              gradient ? "text-white/80" : "text-muted-foreground"
            )}>
              {description}
            </p>
          )}
          
          {trend && (
            <div className={cn(
              "flex items-center text-xs font-medium px-2 py-1 rounded-full",
              trend.isPositive 
                ? gradient 
                  ? "bg-white/20 text-white" 
                  : "bg-success/10 text-success"
                : gradient
                  ? "bg-white/20 text-white"
                  : "bg-destructive/10 text-destructive"
            )}>
              <svg
                className={cn(
                  "w-3 h-3 mr-1",
                  trend.isPositive ? "rotate-0" : "rotate-180"
                )}
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M5.293 7.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L6.707 7.707a1 1 0 01-1.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              {Math.abs(trend.value)}%
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}