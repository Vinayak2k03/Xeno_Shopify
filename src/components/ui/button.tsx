import * as React from "react"
import { cn } from "@/lib/utils"

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link' | 'gradient'
  size?: 'default' | 'sm' | 'lg' | 'icon' | 'xs'
  loading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'default', size = 'default', loading = false, children, disabled, ...props }, ref) => {
    const baseClasses = `
      inline-flex items-center justify-center rounded-xl text-sm font-medium 
      transition-all duration-200 ease-in-out
      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 
      disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed
      ring-offset-background
      active:scale-95
      hover:shadow-lg
    `
    
    const variants = {
      default: `
        bg-primary text-primary-foreground shadow-sm
        hover:bg-primary/90 hover:shadow-md
        border border-primary/20
      `,
      destructive: `
        bg-destructive text-destructive-foreground shadow-sm
        hover:bg-destructive/90 hover:shadow-md
        border border-destructive/20
      `,
      outline: `
        border border-input bg-background shadow-sm
        hover:bg-accent hover:text-accent-foreground hover:border-accent-foreground/20
      `,
      secondary: `
        bg-secondary text-secondary-foreground shadow-sm
        hover:bg-secondary/80 hover:shadow-md
        border border-secondary/20
      `,
      ghost: `
        hover:bg-accent hover:text-accent-foreground
        border border-transparent hover:border-accent-foreground/10
      `,
      link: `
        text-primary underline-offset-4 hover:underline
        border border-transparent
      `,
      gradient: `
        bg-gradient-primary text-white shadow-lg
        hover:shadow-xl hover:scale-105
        border border-white/20
      `
    }
    
    const sizes = {
      xs: "h-7 px-2 text-xs",
      sm: "h-8 px-3 text-sm",
      default: "h-10 py-2 px-4",
      lg: "h-12 px-8 text-base",
      icon: "h-10 w-10"
    }

    const isDisabled = disabled || loading

    return (
      <button
        className={cn(baseClasses, variants[variant], sizes[size], className)}
        ref={ref}
        disabled={isDisabled}
        {...props}
      >
        {loading && (
          <svg
            className="mr-2 h-4 w-4 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {children}
      </button>
    )
  }
)

Button.displayName = "Button"

export { Button }