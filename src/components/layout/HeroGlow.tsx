/**
 * HeroGlow — animated brand-tinted backdrop used behind page headers.
 *
 * The drifting blobs come from the dynamic branding CSS vars (--app-primary /
 * --app-accent), so they follow the admin's palette in both themes. Purely
 * decorative (aria-hidden). Collapses to a static backdrop under
 * prefers-reduced-motion (the global block freezes the animation).
 */
export function HeroGlow() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="hero-glow hero-glow-a" />
      <div className="hero-glow hero-glow-b" />
      <div className="hero-glow hero-glow-c" />
    </div>
  )
}
