import * as React from 'react'

import { HeroGlow } from '@/components/layout/HeroGlow'
import { CardEyebrow } from '@/components/ui/card'

interface PageHeroProps {
  eyebrow: string
  title: string
  subtitle?: string
  /** Optional right-aligned CTA (e.g. "New booking" button). */
  action?: React.ReactNode
}

/**
 * PageHero — consistent page header for the app's sub-pages.
 *
 * Shares the same treatment as the Home hero: animated brand glow backdrop,
 * staggered fade-and-rise entrance for eyebrow → title → subtitle → action.
 * The delays are small so content pages feel quick, not cinematic. All
 * animations collapse under prefers-reduced-motion (global CSS block).
 */
export function PageHero({ eyebrow, title, subtitle, action }: PageHeroProps) {
  return (
    <div className="relative mb-8 flex flex-wrap items-end justify-between gap-4 overflow-hidden rounded-2xl border border-border/40 bg-card/60 px-6 pb-4 pt-5 shadow-sm backdrop-blur-sm sm:px-8">
      <HeroGlow />
      <div className="max-w-2xl">
        <CardEyebrow className="hero-reveal">{eyebrow}</CardEyebrow>
        <h1 className="hero-reveal mt-1 text-3xl font-bold tracking-tight" style={{ animationDelay: '60ms' }}>
          {title}
        </h1>
        {subtitle && (
          <p className="hero-reveal mt-2 text-sm text-muted-foreground" style={{ animationDelay: '120ms' }}>
            {subtitle}
          </p>
        )}
      </div>
      {action && (
        <div className="hero-reveal" style={{ animationDelay: '180ms' }}>
          {action}
        </div>
      )}
    </div>
  )
}
