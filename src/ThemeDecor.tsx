import {
  Camera,
  Compass,
  Leaf,
  MapPin,
  Mountain,
  Plane,
  Sun,
  TreePine,
  Waves,
  type LucideIcon,
} from 'lucide-react'
import type { ThemeId } from './types'

const THEME_ICONS: Record<ThemeId, [LucideIcon, LucideIcon, LucideIcon]> = {
  cream: [Plane, Camera, MapPin],
  ocean: [Waves, Sun, Compass],
  forest: [TreePine, Mountain, Leaf],
}

export function ThemeAtmosphere({ theme }: { theme: ThemeId }) {
  return (
    <div className="theme-atmosphere" aria-hidden="true">
      {THEME_ICONS[theme].map((Icon, index) => (
        <span className={`theme-motif theme-motif-${index + 1}`} key={index}>
          <Icon strokeWidth={1.5} />
        </span>
      ))}
    </div>
  )
}

export function ThemeBadge({ theme }: { theme: ThemeId }) {
  return (
    <span className="theme-badge" aria-hidden="true">
      {THEME_ICONS[theme].map((Icon, index) => (
        <Icon key={index} size={15} strokeWidth={1.7} />
      ))}
    </span>
  )
}
