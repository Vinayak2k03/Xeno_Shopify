import { 
  Skeleton, 
  MetricCardWireframe, 
  ChartWireframe, 
  TableWireframe, 
  HeaderWireframe 
} from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

interface LoadingStateProps {
  className?: string
}

// Dashboard wireframe layout
export function DashboardWireframe({ className }: LoadingStateProps) {
  return (
    <div className={cn("flex flex-col min-h-screen bg-background", className)}>
      <HeaderWireframe />
      
      <main className="flex-1 p-6 space-y-8">
        {/* Metrics Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <MetricCardWireframe />
          <MetricCardWireframe />
          <MetricCardWireframe />
          <MetricCardWireframe />
        </div>

        {/* Charts and Tables */}
        <div className="grid gap-6 md:grid-cols-7">
          <ChartWireframe />
          <TableWireframe />
        </div>
      </main>
    </div>
  )
}

// Welcome card wireframe
export function WelcomeCardWireframe({ className }: LoadingStateProps) {
  return (
    <div className="flex items-center justify-center py-20">
      <div className={cn(
        "w-full max-w-md rounded-2xl bg-card text-card-foreground shadow-sm border border-border/50 p-6 text-center",
        className
      )}>
        <div className="space-y-4">
          <Skeleton className="h-8 w-48 mx-auto" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4 mx-auto" />
          </div>
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </div>
    </div>
  )
}

// Auth loading wireframe
export function AuthLoadingWireframe({ className }: LoadingStateProps) {
  return (
    <div className={cn(
      "flex items-center justify-center min-h-screen",
      className
    )}>
      <div className="text-center space-y-4">
        <div className="relative">
          <Skeleton className="h-12 w-12 rounded-full mx-auto" />
          <div className="absolute inset-0 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
        <Skeleton className="h-4 w-32 mx-auto" />
      </div>
    </div>
  )
}

// Sync loading state
export function SyncLoadingWireframe({ className }: LoadingStateProps) {
  return (
    <div className={cn(
      "fixed inset-0 bg-black/50 flex items-center justify-center z-50",
      className
    )}>
      <div className="bg-card rounded-2xl p-6 shadow-2xl text-center space-y-4 max-w-sm w-full mx-4">
        <div className="relative">
          <Skeleton className="h-16 w-16 rounded-full mx-auto" />
          <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-5 w-40 mx-auto" />
          <Skeleton className="h-4 w-48 mx-auto" />
        </div>
        <div className="w-full bg-muted rounded-full h-2">
          <div className="bg-primary h-2 rounded-full animate-pulse" style={{ width: '60%' }} />
        </div>
      </div>
    </div>
  )
}

// No data state
export function NoDataWireframe({ className }: LoadingStateProps) {
  return (
    <div className={cn(
      "rounded-2xl bg-card text-card-foreground shadow-sm border border-border/50 text-center py-20",
      className
    )}>
      <div className="space-y-4 max-w-md mx-auto">
        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto">
          <Skeleton className="w-8 h-8 rounded" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-6 w-48 mx-auto" />
          <Skeleton className="h-4 w-64 mx-auto" />
        </div>
        <Skeleton className="h-12 w-32 mx-auto rounded-xl" />
      </div>
    </div>
  )
}