import { Link, useParams } from 'react-router-dom'
import { useTrip } from '../store'
import { CoverArt, Progress, Tone } from '../ui'
import { BOOKING_STATUS, KINDS, TRANSPORT, WEATHER } from '../catalog'
import { formatRange, money } from '../lib'
import { bookingProgress, cityRoute, itineraryProgress, weatherAdvice } from '../domain'
import { flightLinks, tripFlightPlan } from '../bookingLinks'
import type { Trip } from '../types'

export default function Overview() {
  const { id } = useParams()
  const trip = useTrip(id)
  if (!trip) return null
  const route = cityRoute(trip)
  const booking = bookingProgress(trip)
  const itin = itineraryProgress(trip)
  const rainDay = trip.days.find((d) => weatherAdvice(d)?.suggestSwitch)

  return (
    <div className="space-y-6">
      <div className="paper overflow-hidden">
        <CoverArt kind={trip.cover} title={trip.name} />
        <div className="p-6">
          <div className="text-sm" style={{ color: 'var(--muted)' }}>
            {formatRange(trip.startDate, trip.endDate)}
          </div>
          <p className="mt-2 text-lg">
            {trip.origin} → {trip.destinations.join(' → ')}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="chip">👥 {trip.travellers} travellers</span>
            <span className="chip">💰 {money(trip.budgetPerPerson, trip.homeCurrency)} / person</span>
            {trip.transportModes.map((m) => (
              <span className="chip" key={m}>
                {TRANSPORT[m].icon} {TRANSPORT[m].label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {rainDay && (
        <Link to={`/trip/${trip.id}/weather`} className="paper block p-5 no-underline" style={{ color: 'var(--ink)' }}>
          <Tone tone="warn">天气备选</Tone>
          <div className="display mt-2 text-2xl">
            {rainDay.city} · {WEATHER[rainDay.weather.condition].icon} 降雨 {rainDay.weather.rainProb}%
          </div>
          <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
            {weatherAdvice(rainDay)?.text} 要不要切换到 Plan B？
          </p>
        </Link>
      )}

      <FlightJump trip={trip} />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="paper p-5">
          <div className="text-sm" style={{ color: 'var(--muted)' }}>
            Booking Progress
          </div>
          <div className="mt-4 space-y-3">
            {booking.map((b) => (
              <div key={b.kind}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>
                    {KINDS[b.kind].icon} {KINDS[b.kind].label}
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
            行程完成度
          </div>
          <div className="display mt-3 text-4xl">
            {itin.done}/{itin.total}
          </div>
          <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
            天已排地点
          </p>
          <div className="mt-4">
            <Progress value={itin.total ? (itin.done / itin.total) * 100 : 0} />
          </div>
          <Link to={`/trip/${trip.id}/plan`} className="btn mt-5 text-sm no-underline">
            去排行程
          </Link>
        </div>
      </div>

      <div className="paper p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="display text-3xl">Trip Route</h2>
          <Link to={`/trip/${trip.id}/map`} className="text-sm" style={{ color: 'var(--muted)' }}>
            打开地图 →
          </Link>
        </div>
        <ol className="relative ml-3">
          <li className="relative border-l pb-6 pl-6" style={{ borderColor: 'var(--line)' }}>
            <span className="absolute -left-[7px] top-1 h-3.5 w-3.5 rounded-full" style={{ background: 'var(--ink)' }} />
            <div className="text-xs uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
              出发
            </div>
            <div className="display text-2xl">{trip.origin}</div>
          </li>
          {route.map((n) => (
            <li key={n.city + n.start} className="relative border-l pb-6 pl-6 last:border-0" style={{ borderColor: 'var(--line)' }}>
              <span className="absolute -left-[7px] top-1 h-3.5 w-3.5 rounded-full" style={{ background: n.color }} />
              <div className="text-xs" style={{ color: 'var(--muted)' }}>
                {n.start.slice(5)} · {n.nights} 天 · {n.transport}
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
          最近预订
        </div>
        <div className="mt-3 divide-y" style={{ borderColor: 'var(--line)' }}>
          {trip.bookings.slice(0, 5).map((b) => (
            <div key={b.id} className="flex items-center justify-between py-3 text-sm">
              <span>
                {KINDS[b.kind].icon} {b.name}
              </span>
              <Tone tone={BOOKING_STATUS[b.status].tone}>{BOOKING_STATUS[b.status].label}</Tone>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function FlightJump({ trip }: { trip: Trip }) {
  const plan = tripFlightPlan(trip)
  const links = flightLinks(plan.outbound.from, plan.outbound.to, plan.outbound.date, trip)
  return (
    <div className="paper p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm" style={{ color: 'var(--muted)' }}>
            去搜机票
          </div>
          <div className="display mt-1 text-2xl">{plan.label}</div>
          <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
            一点就打开已经填好航线的比价网站。订完来预订中心打勾。
          </p>
        </div>
        <Link to={`/trip/${trip.id}/bookings`} className="text-sm" style={{ color: 'var(--muted)' }}>
          预订中心 →
        </Link>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {links.map((l) => (
          <a key={l.name} className="btn btn-soft px-3 py-1.5 text-xs no-underline" href={l.href} target="_blank" rel="noreferrer">
            {l.name} ↗
          </a>
        ))}
      </div>
    </div>
  )
}
