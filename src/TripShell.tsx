import { NavLink, Outlet, useNavigate, useParams } from 'react-router-dom'
import {
  BookOpen,
  Camera,
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
import { useLiveWeather } from './weather'
import { useT } from './i18n'
import { LangSwitch } from './ui'

const NAV_GUIDE: Record<string, string> = {
  '': 'nav-overview',
  plan: 'nav-plan',
  map: 'nav-map',
  journal: 'nav-journal',
  compare: 'nav-compare',
  weather: 'nav-weather',
}

export default function TripShell() {
  const { id } = useParams()
  const trip = useTrip(id)
  const nav = useNavigate()
  const { t, locale } = useT()
  useLiveWeather(trip)

  const items = [
    { to: '', label: t('trip.overview'), icon: LayoutGrid, end: true },
    { to: 'plan', label: t('trip.plan'), icon: BookOpen },
    { to: 'map', label: t('trip.map'), icon: Map },
    { to: 'journal', label: t('trip.journal'), icon: Camera },
    { to: 'saved', label: t('trip.saved'), icon: Compass },
    { to: 'compare', label: t('trip.compare'), icon: NotebookPen },
    { to: 'bookings', label: t('trip.bookings'), icon: Receipt },
    { to: 'budget', label: t('trip.budget'), icon: PiggyBank },
    { to: 'expenses', label: t('trip.expenses'), icon: Wallet },
    { to: 'weather', label: t('trip.weather'), icon: CloudSun },
    { to: 'group', label: t('trip.group'), icon: Users },
    { to: 'notes', label: t('trip.notes'), icon: Settings2 },
  ]

  if (!trip) {
    return (
      <div className="p-10 text-center">
        <p>{t('trip.notFound')}</p>
        <button className="btn mt-4" onClick={() => nav('/')}>
          {t('trip.backHome')}
        </button>
      </div>
    )
  }

  return (
    <div className={`theme-${trip.theme} min-h-screen`}>
      <div className="mx-auto flex max-w-[1400px]">
        <aside className="sticky top-0 hidden h-screen w-[230px] shrink-0 flex-col border-r p-4 lg:flex" style={{ borderColor: 'var(--line)' }}>
          <button className="mb-6 flex items-center gap-2 text-left" onClick={() => nav('/')} data-guide="brand">
            <Mark />
            <div>
              <div className="display text-lg leading-none">BOOMVOY</div>
              <div className="mt-1 text-[11px]" style={{ color: 'var(--muted)' }}>
                {t('brand.workspace')}
              </div>
            </div>
          </button>
          <div className="mb-4 px-1">
            <div className="display text-xl leading-tight">{trip.name}</div>
            <div className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
              {formatRange(trip.startDate, trip.endDate, locale)}
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
                data-guide={NAV_GUIDE[it.to]}
              >
                <it.icon size={16} />
                {it.label}
              </NavLink>
            ))}
          </nav>
          <NavLink to={`/share/${trip.id}`} className="btn btn-ghost mt-3 text-sm no-underline">
            <Share2 size={15} /> {t('trip.share')}
          </NavLink>
          <div className="mt-3">
            <LangSwitch compact />
          </div>
        </aside>
        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b px-4 py-3 backdrop-blur lg:hidden" style={{ borderColor: 'var(--line)', backgroundColor: 'color-mix(in srgb, var(--bg) 86%, transparent)' }}>
            <button onClick={() => nav('/')} className="text-sm" style={{ color: 'var(--muted)' }}>
              {t('trip.back')}
            </button>
            <div className="display text-lg">{trip.name}</div>
            <NavLink to={`/share/${trip.id}`} className="text-sm" style={{ color: 'var(--ink)' }}>
              {t('trip.share')}
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
            {items.slice(0, 7).map((it) => (
              <NavLink
                key={it.to}
                end={it.end}
                to={it.to ? `/trip/${trip.id}/${it.to}` : `/trip/${trip.id}`}
                className={({ isActive }) =>
                  cls('flex min-w-[64px] flex-col items-center rounded-xl px-2 py-1 text-[11px] no-underline', isActive ? 'btn-soft' : '')
                }
                style={{ color: 'var(--ink)' }}
                data-guide={NAV_GUIDE[it.to]}
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
