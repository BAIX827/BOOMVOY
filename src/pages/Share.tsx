import { Link, useParams } from 'react-router-dom'
import { useTrip } from '../store'
import { CoverArt } from '../ui'
import { formatRange, money } from '../lib'
import { TRANSPORT, WEATHER } from '../catalog'
import { activePlaces, cityRoute } from '../domain'
import { Mark } from '../Shell'

export default function Share() {
  const { id } = useParams()
  const trip = useTrip(id)
  if (!trip) return <div className="p-10">找不到这条行程。</div>

  const route = cityRoute(trip)

  function copyLink() {
    navigator.clipboard.writeText(window.location.href)
  }

  return (
    <div className={`theme-${trip.theme} min-h-screen px-4 py-10`} style={{ background: 'var(--bg)' }}>
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 no-underline" style={{ color: 'var(--ink)' }}>
            <Mark />
            <span className="display text-xl">BOOMVOY</span>
          </Link>
          <button className="btn" onClick={copyLink}>
            复制链接
          </button>
        </div>
        <article className="paper overflow-hidden">
          <CoverArt kind={trip.cover} title={trip.name} />
          <div className="p-6">
            <div className="text-sm" style={{ color: 'var(--muted)' }}>
              {formatRange(trip.startDate, trip.endDate)} · {trip.share.visibility === 'public' ? '公开' : '朋友可见'}
            </div>
            <p className="mt-2 text-lg">
              {trip.origin} → {trip.destinations.join(' → ')} → {trip.origin}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="chip">{trip.travellers} 人</span>
              <span className="chip">{money(trip.budgetPerPerson, trip.homeCurrency)} / 人</span>
              {trip.transportModes.map((m) => (
                <span className="chip" key={m}>
                  {TRANSPORT[m].icon} {TRANSPORT[m].label}
                </span>
              ))}
            </div>
            {trip.notes && <p className="mt-4 text-sm leading-7">{trip.notes}</p>}
          </div>
        </article>

        <ol className="paper mt-5 p-6">
          <h2 className="display mb-4 text-3xl">路线</h2>
          {route.map((n) => (
            <li key={n.city + n.start} className="relative border-l pb-5 pl-5" style={{ borderColor: 'var(--line)' }}>
              <span className="absolute -left-[7px] top-1 h-3.5 w-3.5 rounded-full" style={{ background: n.color }} />
              <div className="display text-2xl">{n.city}</div>
              <div className="text-sm" style={{ color: 'var(--muted)' }}>
                {n.start.slice(5)} · {n.nights} 天 {n.stay ? `· ${n.stay}` : ''}
                {n.weather ? ` · ${WEATHER[n.weather.condition].icon}` : ''}
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-5 space-y-3">
          {trip.days.map((d, i) => (
            <section key={d.id} className="paper p-5">
              <h3 className="display text-2xl">
                Day {i + 1} · {d.city}
              </h3>
              <ol className="mt-2 space-y-1 text-sm">
                {activePlaces(d).map((p) => (
                  <li key={p.id}>
                    <span style={{ color: 'var(--muted)' }}>{p.time || '—'}</span> {p.name}
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
