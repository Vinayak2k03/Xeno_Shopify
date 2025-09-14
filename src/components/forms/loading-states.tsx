import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

interface FormLoadingProps {
  className?: string
}

// Tenant creation form wireframe
export function TenantFormWireframe({ className }: FormLoadingProps) {
  return (
    <div className={cn(
      "min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/30 to-background py-12 px-4 sm:px-6 lg:px-8",
      className
    )}>
      <div className="w-full max-w-md rounded-2xl bg-card text-card-foreground shadow-sm border border-border/50 p-6">
        <div className="space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <Skeleton className="h-8 w-48 mx-auto" />
            <Skeleton className="h-4 w-64 mx-auto" />
          </div>
          
          {/* Form fields */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          </div>
          
          {/* Actions */}
          <div className="flex space-x-4">
            <Skeleton className="h-12 flex-1 rounded-xl" />
            <Skeleton className="h-12 flex-1 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  )
}

// Sign in form wireframe
export function SignInWireframe({ className }: FormLoadingProps) {
  return (
    <div className={cn(
      "min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/30 to-background p-4",
      className
    )}>
      <div className="w-full max-w-md">
        <div className="rounded-2xl bg-card/80 backdrop-blur-xl shadow-2xl border-0 p-6">
          <div className="space-y-6">
            {/* Header */}
            <div className="text-center space-y-4">
              <Skeleton className="h-12 w-12 rounded-2xl mx-auto" />
              <div className="space-y-2">
                <Skeleton className="h-8 w-48 mx-auto" />
                <Skeleton className="h-4 w-56 mx-auto" />
              </div>
            </div>

            {/* Form */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-12 w-full rounded-xl" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-12 w-full rounded-xl" />
              </div>
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>

            {/* Footer */}
            <div className="text-center space-y-4">
              <Skeleton className="h-4 w-40 mx-auto" />
              <Skeleton className="h-16 w-full rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}