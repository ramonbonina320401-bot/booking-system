import * as React from 'react'

import { HeroGlow } from '@/components/layout/HeroGlow'

interface AdminHeroProps {
  eyebrow: string
  title: string
  subtitle?: string
  /** Optional right-aligned actions (e.g. buttons). */
  actions?: React.ReactNode
}

/**
 * AdminHero — consistent page header for the admin area.
 *
 * Mirrors PageHero's visual treatment (animated glow, rounded card, fade-in)
 * so the admin and public areas feel like one cohesive design.
 */
export function AdminHero({ eyebrow, title, subtitle, actions }: AdminHeroProps) {
  return (
    <div className="relative mb-6 flex flex-wrap items-end justify-between gap-4 overflow-hidden rounded-2xl border border-border/40 bg-card/60 px-6 pb-4 pt-5 shadow-sm backdrop-blur-sm sm:px-8">
      <HeroGlow />
      <div className="max-w-2xl">
        <p className="hero-reveal text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {eyebrow}
        </p>
        <h1 className="hero-reveal mt-1 text-2xl font-bold tracking-tight" style={{ animationDelay: '60ms' }}>
          {title}
        </h1>
        {subtitle && (
          <p className="hero-reveal mt-1 text-sm text-muted-foreground" style={{ animationDelay: '120ms' }}>
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="hero-reveal flex flex-wrap gap-2" style={{ animationDelay: '180ms' }}>
          {actions}
        </div>
      )}
    </div>
  )
}
