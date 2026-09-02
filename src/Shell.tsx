import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Compass, MapPinned, Plus, UserRound } from 'lucide-react'
import { cls } from './lib'

const links = [
  { to: '/', label: '我的旅行', icon: MapPinned, end: true },
  { to: '/explore', label: '发现', icon: Compass },
  { to: '/profile', label: '我', icon: UserRound },
]

export default function Shell() {
  const nav = useNavigate()
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b backdrop-blur-md" style={{ borderColor: 'var(--line)', background: 'color-mix(in srgb, var(--bg) 82%, transparent)' }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <NavLink to="/" className="flex items-center gap-2 no-underline" style={{ color: 'var(--ink)' }}>
            <Mark />
            <div>
              <div className="display text-xl leading-none">BOOMVOY</div>
              <div className="text-[11px] tracking-wide" style={{ color: 'var(--muted)' }}>
                Plan less. Decide better.
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
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
          <button className="btn" onClick={() => nav('/new')}>
            <Plus size={16} /> 创建旅行
          </button>
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
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="9" fill="var(--accent-soft)" />
      <path d="M6 22c4-10 8-4 10-8s6 2 10-6" fill="none" stroke="var(--accent)" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="6" cy="22" r="2.1" fill="var(--ink)" />
      <circle cx="26" cy="8" r="2.1" fill="var(--ink)" />
    </svg>
  )
}
