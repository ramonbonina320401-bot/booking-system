import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * EmptyState — inviting placeholder for empty screens (no bookings, no
 * resources, etc.), matching the "Organization & Analytics" design system:
 * dashed rounded card, tinted icon circle, bold title, muted description,
 * optional action. `compact` shrinks the padding for inline/embedded use.
 */
interface EmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>
  title: string
  description?: string
  /** Optional CTA rendered below the description. */
  action?: React.ReactNode
  compact?: boolean
  className?: string
}

export function EmptyState({ icon: Icon, title, description, action, compact, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-dashed text-center',
        compact ? 'px-4 py-8' : 'px-6 py-12',
        className
      )}
    >
      {Icon && (
        <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="h-7 w-7" aria-hidden="true" />
        </span>
      )}
      <p className="font-semibold">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
