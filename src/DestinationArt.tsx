import { useState } from 'react'
import { destinationIllustration, themeLandscape, type Landscape } from './illustrationCatalog'
import type { ThemeId } from './types'

const assets = import.meta.glob('./assets/illustrations/**/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>

export default function DestinationArt({ city = '', theme = 'cream', landscape, className = '', eager = false, sizes = '(max-width: 767px) 176px, 320px' }: { city?: string; theme?: ThemeId; landscape?: Landscape; className?: string; eager?: boolean; sizes?: string }) {
  const key = destinationIllustration(city, landscape || themeLandscape(theme))
  // Keep failures scoped to this asset so changing destination can load its new artwork.
  const [failed, setFailed] = useState<string[]>([])
  const fallback = 'generic/city-v1'
  const requested = failed.includes(key) ? fallback : key
  const chosen = assets[`./assets/illustrations/${requested}.webp`] ? requested : fallback
  const src = assets[`./assets/illustrations/${chosen}.webp`]
  const small = failed.includes(`${chosen}-480`) ? undefined : assets[`./assets/illustrations/${chosen}-480.webp`]
  const srcSet = small && src ? `${small} 480w, ${src} 960w` : undefined
  return <span className={`destination-art ${className}`} aria-hidden="true">
    {src && !failed.includes(chosen) && <img src={src} srcSet={srcSet} sizes={srcSet ? eager ? sizes : `auto, ${sizes}` : undefined} alt="" width={960} height={640} loading={eager ? 'eager' : 'lazy'} decoding="async" onError={(event) => {
      const failedKey = small && event.currentTarget.currentSrc === new URL(small, window.location.href).href ? `${chosen}-480` : chosen
      setFailed((values) => [...values, failedKey])
    }} />}
  </span>
}
