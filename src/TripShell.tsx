import { NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom'
import { BookOpen, Briefcase, Camera, CloudSun, Compass, LayoutGrid, Map, MoreHorizontal, NotebookPen, Receipt, Settings2, Share2, Users, Wallet, PiggyBank } from 'lucide-react'
import { useTrip } from './store'
import { cls, formatRange } from './lib'
import { Mark } from './Shell'
import { useLiveWeather } from './weather'
import { useT } from './i18n'
import { LangSwitch } from './ui'
import { ThemeAtmosphere } from './ThemeDecor'
import { useTripContext } from './useTripContext'

const NAV_GUIDE: Record<string, string> = { '': 'nav-overview', plan: 'nav-plan', pack: 'nav-pack', map: 'nav-map', journal: 'nav-journal', compare: 'nav-compare', weather: 'nav-weather' }

export default function TripShell() {
  const { id } = useParams()
  const trip = useTrip(id)
  const nav = useNavigate()
  const location = useLocation()
  const { t, locale } = useT()
  const { href } = useTripContext(trip)
  useLiveWeather(trip)
  const groups = [
    { key: '', label: t('trip.overview'), icon: LayoutGrid, items: [] },
    { key: 'plan', label: t('trip.plan'), icon: BookOpen, items: [
      { to: 'plan', label: t('journey.timeline'), icon: BookOpen }, { to: 'map', label: t('trip.map'), icon: Map }, { to: 'weather', label: t('trip.weather'), icon: CloudSun },
    ] },
    { key: 'saved', label: t('journey.prepare'), icon: Briefcase, items: [
      { to: 'saved', label: t('trip.saved'), icon: Compass }, { to: 'compare', label: t('trip.compare'), icon: NotebookPen }, { to: 'bookings', label: t('trip.bookings'), icon: Receipt }, { to: 'pack', label: t('trip.pack'), icon: Briefcase },
    ] },
    { key: 'expenses', label: t('journey.money'), icon: Wallet, items: [
      { to: 'expenses', label: t('trip.expenses'), icon: Wallet }, { to: 'budget', label: t('trip.budget'), icon: PiggyBank },
    ] },
    { key: 'journal', label: t('trip.more'), icon: MoreHorizontal, items: [
      { to: 'journal', label: t('trip.journal'), icon: Camera }, { to: 'group', label: t('trip.group'), icon: Users }, { to: 'notes', label: t('journey.settings'), icon: Settings2 },
    ] },
  ]
  const section = location.pathname.split('/')[3] || ''
  const current = groups.find((group) => group.key === section || group.items.some((item) => item.to === section)) || groups[0]
  if (!trip) return <div className="p-10 text-center"><p>{t('trip.notFound')}</p><button className="btn mt-4" onClick={() => nav('/')}>{t('trip.backHome')}</button></div>
  return (
    <div className={`theme-${trip.theme} relative isolate min-h-screen overflow-x-clip`}>
      <ThemeAtmosphere theme={trip.theme} />
      <a className="skip-link" href="#trip-content">{t('home.skipToContent')}</a>
      <div className="relative z-10 mx-auto flex max-w-[1400px]">
        <aside className="sticky top-0 hidden h-screen w-[210px] shrink-0 flex-col border-r p-4 lg:flex" style={{ borderColor: 'var(--line)' }}>
          <button className="mb-6 flex items-center gap-2 text-left" onClick={() => nav('/')} data-guide="brand"><Mark /><div><div className="display text-lg leading-none">BOOMVOY</div><div className="mt-1 text-[11px]" style={{ color: 'var(--muted)' }}>{t('brand.workspace')}</div></div></button>
          <div className="mb-6 px-1"><div className="display text-xl leading-tight">{trip.name}</div><div className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>{formatRange(trip.startDate, trip.endDate, locale)}</div></div>
          <nav className="flex flex-1 flex-col gap-2" aria-label={t('home.navigation')} data-guide="trip-nav">
            {groups.map((group) => <div key={group.key}>
              <NavLink end to={href(group.key)} className={cls('flex items-center gap-3 rounded-xl px-3 py-3 text-sm no-underline', current.key === group.key && 'btn-soft font-medium')} style={{ color: 'var(--ink)' }} data-guide={NAV_GUIDE[group.key]} aria-current={current.key === group.key ? 'page' : undefined}><group.icon size={18} />{group.label}</NavLink>
              {current.key === group.key && group.items.length > 0 && <div className="mt-1 ml-5 space-y-1 border-l pl-2" style={{ borderColor: 'var(--line)' }}>{group.items.map((item) => <NavLink key={item.to} to={href(item.to)} className={({ isActive }) => cls('block rounded-lg px-3 py-2 text-sm no-underline', isActive && 'btn-soft font-medium')} style={{ color: 'var(--ink)' }} data-guide={item.to !== group.key ? NAV_GUIDE[item.to] : undefined}>{item.label}</NavLink>)}</div>}
            </div>)}
          </nav>
          <NavLink to={`/share/${trip.id}`} className="btn btn-ghost mt-3 text-sm no-underline"><Share2 size={15} />{t('trip.share')}</NavLink>
          <div className="mt-3"><LangSwitch compact /></div>
        </aside>
        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b px-4 py-3 backdrop-blur lg:hidden" style={{ borderColor: 'var(--line)', backgroundColor: 'color-mix(in srgb, var(--bg) 92%, transparent)' }}>
            <button onClick={() => nav('/')} className="shrink-0 text-sm" style={{ color: 'var(--muted)' }}>{t('trip.back')}</button><div className="display truncate text-lg">{trip.name}</div><NavLink to={`/share/${trip.id}`} className="shrink-0 text-sm" style={{ color: 'var(--ink)' }}>{t('trip.share')}</NavLink>
          </header>
          {current.items.length > 0 && <nav className="trip-section-tabs flex gap-2 overflow-x-auto border-b px-4 py-3 lg:px-8" aria-label={current.label} style={{ borderColor: 'var(--line)' }}>{current.items.map((item) => <NavLink key={item.to} to={href(item.to)} className={({ isActive }) => cls('btn whitespace-nowrap text-sm no-underline', isActive ? 'btn-soft' : 'btn-ghost')} data-guide={NAV_GUIDE[item.to]}><item.icon size={16} />{item.label}</NavLink>)}</nav>}
          <main id="trip-content" tabIndex={-1} className="px-4 py-6 pb-28 lg:px-8"><Outlet /></main>
          <nav className="fixed bottom-0 left-0 right-0 z-40 grid grid-cols-5 gap-1 border-t px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] lg:hidden" style={{ background: 'var(--paper)', borderColor: 'var(--line)' }} aria-label={t('home.navigation')} data-guide="trip-nav">
            {groups.map((group) => <NavLink end key={group.key} to={href(group.key)} className={cls('flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1 text-xs no-underline', current.key === group.key && 'btn-soft font-medium')} style={{ color: 'var(--ink)' }} aria-current={current.key === group.key ? 'page' : undefined} data-guide={NAV_GUIDE[group.key]}><group.icon size={18} />{group.label}</NavLink>)}
          </nav>
        </div>
      </div>
    </div>
  )
}
