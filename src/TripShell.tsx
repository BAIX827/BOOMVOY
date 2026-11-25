import { SharedStatus } from './CollaborationPanel'
import { useSharedTrip } from './useSharedTrip'
import { NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom'
import { BookOpen, Briefcase, Camera, CloudSun, Compass, LayoutGrid, Map, MoreHorizontal, NotebookPen, Receipt, Settings2, Share2, Users, Wallet, PiggyBank } from 'lucide-react'
import { useApp, useTrip } from './store'
import { cls, formatRange } from './lib'
import { Mark } from './Shell'
import { useLiveWeather } from './weather'
import { useT } from './i18n'
import { ThemeAtmosphere } from './ThemeDecor'
import { useTripContext } from './useTripContext'
import { TRIP_NAVIGATION, tripNavigationGroup } from './tripNavigation'

const NAV_GUIDE: Record<string, string> = { '': 'nav-overview', plan: 'nav-plan', notebook: 'nav-journal', pack: 'nav-pack', map: 'nav-map', journal: 'nav-journal', compare: 'nav-compare', weather: 'nav-weather' }
const PRIMARY_ICONS = { overview: LayoutGrid, plan: Map, notebook: BookOpen, more: MoreHorizontal }
const SECTION_ITEMS: Record<string, { label: string; icon: typeof Map }> = {
  plan: { label: 'journey.timeline', icon: BookOpen }, map: { label: 'trip.map', icon: Map },
  pack: { label: 'trip.pack', icon: Briefcase }, bookings: { label: 'trip.bookings', icon: Receipt }, journal: { label: 'trip.journal', icon: Camera },
  saved: { label: 'trip.saved', icon: Compass }, compare: { label: 'trip.compare', icon: NotebookPen }, weather: { label: 'trip.weather', icon: CloudSun },
  expenses: { label: 'trip.expenses', icon: Wallet }, budget: { label: 'trip.budget', icon: PiggyBank }, group: { label: 'trip.group', icon: Users }, notes: { label: 'journey.settings', icon: Settings2 },
}

export default function TripShell() {
  const { id } = useParams()
  const trip = useTrip(id)
  const allTrips = useApp((s) => s.trips)
  const switchable = allTrips.filter((entry) => !entry.template || entry.id === id)
  const nav = useNavigate()
  const location = useLocation()
  const { t, locale } = useT()
  const { href } = useTripContext(trip)
  useLiveWeather(trip)
  useSharedTrip(trip)
  const groups = TRIP_NAVIGATION.map((group) => ({ ...group, label: t(group.label), icon: PRIMARY_ICONS[group.icon], items: group.items.map((to) => ({ to, ...SECTION_ITEMS[to], label: t(SECTION_ITEMS[to].label) })) }))
  const section = location.pathname.split('/')[3] || ''
  const current = groups.find((group) => group.key === tripNavigationGroup(section).key)!
  if (!trip) return <div className="p-10 text-center"><p>{t('trip.notFound')}</p><button className="btn mt-4" onClick={() => nav('/')}>{t('trip.backHome')}</button></div>
  return (
    <div className={`theme-${trip.theme} relative isolate min-h-screen overflow-x-clip`}>
      <ThemeAtmosphere theme={trip.theme} />
      <a className="skip-link" href="#trip-content">{t('home.skipToContent')}</a>
      <div className="relative z-10 mx-auto flex max-w-[1400px]">
        <aside className="trip-sidebar sticky top-0 hidden h-screen w-[210px] shrink-0 flex-col border-r p-4 lg:flex" style={{ borderColor: 'var(--line)' }}>
          <button className="mb-6 flex items-center gap-2 text-left" onClick={() => nav('/')} data-guide="brand"><Mark /><div className="display text-lg leading-none">BOOMVOY</div></button>
          <div className="mb-6 px-1">{switchable.length > 1 ? <select className="trip-switch" aria-label={t('home.title')} value={trip.id} onChange={(event) => nav(`/trip/${event.target.value}`)}>{switchable.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select> : <div className="display break-words text-xl leading-tight">{trip.name}</div>}<div className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>{formatRange(trip.startDate, trip.endDate, locale)}</div></div>
          <nav className="trip-sidebar-nav flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto" aria-label={t('home.navigation')} data-guide="trip-nav">
            {groups.map((group) => <div key={group.key}>
              <NavLink end to={href(group.key)} className={cls('flex items-center gap-3 rounded-xl px-3 py-3 text-sm no-underline', current.key === group.key && 'btn-soft font-medium')} style={{ color: 'var(--ink)' }} data-guide={NAV_GUIDE[group.key]} aria-current={current.key === group.key ? 'page' : undefined}><group.icon size={18} />{group.label}</NavLink>
              {current.key === group.key && group.items.length > 0 && <div className="mt-1 ml-5 space-y-1 border-l pl-2" style={{ borderColor: 'var(--line)' }}>{group.items.map((item) => <NavLink key={item.to} to={href(item.to)} className={({ isActive }) => cls('block rounded-lg px-3 py-2 text-sm no-underline', isActive && 'btn-soft font-medium')} style={{ color: 'var(--ink)' }} data-guide={item.to !== group.key ? NAV_GUIDE[item.to] : undefined}>{item.label}</NavLink>)}</div>}
            </div>)}
          </nav>
          <NavLink to={`/share/${trip.id}`} className="btn btn-ghost mt-3 shrink-0 text-sm no-underline"><Share2 size={15} />{t('trip.share')}</NavLink>
        </aside>
        <div className="min-w-0 flex-1">
          <header className="trip-mobile-bar sticky top-0 z-30 flex items-center justify-between gap-3 border-b px-4 py-3 lg:hidden" style={{ borderColor: 'var(--line)' }}>
            <button onClick={() => nav('/')} className="min-h-11 shrink-0 text-sm" style={{ color: 'var(--muted)' }}>{t('trip.back')}</button><div className="display truncate text-lg">{trip.name}</div><span className="h-11 w-11 shrink-0" aria-hidden="true" />
          </header>
          {current.items.length > 0 && section !== 'notebook' && section !== 'more' && <nav className="trip-section-tabs flex gap-2 overflow-x-auto border-b px-4 py-3 lg:px-8" aria-label={current.label} style={{ borderColor: 'var(--line)' }}>{current.items.map((item) => <NavLink key={item.to} to={href(item.to)} className={({ isActive }) => cls('btn whitespace-nowrap text-sm no-underline', isActive ? 'btn-soft' : 'btn-ghost')} data-guide={NAV_GUIDE[item.to]}><item.icon size={16} />{item.label}</NavLink>)}</nav>}
          <main id="trip-content" tabIndex={-1} className="trip-main px-4 py-6 lg:px-8"><SharedStatus trip={trip} /><Outlet /></main>
          <nav className="trip-bottom-nav fixed bottom-0 left-0 right-0 z-40 grid grid-cols-4 gap-1 border-t px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] lg:hidden" style={{ background: 'var(--paper)', borderColor: 'var(--line)' }} aria-label={t('home.navigation')} data-guide="trip-nav">
            {groups.map((group) => <NavLink end key={group.key} to={href(group.key)} className={cls('flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1 text-xs no-underline', current.key === group.key && 'btn-soft font-medium')} style={{ color: 'var(--ink)' }} aria-current={current.key === group.key ? 'page' : undefined} data-guide={NAV_GUIDE[group.key]}><group.icon size={18} />{group.label}</NavLink>)}
          </nav>
        </div>
      </div>
    </div>
  )
}
