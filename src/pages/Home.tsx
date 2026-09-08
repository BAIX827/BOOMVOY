import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, BookOpen, CalendarDays, Compass, MapPin, Plus, Search, Users, X } from 'lucide-react'
import { useApp } from '../store'
import { formatRange, money, toISODate } from '../lib'
import { TRANSPORT } from '../catalog'
import { cityRoute } from '../domain'
import { transportLabel, useT } from '../i18n'
import { ThemeScene } from '../ThemeDecor'

type TripFilter = 'all' | 'upcoming' | 'past'

export default function Home() {
  const trips = useApp((s) => s.trips).filter((trip) => !trip.template)
  const themePref = useApp((s) => s.profile.themePref)
  const theme = themePref === 'auto' ? 'cream' : themePref
  const nav = useNavigate()
  const { t, locale } = useT()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<TripFilter>('all')
  const today = toISODate(new Date())
  const cities = new Set(trips.flatMap((trip) => trip.destinations))
  const totalDays = trips.reduce((sum, trip) => sum + trip.days.length, 0)
  const search = query.trim().toLocaleLowerCase()
  const visibleTrips = trips.filter((trip) => {
    const matchesStatus = filter === 'all' || (filter === 'upcoming' ? trip.endDate >= today : trip.endDate < today)
    return matchesStatus && (!search || [trip.name, trip.origin, ...trip.destinations].some((value) => value.toLocaleLowerCase().includes(search)))
  })

  return (
    <div className="home-page">
      <section className="journal-hero" aria-labelledby="home-heading">
        <div className="journal-hero-copy">
          <p className="journal-eyebrow"><span /> YOUR TRAVEL JOURNAL</p>
          <h1 id="home-heading" className="display journal-headline">{t('home.heroTitle')}<br /><span>{t('home.heroAccent')}</span></h1>
          <p className="journal-intro">{t('home.heroText')}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button className="btn" onClick={() => nav('/new')}><Plus size={17} />{t('home.newPage')}</button>
            <Link className="btn btn-ghost no-underline" to="/explore"><Compass size={17} />{t('home.findInspiration')}</Link>
          </div>
          <div className="journal-stats" aria-label={t('home.stats')}>
            {[{ value: trips.length, label: t('home.tripCount'), icon: BookOpen }, { value: cities.size, label: t('home.cityCount'), icon: MapPin }, { value: totalDays, label: t('home.dayCount'), icon: CalendarDays }].map(({ value, label, icon: Icon }) => (
              <div className="journal-stat" key={label}><Icon size={16} aria-hidden="true" /><strong>{value.toString().padStart(2, '0')}</strong><span>{label}</span></div>
            ))}
          </div>
        </div>
        <div className="journal-hero-art" aria-hidden="true">
          <div className="journal-orbit" />
          <div className="journal-postcard">
            <div className="postcard-top"><span>BOOMVOY · FIELD NOTES</span><Compass size={17} /></div>
            <ThemeScene theme={theme} />
            <div className="postcard-caption"><span className="hand">{t(`home.mood.${theme}`)}</span><span className="postcard-edition">VOL. 01<br />{theme.toUpperCase()}</span></div>
          </div>
          <span className="journal-stamp">LET'S<br />WANDER</span>
          <span className="journal-note hand">{t('home.collectMoments')}</span>
        </div>
      </section>

      <section className="journal-library" aria-labelledby="my-trips-heading">
        <div className="library-heading">
          <div><p className="journal-eyebrow">THE COLLECTION</p><h2 id="my-trips-heading" className="display text-3xl" data-guide="my-trips">{t('home.title')} <span className="library-count">{trips.length}</span></h2></div>
          {trips.length > 0 && <label className="journal-search"><Search size={17} aria-hidden="true" /><span className="sr-only">{t('home.search')}</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('home.search')} /></label>}
        </div>

        {trips.length > 0 && <div className="library-toolbar">
          <div className="journal-filters" role="group" aria-label={t('home.filter')}>
            {(['all', 'upcoming', 'past'] as const).map((value) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>{t(`home.filter.${value}`)}</button>)}
          </div>
          <span className="text-xs" style={{ color: 'var(--muted)' }} aria-live="polite">{t('home.showing', { n: visibleTrips.length })}</span>
        </div>}

        {trips.length === 0 ? (
          <div className="paper journal-empty">
            <span className="empty-icon"><BookOpen size={30} strokeWidth={1.5} /></span>
            <h3 className="display mt-5 text-2xl">{t('home.emptyTitle')}</h3>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6" style={{ color: 'var(--muted)' }}>{t('home.emptyText')}</p>
            <button className="btn mt-6" onClick={() => nav('/new')}><Plus size={16} />{t('home.create')}</button>
          </div>
        ) : visibleTrips.length === 0 ? (
          <div className="paper journal-empty"><Search size={28} className="mx-auto" /><h3 className="display mt-4 text-2xl">{t('home.noMatches')}</h3><p className="mt-2 text-sm" style={{ color: 'var(--muted)' }}>{t('home.noMatchesText')}</p><button className="btn btn-ghost mt-5" onClick={() => { setQuery(''); setFilter('all') }}><X size={15} />{t('home.clearFilters')}</button></div>
        ) : (
          <div className="trip-collection">
            {visibleTrips.map((trip, index) => {
              const route = cityRoute(trip)
              const status = trip.endDate < today ? 'past' : trip.startDate <= today ? 'active' : 'upcoming'
              return (
                <Link key={trip.id} to={`/trip/${trip.id}`} className="trip-journal-card no-underline" style={{ color: 'var(--ink)' }}>
                  <div className={`trip-card-cover theme-${trip.theme}`}>
                    <ThemeScene theme={trip.theme} />
                    <span className="trip-volume">JOURNAL / {String(index + 1).padStart(2, '0')}</span>
                    <span className={`trip-status trip-status-${status}`}><span />{t(`home.status.${status}`)}</span>
                    <div className="trip-cover-label"><MapPin size={13} />{trip.destinations[trip.destinations.length - 1] || trip.origin}</div>
                  </div>
                  <div className="trip-card-body">
                    <div className="trip-card-date"><CalendarDays size={14} />{formatRange(trip.startDate, trip.endDate, locale)}<span>{t('home.days', { n: trip.days.length })}</span></div>
                    <h3 className="display trip-card-title">{trip.name}</h3>
                    <div className="trip-card-route" aria-label={t('home.route')}>
                      {route.map((node, i) => <span key={node.city + node.start}><span className="route-dot" style={{ background: node.color }} />{node.city}{i < route.length - 1 && <ArrowRight size={12} aria-hidden="true" />}</span>)}
                    </div>
                    <div className="trip-card-meta"><span><Users size={14} />{t('home.people', { n: trip.travellers })}</span><span>{t('home.perPerson', { money: money(trip.budgetPerPerson, trip.homeCurrency) })}</span></div>
                    <div className="trip-card-footer"><div className="flex flex-wrap gap-1.5">{trip.transportModes.slice(0, 2).map((mode) => <span className="trip-transport" key={mode}>{TRANSPORT[mode].icon} {transportLabel(t, mode)}</span>)}</div><span className="trip-open" aria-label={t('home.open')}><ArrowRight size={18} /></span></div>
                  </div>
                </Link>
              )
            })}
            {!query && filter === 'all' && <button className="new-journal-card" onClick={() => nav('/new')}><span><Plus size={25} /></span><strong className="display text-xl">{t('home.nextChapter')}</strong><p>{t('home.nextChapterText')}</p><span className="new-journal-cta">{t('home.newPage')}<ArrowRight size={15} /></span></button>}
          </div>
        )}
      </section>
      <p className="journal-signoff hand">{t('home.signoff')}</p>
    </div>
  )
}
