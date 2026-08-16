import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * Avatar — round profile image with an initials fallback, matching the
 * UserMenu style (primary-tinted fallback). Sizes via className (h-9 w-9 etc.).
 */
export function Avatar({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 overflow-hidden rounded-full align-middle',
        className
      )}
    >
      {children}
    </span>
  )
}

export function AvatarImage({
  src,
  alt,
  className,
}: {
  src?: string
  alt?: string
  className?: string
}) {
  return (
    <img
      src={src}
      alt={alt ?? ''}
      className={cn('aspect-square h-full w-full object-cover', className)}
    />
  )
}

export function AvatarFallback({
  className,
  children,
}: {
  className?: string
  children?: React.ReactNode
}) {
  return (
    <span
      className={cn(
        'flex aspect-square h-full w-full items-center justify-center rounded-full text-sm font-bold',
        className
      )}
    >
      {children}
    </span>
  )
}
