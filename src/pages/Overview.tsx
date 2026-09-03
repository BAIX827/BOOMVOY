import { Link, useParams } from 'react-router-dom'
import { useTrip } from '../store'
import { CoverArt, Progress, Tone } from '../ui'
import { BOOKING_STATUS, KINDS, TRANSPORT, WEATHER } from '../catalog'
import { formatRange, money } from '../lib'
import { bookingProgress, cityRoute, itineraryProgress, weatherAdvice } from '../domain'
import { flightLinks, lookupAir, tripFlightPlan } from '../bookingLinks'
import type { Trip } from '../types'
import { bookingStatusLabel, kindLabel, transportLabel, useT, type TFn } from '../i18n'

export default function Overview() {
  const { id } = useParams()
  const trip = useTrip(id)
  const { t, locale } = useT()
  if (!trip) return null
  const route = cityRoute(trip)
  const booking = bookingProgress(trip)
  const itin = itineraryProgress(trip)
  const rainDay = trip.days.find((d) => weatherAdvice(d, t)?.suggestSwitch)

  return (
    <div className="space-y-6">
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,280px)_1fr]">
        <CoverArt kind={trip.cover} title={trip.name} polaroid />
        <div className="pt-2">
          <span className="stamp">{trip.origin}</span>
          <div className="mt-4 text-sm" style={{ color: 'var(--muted)' }}>
            {formatRange(trip.startDate, trip.endDate, locale)}
          </div>
          <p className="hand mt-2 text-3xl leading-tight">
            {trip.origin} → {trip.destinations.join(' → ')}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="chip">👥 {t('overview.travellers', { n: trip.travellers })}</span>
            <span className="chip">💰 {t('overview.perPerson', { money: money(trip.budgetPerPerson, trip.homeCurrency) })}</span>
            {trip.transportModes.map((m) => (
              <span className="chip" key={m}>
                {TRANSPORT[m].icon} {transportLabel(t, m)}
              </span>
            ))}
          </div>
        </div>
      </div>

      {rainDay && (
        <Link to={`/trip/${trip.id}/weather`} className="paper block p-5 no-underline" style={{ color: 'var(--ink)' }}>
          <Tone tone="warn">{t('overview.weatherAlt')}</Tone>
          <div className="display mt-2 text-2xl">
            {t('overview.rain', { city: rainDay.city, icon: WEATHER[rainDay.weather.condition].icon, n: rainDay.weather.rainProb })}
          </div>
          <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
            {weatherAdvice(rainDay, t)?.text} {t('overview.switchB')}
          </p>
        </Link>
      )}

      <FlightJump trip={trip} t={t} locale={locale} />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="paper p-5">
          <div className="text-sm" style={{ color: 'var(--muted)' }}>
            {t('overview.booking')}
          </div>
          <div className="mt-4 space-y-3">
            {booking.map((b) => (
              <div key={b.kind}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>
                    {KINDS[b.kind].icon} {kindLabel(t, b.kind)}
                  </span>
                  <span>
                    {b.total === 0 ? '—' : b.done === b.total ? '✓' : `${b.done}/${b.total}`}
                  </span>
                </div>
                <Progress value={b.total ? (b.done / b.total) * 100 : 0} />
              </div>
            ))}
          </div>
        </div>
        <div className="paper p-5">
          <div className="text-sm" style={{ color: 'var(--muted)' }}>
            {t('overview.itinerary')}
          </div>
          <div className="display mt-3 text-4xl">
            {itin.done}/{itin.total}
          </div>
          <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
            {t('overview.daysPlanned')}
          </p>
          <div className="mt-4">
            <Progress value={itin.total ? (itin.done / itin.total) * 100 : 0} />
          </div>
          <Link to={`/trip/${trip.id}/plan`} className="btn mt-5 text-sm no-underline">
            {t('overview.goPlan')}
          </Link>
        </div>
      </div>

      <div className="paper p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="display text-3xl">{t('overview.route')}</h2>
          <Link to={`/trip/${trip.id}/journal`} className="text-sm" style={{ color: 'var(--muted)' }}>
            {t('overview.journal')}
          </Link>
        </div>
        <ol className="relative ml-3">
          <li className="relative border-l pb-6 pl-6" style={{ borderColor: 'var(--line)' }}>
            <span className="absolute -left-[7px] top-1 h-3.5 w-3.5 rounded-full" style={{ background: 'var(--ink)' }} />
            <div className="text-xs uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
              {t('overview.depart')}
            </div>
            <div className="display text-2xl">{trip.origin}</div>
          </li>
          {route.map((n) => (
            <li key={n.city + n.start} className="relative border-l pb-6 pl-6 last:border-0" style={{ borderColor: 'var(--line)' }}>
              <span className="absolute -left-[7px] top-1 h-3.5 w-3.5 rounded-full" style={{ background: n.color }} />
              <div className="text-xs" style={{ color: 'var(--muted)' }}>
                {t('overview.nights', {
                  date: n.start.slice(5),
                  n: n.nights,
                  transport: `${TRANSPORT[n.mode].icon} ${transportLabel(t, n.mode)}`,
                })}
              </div>
              <div className="display text-2xl">{n.city}</div>
              <div className="mt-1 flex flex-wrap gap-2 text-sm">
                {n.stay && <span className="chip">🏨 {n.stay}</span>}
                {n.weather && (
                  <span className="chip">
                    {WEATHER[n.weather.condition].icon} {n.weather.tMin}–{n.weather.tMax}°C
                  </span>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="paper p-5">
        <div className="text-sm" style={{ color: 'var(--muted)' }}>
          {t('overview.recent')}
        </div>
        <div className="mt-3 divide-y" style={{ borderColor: 'var(--line)' }}>
          {trip.bookings.slice(0, 5).map((b) => (
            <div key={b.id} className="flex items-center justify-between py-3 text-sm">
              <span>
                {KINDS[b.kind].icon} {b.name}
              </span>
              <Tone tone={BOOKING_STATUS[b.status].tone}>{bookingStatusLabel(t, b.status)}</Tone>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function FlightJump({ trip, t, locale }: { trip: Trip; t: TFn; locale: 'zh' | 'en' }) {
  const plan = tripFlightPlan(trip, locale)
  const links = flightLinks(plan.outbound.from, plan.outbound.to, plan.outbound.date, trip, undefined, locale)
  const primary = links[0]
  const fromCode = lookupAir(plan.outbound.from)?.iata || plan.outbound.from.slice(0, 3).toUpperCase()
  const toCode = lookupAir(plan.outbound.to)?.iata || plan.outbound.to.slice(0, 3).toUpperCase()
  return (
    <article className="pass">
      <div className="pass-body">
        <div className="flex items-start justify-between gap-3">
          <div className="text-[11px] tracking-[0.18em]" style={{ color: 'var(--muted)' }}>
            BOARDING · {plan.label}
          </div>
          <Link to={`/trip/${trip.id}/bookings`} className="text-xs no-underline" style={{ color: 'var(--muted)' }}>
            {t('overview.bookingHub')}
          </Link>
        </div>
        <div className="pass-codes mt-2">
          <span>{fromCode}</span>
          <span className="pass-arrow">→</span>
          <span>{toCode}</span>
        </div>
        <p className="mt-2 text-sm" style={{ color: 'var(--muted)' }}>
          {t('overview.flyHint')}
        </p>
        {primary && (
          <a className="btn mt-4 no-underline" href={primary.href} target="_blank" rel="noreferrer">
            {t('overview.openX', { name: primary.name })}
          </a>
        )}
      </div>
      <div className="pass-stub">FLY</div>
    </article>
  )
}
