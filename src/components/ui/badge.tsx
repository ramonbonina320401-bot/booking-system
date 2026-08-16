import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border border-transparent px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        // Reference: dark pill with light text — sidebar tokens keep it dark
        // in BOTH themes (foreground would invert to a light pill in dark).
        default: 'bg-sidebar text-sidebar-foreground',
        secondary: 'bg-secondary text-secondary-foreground',
        destructive: 'bg-destructive text-destructive-foreground',
        outline: 'border-border text-foreground',
        success: 'bg-success text-success-foreground',
        warning: 'bg-accent text-accent-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

/** Map a booking status to a badge variant for consistent color coding. */
export function BookingStatusBadge({ status }: { status: string }) {
  const { t } = useI18n()
  const map: Record<string, 'default' | 'secondary' | 'destructive' | 'success' | 'warning'> = {
    pending: 'warning',
    confirmed: 'default',
    cancelled: 'destructive',
    completed: 'success',
  }
  const label =
    status === 'pending' || status === 'confirmed' || status === 'cancelled' || status === 'completed'
      ? t(`status.${status}`)
      : status
  return <Badge variant={map[status] ?? 'secondary'}>{label}</Badge>
}

export { Badge, badgeVariants }
