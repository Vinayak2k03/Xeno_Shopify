import * as React from "react"
import { cn } from "@/lib/utils"

interface WireframeProps {
  className?: string
}

// Basic skeleton component
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-muted/50",
        className
      )}
      {...props}
    />
  )
}

// Metric card wireframe
export function MetricCardWireframe({ className }: WireframeProps) {
  return (
    <div className={cn(
      "rounded-2xl bg-card text-card-foreground shadow-sm border border-border/50 p-6",
      className
    )}>
      <div className="flex items-center justify-between space-y-0 pb-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-5 w-5 rounded" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-3 w-32" />
      </div>
    </div>
  )
}

// Chart wireframe
export function ChartWireframe({ className }: WireframeProps) {
  return (
    <div className={cn(
      "rounded-2xl bg-card text-card-foreground shadow-sm border border-border/50 p-6 col-span-4",
      className
    )}>
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <div className="h-[350px] relative">
          {/* Chart background */}
          <Skeleton className="absolute inset-0 rounded-lg" />
          
          {/* Simulated chart bars */}
          <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between space-x-1">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton
                key={i}
                className="w-6"
                style={{
                  height: `${Math.random() * 100 + 20}px`,
                  animationDelay: `${i * 0.1}s`
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// Table/List wireframe
export function TableWireframe({ className }: WireframeProps) {
  return (
    <div className={cn(
      "rounded-2xl bg-card text-card-foreground shadow-sm border border-border/50 p-6 col-span-3",
      className
    )}>
      <div className="space-y-4">
        <Skeleton className="h-6 w-40" />
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center space-x-4">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
              <div className="space-y-2 text-right">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-3 w-12" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Header wireframe
export function HeaderWireframe({ className }: WireframeProps) {
  return (
    <header className={cn(
      "sticky top-0 z-50 border-b bg-background/80 backdrop-blur-xl",
      className
    )}>
      <div className="flex h-16 items-center px-6">
        <div className="flex items-center space-x-6 flex-1">
          <div className="flex items-center space-x-3">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-6 w-48" />
          </div>
          <Skeleton className="h-9 w-64 rounded-xl" />
        </div>
        
        <div className="flex items-center space-x-3">
          <Skeleton className="h-8 w-20 rounded-lg" />
          <Skeleton className="h-8 w-20 rounded-lg" />
          <Skeleton className="h-8 w-16 rounded-lg" />
        </div>
      </div>
    </header>
  )
}