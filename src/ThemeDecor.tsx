import {
  Camera, Check, Compass, Leaf, MapPin, Mountain, Plane, Sun, TreePine, Waves,
  type LucideIcon,
} from 'lucide-react'
import type { ThemeId } from './types'
import { THEMES } from './catalog'
import { themeBlurb, themeLabel, useT } from './i18n'

const THEME_ICONS: Record<ThemeId, [LucideIcon, LucideIcon, LucideIcon]> = {
  cream: [Plane, Camera, MapPin],
  ocean: [Waves, Sun, Compass],
  forest: [TreePine, Mountain, Leaf],
}

/** Original vector artwork: lightweight, resolution independent, and decorative. */
export function ThemeScene({ theme, className = '' }: { theme: ThemeId; className?: string }) {
  return (
    <svg className={`theme-scene ${className}`} viewBox="0 0 440 280" fill="none" aria-hidden="true">
      {theme === 'cream' && <>
        <rect width="440" height="280" fill="#f4e3cf" />
        <circle cx="324" cy="76" r="37" fill="#e7b95f" />
        <path d="M0 174Q78 91 162 162T330 148T470 168V280H0Z" fill="#d8aa9f" />
        <path d="M0 230Q100 132 220 209T440 183V280H0Z" fill="#acaa89" />
        <path d="M0 258Q120 185 260 252T480 217V280H0Z" fill="#c5bd9c" />
        <path d="M212 280Q287 229 224 218Q161 208 211 178" stroke="#f9efd9" strokeWidth="16" />
        <rect x="93" y="127" width="74" height="84" rx="2" fill="#fff8e9" />
        <path d="M82 130L130 97L178 130Z" fill="#aa6b62" />
        <path d="M118 211V177A12 12 0 0 1 142 177V211" fill="#c09b78" />
        <rect x="104" y="144" width="13" height="18" rx="6.5" fill="#b2bdba" />
        <rect x="143" y="144" width="13" height="18" rx="6.5" fill="#b2bdba" />
        <path d="M290 147V203M266 169Q267 130 290 125Q316 131 314 169Z" fill="#879782" stroke="#6c806b" strokeWidth="3" />
        <path d="M49 65Q64 57 79 65M66 54Q81 46 96 54M235 56L248 62L262 56" stroke="#8b7b67" strokeWidth="2" strokeLinecap="round" />
        <circle cx="370" cy="220" r="4" fill="#f4dc9a" /><circle cx="356" cy="229" r="3" fill="#f4dc9a" />
      </>}
      {theme === 'ocean' && <>
        <rect width="440" height="280" fill="#ddecf0" />
        <circle cx="326" cy="69" r="35" fill="#f3d29e" />
        <path d="M0 165Q113 133 219 163T440 151V280H0Z" fill="#a3d0d7" />
        <path d="M0 202Q102 163 225 195T440 189V280H0Z" fill="#65a8bc" />
        <path d="M0 244Q88 207 214 233T440 223V280H0Z" fill="#3d829d" />
        <path d="M-10 213Q65 191 124 209M240 224Q300 208 375 222M60 260Q126 245 189 261" stroke="#e2f5f3" strokeWidth="2" strokeLinecap="round" />
        <path d="M278 177Q323 136 364 163L414 197H271Z" fill="#d7cbb2" />
        <path d="M325 93H347L353 166H319Z" fill="#fff9ec" />
        <path d="M322 125H350L349 113H323Z" fill="#c98f7d" />
        <rect x="323" y="80" width="27" height="17" fill="#36556a" />
        <path d="M318 80L336 66L354 80Z" fill="#36556a" />
        <path d="M90 182H190L174 199H108Z" fill="#3b5e6d" />
        <path d="M145 91V181H94Z" fill="#fff9ec" />
        <path d="M153 110L185 173H153Z" fill="#f1cc9d" />
        <path d="M145 87V184" stroke="#3b5e6d" strokeWidth="3" strokeLinecap="round" />
        <path d="M46 69Q59 59 72 69Q85 59 98 69M214 97Q223 90 232 97Q241 90 250 97" stroke="#5c8795" strokeWidth="2" strokeLinecap="round" />
      </>}
      {theme === 'forest' && <>
        <rect width="440" height="280" fill="#e6e9d9" />
        <circle cx="322" cy="64" r="34" fill="#d6ba76" />
        <path d="M0 171L89 64L173 162L264 98L367 178L440 123V280H0Z" fill="#a7b39a" />
        <path d="M53 107L89 64L124 106L102 99L86 108L77 95Z" fill="#f5f0de" />
        <path d="M0 217L73 157L168 197L281 124L440 224V280H0Z" fill="#738d70" />
        <path d="M0 246Q107 194 216 247Q301 271 440 218V280H0Z" fill="#45694f" />
        <path d="M142 280Q271 246 229 232Q190 215 268 191" stroke="#d7d9b3" strokeWidth="13" />
        <g fill="#355a45">
          <path d="M52 122L24 179H38L19 210H85L66 179H79Z" /><rect x="48" y="199" width="8" height="43" />
          <path d="M381 134L358 180H369L352 207H410L393 180H405Z" /><rect x="377" y="194" width="8" height="43" />
        </g>
        <g fill="#89a078"><path d="M335 183L315 220H326L313 240H357L345 220H354Z" /><rect x="332" y="230" width="6" height="27" /></g>
        <path d="M174 67L184 73L195 67M208 48L218 54L229 48" stroke="#71816b" strokeWidth="2" strokeLinecap="round" />
      </>}
    </svg>
  )
}

export function ThemeAtmosphere({ theme }: { theme: ThemeId }) {
  return (
    <div className={`theme-atmosphere atmosphere-${theme}`} aria-hidden="true">
      <div className="theme-halo" />
      {THEME_ICONS[theme].map((Icon, index) => (
        <span className={`theme-motif theme-motif-${index + 1}`} key={index}><Icon strokeWidth={1.5} /></span>
      ))}
    </div>
  )
}

export function ThemeBadge({ theme }: { theme: ThemeId }) {
  return (
    <span className="theme-badge" aria-hidden="true">
      {THEME_ICONS[theme].map((Icon, index) => <Icon key={index} size={15} strokeWidth={1.7} />)}
    </span>
  )
}

export function ThemePreview({ theme, selected, onSelect }: { theme: ThemeId; selected: boolean; onSelect: () => void }) {
  const { t } = useT()
  return (
    <button type="button" className={`theme-option theme-${theme}`} aria-pressed={selected} onClick={onSelect}>
      <div className="theme-option-scene"><ThemeScene theme={theme} /></div>
      <div className="theme-option-body">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold">{themeLabel(t, theme)}</span>
          <span className="theme-option-check" aria-hidden="true">{selected && <Check size={13} strokeWidth={3} />}</span>
        </div>
        <p className="mt-1 text-xs leading-5" style={{ color: 'var(--muted)' }}>{themeBlurb(t, theme)}</p>
        <div className="mt-3 flex items-center gap-1.5" aria-hidden="true">
          {THEMES[theme].swatches.map((color) => <span key={color} className="theme-swatch" style={{ background: color }} />)}
          <span className="ml-auto text-[9px] tracking-[0.15em]" style={{ color: 'var(--muted)' }}>{THEMES[theme].name.toUpperCase()}</span>
        </div>
      </div>
    </button>
  )
}
