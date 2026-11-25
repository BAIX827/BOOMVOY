import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BookOpen, CalendarDays, ChevronLeft, ChevronRight, Compass, Plus, Search, Users, X } from 'lucide-react'
import DestinationArt from '../DestinationArt'
import { useApp } from '../store'
import { formatRange, toISODate } from '../lib'
import { resolveTripDay, tripHref } from '../journey'
import { useT } from '../i18n'
import type { Trip } from '../types'

type TripFilter = 'all' | 'upcoming' | 'past'

function TravelBook({ trip, today, first }: { trip: Trip; today: string; first: boolean }) {
  const { t, locale } = useT()
  const cities = [...new Set(trip.destinations)]
  const status = trip.endDate < today ? 'past' : trip.startDate <= today ? 'active' : 'upcoming'
  return <Link className={`pocket-book cover-${trip.theme}`} to={`/trip/${trip.id}`}>
    <div className="book-heading">
      <div className="book-status"><BookOpen size={15} />{t(`home.status.${status}`)}</div>
      <h2 className="display">{trip.name}</h2>
      <p>{cities.join(' · ') || trip.origin}</p>
    </div>
    <div className={`book-art ${cities.length > 1 ? 'book-art-pair' : ''}`}>
      <DestinationArt city={cities[0]} theme={trip.theme} eager={first} sizes="(max-width: 639px) 75vw, 430px" />
      {cities.length > 1 && <DestinationArt city={cities[1]} theme={trip.theme} eager={first} sizes="(max-width: 639px) 65vw, 340px" />}
    </div>
    <div className="book-foot">
      <div className="book-facts"><span><CalendarDays size={15} />{formatRange(trip.startDate, trip.endDate, locale)}</span><span><Users size={15} />{t('home.people', { n: trip.travellers })} · {t('home.days', { n: trip.days.length })}</span></div>
      <span className="book-open">{t('home.open')}<ArrowRight size={16} /></span>
    </div>
  </Link>
}

export default function Home() {
  const trips = useApp((s) => s.trips).filter((trip) => !trip.template)
  const { t } = useT()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<TripFilter>('all')
  const [position, setPosition] = useState(0)
  const shelf = useRef<HTMLDivElement>(null)
  const today = toISODate(new Date())
  const search = query.trim().toLocaleLowerCase()
  const visible = trips.filter((trip) => {
    const matchesStatus = filter === 'all' || (filter === 'upcoming' ? trip.endDate >= today : trip.endDate < today)
    return matchesStatus && (!search || [trip.name, trip.origin, ...trip.destinations].some((value) => value.toLocaleLowerCase().includes(search)))
  })
  const extras = !search && filter === 'all'
  const count = visible.length + (extras ? 2 : 0)
  const resume = trips.find((trip) => trip.startDate <= today && trip.endDate >= today) ||
    trips.filter((trip) => trip.startDate > today).sort((a, b) => a.startDate.localeCompare(b.startDate))[0]
  let remembered: string | null = null
  try { if (resume) remembered = localStorage.getItem(`boomvoy-day:${resume.id}`) } catch { /* Use the trip date when storage is unavailable. */ }
  const day = resume && resolveTripDay(resume, resume.days.find((entry) => entry.date === today)?.id, remembered, today)

  useEffect(() => {
    if (shelf.current) shelf.current.scrollLeft = 0
    setPosition(0)
  }, [search, filter, count])

  function turnBook(index: number) {
    const container = shelf.current
    const book = container?.children[index] as HTMLElement | undefined
    if (container && book) container.scrollTo({ left: book.offsetLeft - (container.firstElementChild as HTMLElement).offsetLeft })
  }

  function trackBook() {
    const container = shelf.current
    if (!container || !container.children.length) return
    const start = (container.firstElementChild as HTMLElement).offsetLeft
    const offsets = Array.from(container.children, (book) => Math.abs((book as HTMLElement).offsetLeft - start - container.scrollLeft))
    setPosition(offsets.indexOf(Math.min(...offsets)))
  }

  return <div className="pocket-library">
    <header className="library-heading">
      <h1 className="display shelf-title" data-guide="my-trips">{t('home.title')}</h1>
      {trips.length > 0 && <label className="journal-search"><Search size={17} /><span className="sr-only">{t('home.search')}</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('home.search')} /></label>}
    </header>
    {trips.length > 0 && <div className="library-toolbar">
      <div className="journal-filters" role="group" aria-label={t('home.filter')}>{(['all', 'upcoming', 'past'] as const).map((value) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>{t(`home.filter.${value}`)}</button>)}</div>
      <span className="notebook-caption" aria-live="polite">{t('home.showing', { n: visible.length })}</span>
    </div>}
    {count > 0 ? <>
      <div className="book-shelf" ref={shelf} onScroll={trackBook}>
        {visible.map((trip, i) => <TravelBook key={trip.id} trip={trip} today={today} first={i === 0} />)}
        {extras && <Link to="/explore" className="pocket-book atlas-book">
          <div className="book-heading"><Compass aria-hidden="true" size={22} /><h2 className="display">{t('shelf.atlas')}</h2></div>
          <DestinationArt city="Sydney" className="atlas-cover-art" sizes="(max-width: 639px) 75vw, 320px" />
          <span className="book-open">{t('nav.explore')}<ArrowRight size={16} /></span>
        </Link>}
        {extras && <Link to="/new" className="pocket-book blank-book">
          <div className="book-heading"><Plus aria-hidden="true" size={22} /><h2 className="display">{t('home.newPage')}</h2></div>
          <DestinationArt landscape="countryside" className="atlas-cover-art" sizes="(max-width: 639px) 75vw, 280px" />
          <span className="book-open">{t('shelf.start')}<ArrowRight size={16} /></span>
        </Link>}
      </div>
      {count > 1 && <div className="shelf-pager"><button type="button" disabled={position === 0} aria-label={t('shelf.prev')} onClick={() => turnBook(position - 1)}><ChevronLeft size={18} /></button><span aria-live="polite">{position + 1} / {count}</span><button type="button" disabled={position >= count - 1} aria-label={t('shelf.next')} onClick={() => turnBook(position + 1)}><ChevronRight size={18} /></button></div>}
    </> : <div className="paper journal-empty"><h2 className="display text-2xl">{t('home.noMatches')}</h2><button className="btn btn-ghost mt-4" onClick={() => { setQuery(''); setFilter('all') }}><X size={16} />{t('home.clearFilters')}</button></div>}
    {resume && <aside className="shelf-resume"><CalendarDays size={21} /><div><strong>{t(resume.startDate <= today ? 'journey.today' : 'journey.continue')} · {resume.name}</strong><p>{day?.city} · {day?.date}</p></div><Link to={tripHref(resume.id, 'plan', day?.id)}>{t('journey.open')}<ArrowRight size={16} /></Link></aside>}
  </div>
}
