import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Compass, MapPinned, Plus, UserRound } from 'lucide-react'
import { cls } from './lib'
import { useT } from './i18n'
import { LangSwitch } from './ui'
import { useApp } from './store'
import boomiIcon from './assets/boom_cat_icon.png'

export default function Shell() {
  const nav = useNavigate()
  const { t } = useT()
  const themePref = useApp((s) => s.profile.themePref)
  const theme = themePref === 'auto' ? 'cream' : themePref
  const links = [
    { to: '/', label: t('nav.trips'), icon: MapPinned, end: true },
    { to: '/explore', label: t('nav.explore'), icon: Compass },
    { to: '/profile', label: t('nav.me'), icon: UserRound },
  ]

  return (
    <div className={`theme-${theme} min-h-screen`}>
      <header className="sticky top-0 z-40 border-b backdrop-blur-md" style={{ borderColor: 'var(--line)', backgroundColor: 'color-mix(in srgb, var(--bg) 82%, transparent)' }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <NavLink to="/" className="flex items-center gap-2 no-underline" style={{ color: 'var(--ink)' }} data-guide="brand">
            <Mark />
            <div>
              <div className="display text-xl leading-none">BOOMVOY</div>
              <div className="text-[11px] tracking-wide" style={{ color: 'var(--muted)' }}>
                {t('brand.tagline')}
              </div>
            </div>
          </NavLink>
          <nav className="hidden items-center gap-1 sm:flex">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) =>
                  cls('rounded-full px-3 py-1.5 text-sm no-underline', isActive ? 'btn-soft' : '')
                }
                style={{ color: 'var(--ink)' }}
                data-guide={l.to === '/explore' ? 'nav-explore' : l.to === '/' ? 'nav-home' : undefined}
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <div className="hidden sm:block">
              <LangSwitch compact />
            </div>
            <button className="btn" onClick={() => nav('/new')} data-guide="create-trip">
              <Plus size={16} /> {t('nav.create')}
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 pb-24 pt-8">
        <Outlet />
      </main>
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 grid grid-cols-3 border-t sm:hidden"
        style={{ background: 'var(--paper)', borderColor: 'var(--line)' }}
      >
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.end}
            className={({ isActive }) => cls('flex flex-col items-center gap-1 py-3 text-xs no-underline', isActive ? 'font-semibold' : '')}
            style={{ color: 'var(--ink)' }}
            data-guide={l.to === '/explore' ? 'nav-explore' : l.to === '/' ? 'nav-home' : undefined}
          >
            <l.icon size={18} />
            {l.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

export function Mark() {
  return <img src={boomiIcon} alt="" width={36} height={36} className="brand-mark" />
}
