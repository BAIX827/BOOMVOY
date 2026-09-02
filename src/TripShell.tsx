import { NavLink, Outlet, useNavigate, useParams } from 'react-router-dom'
import {
  BookOpen,
  CloudSun,
  Compass,
  LayoutGrid,
  Map,
  NotebookPen,
  PiggyBank,
  Receipt,
  Settings2,
  Share2,
  Users,
  Wallet,
} from 'lucide-react'
import { useTrip } from './store'
import { cls, formatRange } from './lib'
import { Mark } from './Shell'

const items = [
  { to: '', label: '总览', icon: LayoutGrid, end: true },
  { to: 'plan', label: '行程', icon: BookOpen },
  { to: 'map', label: '路线', icon: Map },
  { to: 'saved', label: '收藏', icon: Compass },
  { to: 'compare', label: '决策', icon: NotebookPen },
  { to: 'bookings', label: '预订', icon: Receipt },
  { to: 'budget', label: '预算', icon: PiggyBank },
  { to: 'expenses', label: 'AA', icon: Wallet },
  { to: 'weather', label: '天气', icon: CloudSun },
  { to: 'group', label: '同伴', icon: Users },
  { to: 'notes', label: '笔记', icon: Settings2 },
]

export default function TripShell() {
  const { id } = useParams()
  const trip = useTrip(id)
  const nav = useNavigate()

  if (!trip) {
    return (
      <div className="p-10 text-center">
        <p>找不到这次旅行。</p>
        <button className="btn mt-4" onClick={() => nav('/')}>
          回到首页
        </button>
      </div>
    )
  }

  return (
    <div className={`theme-${trip.theme} min-h-screen`} style={{ background: 'var(--bg)' }}>
      <div className="mx-auto flex max-w-[1400px]">
        <aside className="sticky top-0 hidden h-screen w-[230px] shrink-0 flex-col border-r p-4 lg:flex" style={{ borderColor: 'var(--line)' }}>
          <button className="mb-6 flex items-center gap-2 text-left" onClick={() => nav('/')} data-guide="brand">
            <Mark />
            <div>
              <div className="display text-lg leading-none">BOOMVOY</div>
              <div className="mt-1 text-[11px]" style={{ color: 'var(--muted)' }}>
                一次旅行一个工作台
              </div>
            </div>
          </button>
          <div className="mb-4 px-1">
            <div className="display text-xl leading-tight">{trip.name}</div>
            <div className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
              {formatRange(trip.startDate, trip.endDate)}
            </div>
          </div>
          <nav className="flex flex-1 flex-col gap-0.5 overflow-auto" data-guide="trip-nav">
            {items.map((it) => (
              <NavLink
                key={it.to}
                end={it.end}
                to={it.to ? `/trip/${trip.id}/${it.to}` : `/trip/${trip.id}`}
                className={({ isActive }) =>
                  cls('flex items-center gap-2 rounded-xl px-3 py-2 text-sm no-underline', isActive ? 'btn-soft font-medium' : '')
                }
                style={{ color: 'var(--ink)' }}
                data-guide={it.to === 'plan' ? 'nav-plan' : it.to === 'map' ? 'nav-map' : it.to === 'compare' ? 'nav-compare' : it.to === 'weather' ? 'nav-weather' : it.to === '' ? 'nav-overview' : undefined}
              >
                <it.icon size={16} />
                {it.label}
              </NavLink>
            ))}
          </nav>
          <NavLink to={`/share/${trip.id}`} className="btn btn-ghost mt-3 text-sm no-underline">
            <Share2 size={15} /> 分享
          </NavLink>
        </aside>
        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b px-4 py-3 backdrop-blur lg:hidden" style={{ borderColor: 'var(--line)', background: 'color-mix(in srgb, var(--bg) 86%, transparent)' }}>
            <button onClick={() => nav('/')} className="text-sm" style={{ color: 'var(--muted)' }}>
              ← 旅行
            </button>
            <div className="display text-lg">{trip.name}</div>
            <NavLink to={`/share/${trip.id}`} className="text-sm" style={{ color: 'var(--ink)' }}>
              分享
            </NavLink>
          </header>
          <div className="px-4 py-6 pb-28 lg:px-8">
            <Outlet />
          </div>
          <nav
            className="fixed bottom-0 left-0 right-0 z-40 flex gap-1 overflow-auto border-t px-2 py-2 lg:hidden"
            style={{ background: 'var(--paper)', borderColor: 'var(--line)' }}
            data-guide="trip-nav"
          >
            {items.slice(0, 6).map((it) => (
              <NavLink
                key={it.to}
                end={it.end}
                to={it.to ? `/trip/${trip.id}/${it.to}` : `/trip/${trip.id}`}
                className={({ isActive }) =>
                  cls('flex min-w-[64px] flex-col items-center rounded-xl px-2 py-1 text-[11px] no-underline', isActive ? 'btn-soft' : '')
                }
                style={{ color: 'var(--ink)' }}
                data-guide={it.to === 'plan' ? 'nav-plan' : it.to === 'map' ? 'nav-map' : it.to === 'compare' ? 'nav-compare' : it.to === 'weather' ? 'nav-weather' : it.to === '' ? 'nav-overview' : undefined}
              >
                <it.icon size={16} />
                {it.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>
    </div>
  )
}
