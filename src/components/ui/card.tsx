import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

/**
 * Cards — borderless, heavily rounded (24px), flat with color-blocked
 * hierarchy (reference: "Organization & Analytics" dashboard).
 * Variants:
 *   default   — plain white surface
 *   accent    — light tint of the dynamic primary color
 *   muted     — flat neutral tint
 *   gradient  — primary → accent pastel wash
 *
 * `lift-hover` adds the subtle micro-interaction (2px lift + soft shadow on
 * hover, pointer devices only, disabled by prefers-reduced-motion).
 */
const cardVariants = cva('lift-hover rounded-3xl bg-card text-card-foreground', {
  variants: {
    variant: {
      default: '',
      accent: 'bg-primary/10',
      muted: 'bg-muted',
      gradient: 'bg-gradient-to-br from-primary/20 via-primary/5 to-accent/15',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
})

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(({ className, variant, ...props }, ref) => (
  <div ref={ref} className={cn(cardVariants({ variant }), className)} {...props} />
))
Card.displayName = 'Card'

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />
  )
)
CardHeader.displayName = 'CardHeader'

const CardTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('text-lg font-bold leading-tight tracking-tight', className)} {...props} />
  )
)
CardTitle.displayName = 'CardTitle'

const CardDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
  )
)
CardDescription.displayName = 'CardDescription'

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
)
CardContent.displayName = 'CardContent'

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex items-center p-6 pt-0', className)} {...props} />
  )
)
CardFooter.displayName = 'CardFooter'

/** Small uppercase section label used as tile headers. */
function CardEyebrow({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('text-xs font-semibold uppercase tracking-wider text-muted-foreground', className)}
      {...props}
    />
  )
}
CardEyebrow.displayName = 'CardEyebrow'

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent, CardEyebrow }
