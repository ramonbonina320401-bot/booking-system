import { Check } from 'lucide-react'

import { Label } from '@/components/ui/label'
import { safeHex } from '@/lib/color'
import { cn } from '@/lib/utils'

interface ColorPickerProps {
  id: string
  label: string
  value: string
  /** Called with a valid hex string on change (live preview happens here). */
  onChange: (hex: string) => void
}

/**
 * Curated palette — preset-only so every brand color stays on a tasteful,
 * theme-safe set. No free hex input / native color dialog (avoids the messy
 * look of arbitrary colors breaking light/dark consistency).
 */
const PRESETS = [
  '#2563eb', // blue
  '#1d4ed8', // dark blue
  '#0ea5e9', // sky
  '#6366f1', // indigo
  '#7c3aed', // violet
  '#9333ea', // purple
  '#db2777', // pink
  '#e11d48', // rose
  '#dc2626', // red
  '#ea580c', // orange
  '#f59e0b', // amber
  '#facc15', // yellow
  '#16a34a', // green
  '#059669', // emerald
]

export function ColorPicker({ id, label, value, onChange }: ColorPickerProps) {
  const hex = safeHex(value)

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div
        id={id}
        className="grid grid-cols-5 gap-2 sm:grid-cols-4"
        role="group"
        aria-label={`${label} presets`}
      >
        {PRESETS.map((c) => {
          const active = safeHex(c).toLowerCase() === hex.toLowerCase()
          return (
            <button
              key={c}
              type="button"
              className={cn(
                'relative flex aspect-square items-center justify-center rounded-xl border border-border transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                active && 'ring-2 ring-ring ring-offset-1'
              )}
              style={{ backgroundColor: c }}
              onClick={() => onChange(c)}
              aria-label={`Set ${label} to ${c}`}
              aria-pressed={active}
            >
              {active && <Check className="h-4 w-4 text-white mix-blend-difference" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
