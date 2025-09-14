import * as React from "react"
import { cn } from "@/lib/utils"

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hover?: boolean
  glass?: boolean
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className = '', hover = false, glass = false, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        `
          rounded-2xl bg-card text-card-foreground shadow-sm border border-border/50
          transition-all duration-200 ease-in-out
        `,
        hover && "hover:shadow-lg hover:-translate-y-1 cursor-pointer",
        glass && "glass backdrop-blur-xl",
        className
      )}
      {...props}
    />
  )
)

const CardHeader = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className = '', ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex flex-col space-y-2 p-6 pb-4", className)}
      {...props}
    />
  )
)

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className = '', ...props }, ref) => (
    <h3
      ref={ref}
      className={cn(
        "text-xl font-semibold leading-none tracking-tight text-card-foreground",
        className
      )}
      {...props}
    />
  )
)

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className = '', ...props }, ref) => (
    <p
      ref={ref}
      className={cn("text-sm text-muted-foreground leading-relaxed", className)}
      {...props}
    />
  )
)

const CardContent = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className = '', ...props }, ref) => (
    <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
  )
)

const CardFooter = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className = '', ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex items-center p-6 pt-0", className)}
      {...props}
    />
  )
)

Card.displayName = "Card"
CardHeader.displayName = "CardHeader"
CardTitle.displayName = "CardTitle"
CardDescription.displayName = "CardDescription"
CardContent.displayName = "CardContent"
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }