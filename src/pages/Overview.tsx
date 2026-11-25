import { Link, useParams } from 'react-router-dom'
import { ArrowRight, CalendarDays, Check, Map, Plus, Settings2, Users } from 'lucide-react'
import { useTrip } from '../store'
import { Progress, Tone } from '../ui'
import { KINDS, TRANSPORT, WEATHER } from '../catalog'
import { formatDay, formatRange } from '../lib'
import { activePlaces, bookingProgress, cityRoute, itineraryProgress, weatherAdvice } from '../domain'
import { flightLinks, lookupAir, tripFlightPlan } from '../bookingLinks'
import type { Trip } from '../types'
import { kindLabel, transportLabel, useT, weatherCompact, type TFn } from '../i18n'
import { nextJourneyAction, tripHref } from '../journey'
import { stayCoverage } from '../stayCoverage'
import { useTripContext } from '../useTripContext'
import DestinationArt from '../DestinationArt'
import Notebook from '../Notebook'

export default function Overview() {
  const { id } = useParams()
  const trip = useTrip(id)
  const { t, locale } = useT()
  const { day, selectDay, href } = useTripContext(trip)
  if (!trip) return null
  const route = cityRoute(trip)
  const booking = bookingProgress(trip)
  const stays = stayCoverage(trip)
  const itinerary = itineraryProgress(trip)
  const next = nextJourneyAction(trip)
  const rainDay = trip.days.find((entry) => weatherAdvice(entry, t)?.suggestSwitch)
  const stops = day ? activePlaces(day) : []
  const hasFlight = trip.transportModes.includes('flight') || !!lookupAir(trip.origin) && !!lookupAir(trip.destinations[0]) && lookupAir(trip.origin)?.iata !== lookupAir(trip.destinations[0])?.iata && trip.transportModes.some((mode) => mode === 'public' || mode === 'mixed')

  return <div className="field-overview">
    <header className="field-trip-heading">
      <div><h1 className="display">{trip.name}</h1><div className="field-trip-meta"><span><CalendarDays size={16} />{formatRange(trip.startDate, trip.endDate, locale)}</span><span>{t('home.days', { n: trip.days.length })}</span><span><Users size={16} />{t('overview.travellers', { n: trip.travellers })}</span></div></div>
      <Link className="btn btn-ghost no-underline" aria-label={t('journey.settings')} to={href('notes')}><Settings2 size={18} aria-hidden="true" /><span className="hidden sm:inline">{t('journey.settings')}</span></Link>
    </header>
    <div className="field-overview-grid">
      <div className="field-overview-main">
        <section className="route-canvas" aria-labelledby="route-heading">
          <div className="field-section-heading"><h2 id="route-heading" className="display"><span className="paper-highlight">{t('overview.route')}</span></h2><span className="notebook-caption">{t('notebook.routeSummary', { cities: route.length, days: trip.days.length })}</span></div>
          {route.length > 4 && <select className="field route-jump" aria-label={t('route.jump')} value="" onChange={(event) => {
            const target = document.getElementById(event.target.value)
            target?.focus({ preventScroll: true })
            target?.scrollIntoView({ block: 'center' })
          }}><option value="">{t('route.jump')}</option>{route.map((node, index) => <option key={node.start} value={`route-stop-${index}`}>{index + 1} · {node.city} · {formatDay(node.start, locale)}</option>)}</select>}
          {route.length === 0 ? <p className="p-5">{t('notebook.noRoute')}</p> : <ol className="canvas-stops" aria-label={t('overview.route')}>
            {route.map((node, index) => {
              const start = trip.days.findIndex((entry) => entry.date === node.start)
              const end = trip.days.findIndex((entry) => entry.date === node.end)
              const selected = !!day && day.date >= node.start && day.date <= node.end
              return <li key={`${node.city}-${node.start}`}><Link id={`route-stop-${index}`} className="canvas-stop" aria-current={selected ? 'step' : undefined} to={tripHref(trip.id, 'plan', selected ? day?.id : trip.days[start]?.id)}>
                <DestinationArt city={node.city} theme={trip.theme} sizes="(max-width: 639px) 49vw, 340px" eager={index < 2} />
                <span className="canvas-caption">
                  <span className="canvas-marker">{index + 1}</span>
                  <span className="canvas-label"><strong className="display">{node.city}</strong><small>{start === end ? t('notebook.day', { n: start + 1 }) : t('notebook.dayRange', { start: start + 1, end: end + 1 })} · {start === end ? formatDay(node.start, locale) : formatRange(node.start, node.end, locale)}</small></span>
                  <ArrowRight size={15} />
                </span>
              </Link></li>
            })}
          </ol>}
          <div className="route-footer"><span className="notebook-caption">{t('overview.depart')} · {trip.origin}</span><Link className="btn btn-ghost no-underline" to={href('map')}><Map size={17} />{t('notebook.viewRoute')}<ArrowRight size={15} /></Link></div>
        </section>
        <section className="field-next" aria-labelledby="next-action-title"><div><span className="notebook-caption">{t('journey.next')}</span><h2 id="next-action-title">{t(`journey.${next.kind}`, { n: next.count || 0 })}</h2></div><Link className="btn btn-ghost no-underline" to={tripHref(trip.id, next.section, next.day?.id)}>{t('journey.open')}<ArrowRight size={17} /></Link></section>
        <section className="paper field-day" aria-labelledby="day-heading">
          <div className="field-section-heading"><h2 id="day-heading" className="display"><span className="paper-highlight">{day ? `${formatDay(day.date, locale)} · ${day.city}` : t('journey.timeline')}</span></h2></div>
          {day && <div className="field-day-tools"><label><span className="sr-only">{t('notebook.dayLabel')}</span><select className="field" value={day.id} onChange={(event) => selectDay(event.target.value)}>{trip.days.map((entry) => <option value={entry.id} key={entry.id}>{formatDay(entry.date, locale)} · {entry.city}</option>)}</select></label><Link className="notebook-caption" to={href('weather')}>{weatherCompact(day.weather, t)}</Link></div>}
          {stops.length ? <ol className="field-timeline">{stops.map((place) => <li key={place.id}><span className={`timeline-dot ${place.checkedIn ? 'is-visited' : ''}`} aria-hidden="true">{place.checkedIn && <Check size={11} />}</span><Link to={tripHref(trip.id, 'plan', day?.id, place.id)}><time>{place.time || t('notebook.noTime')}</time><div><h3>{place.name}</h3>{place.notes && <p>{place.notes}</p>}</div><ArrowRight size={17} /></Link></li>)}</ol> : <p className="notebook-empty">{t('notebook.noStops')}</p>}
          <Link className="btn btn-ghost no-underline" to={href('plan')}><Plus size={18} />{t('notebook.addStop')}</Link>
        </section>
        {rainDay && <Link to={tripHref(trip.id, 'weather', rainDay.id)} className="paper block p-5 no-underline" style={{ color: 'var(--ink)' }}><Tone tone="warn">{t('overview.weatherAlt')}</Tone><h2 className="display mt-2 text-xl">{t('overview.rain', { city: rainDay.city, icon: WEATHER[rainDay.weather.condition].icon, n: rainDay.weather.rainProb })}</h2><p className="notebook-caption mt-2">{weatherAdvice(rainDay, t)?.text}</p></Link>}
        {hasFlight && <FlightJump trip={trip} t={t} locale={locale} />}
        <section className="paper field-preparation" aria-label={t('overview.booking')}>
          <div className="field-section-heading"><h2 className="display">{t('overview.booking')}</h2><Link className="notebook-link" to={href('bookings')}>{t('overview.bookingHub')}<ArrowRight size={15} /></Link></div>
          <div className="mt-5 space-y-4">{booking.map((entry) => <div key={entry.kind}><div className="mb-2 flex justify-between gap-3 text-sm"><span>{KINDS[entry.kind].icon} {kindLabel(t, entry.kind)}</span><span>{entry.kind === 'hotel' ? stays.total ? t('stay.coverage', { done: stays.done, total: stays.total }) : t('stay.noNights') : entry.total ? `${entry.done}/${entry.total}` : '—'}</span></div><Progress value={entry.kind === 'hotel' ? stays.total ? stays.done / stays.total * 100 : 100 : entry.total ? entry.done / entry.total * 100 : 0} />{entry.kind === 'hotel' && stays.missing.length > 0 && <Link className="mt-2 block text-sm underline" to={tripHref(trip.id, 'bookings', trip.days.find((item) => item.date === stays.missing[0])?.id)}>{t('stay.missing', { dates: stays.missing.map((date) => date.slice(5)).join(' · ') })}</Link>}{entry.kind === 'hotel' && stays.undated.length > 0 && <p className="notebook-caption mt-2">{t('stay.review', { names: stays.undated.join(' · ') })}</p>}</div>)}</div>
          <Link className="notebook-link mt-5" to={href('plan')}>{t('overview.itinerary')} · {itinerary.done}/{itinerary.total}<ArrowRight size={15} /></Link>
        </section>
        <details className="paper p-5"><summary className="cursor-pointer font-medium">{t('overview.route')}</summary><ol className="mt-4 space-y-5">{route.map((node) => <li key={`${node.city}-${node.start}`}><Link className="display text-xl" to={tripHref(trip.id, 'plan', trip.days.find((entry) => entry.date === node.start)?.id)}>{node.city}</Link><p className="notebook-caption mt-1">{formatRange(node.start, node.end, locale)} · {TRANSPORT[node.mode].icon} {transportLabel(t, node.mode)}</p>{node.stay && <p className="mt-2 text-sm">{node.stay}</p>}{node.weather && <p className="notebook-caption mt-1">{weatherCompact(node.weather, t)}</p>}</li>)}</ol></details>
      </div>
      <aside className="field-notebook-aside"><Notebook trip={trip} compact /></aside>
    </div>
  </div>
}

function FlightJump({ trip, t, locale }: { trip: Trip; t: TFn; locale: 'zh' | 'en' }) {
  const plan = tripFlightPlan(trip, locale)
  const primary = flightLinks(plan.outbound.from, plan.outbound.to, plan.outbound.date, trip, undefined, locale)[0]
  const fromCode = lookupAir(plan.outbound.from)?.iata || plan.outbound.from
  const toCode = lookupAir(plan.outbound.to)?.iata || plan.outbound.to
  return <article className="pass"><div className="pass-body"><Link className="notebook-caption" to={`/trip/${trip.id}/bookings`}>{t('overview.bookingHub')} · {plan.label}</Link><div className="pass-codes mt-2"><span>{fromCode}</span><span className="pass-arrow">→</span><span>{toCode}</span></div>{primary && <a className="btn mt-4 no-underline" href={primary.href} target="_blank" rel="noreferrer">{t('overview.openX', { name: primary.name })}</a>}</div></article>
}
