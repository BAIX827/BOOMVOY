import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Plus } from 'lucide-react'
import { useApp } from '../store'
import { CoverArt } from '../ui'
import { formatRange, money } from '../lib'
import { TRANSPORT } from '../catalog'
import { cityRoute } from '../domain'
import { transportLabel, useT } from '../i18n'

export default function Home() {
  const trips = useApp((s) => s.trips).filter((tr) => !tr.template)
  const nav = useNavigate()
  const { t, locale } = useT()

  return (
    <div>
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="hand text-2xl" style={{ color: 'var(--muted)' }}>
            {t('home.kicker')}
          </p>
          <h1 className="display mt-1 text-4xl sm:text-5xl" data-guide="my-trips">
            {t('home.title')}
          </h1>
        </div>
        <button className="btn" onClick={() => nav('/new')}>
          <Plus size={16} /> {t('home.newPage')}
        </button>
      </div>

      {trips.length === 0 ? (
        <div className="paper p-10 text-center">
          <span className="stamp">blank page</span>
          <div className="display mt-4 text-3xl">{t('home.emptyTitle')}</div>
          <p className="mt-2 text-sm" style={{ color: 'var(--muted)' }}>
            {t('home.emptyText')}
          </p>
          <button className="btn mt-5" onClick={() => nav('/new')}>
            {t('home.create')}
          </button>
        </div>
      ) : (
        <div className="grid gap-8 sm:grid-cols-2">
          {trips.map((trip) => {
            const route = cityRoute(trip)
            return (
              <Link key={trip.id} to={`/trip/${trip.id}`} className="scrap no-underline" style={{ color: 'var(--ink)' }}>
                <CoverArt kind={trip.cover} title={trip.name} polaroid />
                <div className="px-2 pt-4">
                  <div className="flex items-center justify-between gap-3 text-sm" style={{ color: 'var(--muted)' }}>
                    <span>{formatRange(trip.startDate, trip.endDate, locale)}</span>
                    <span>
                      {trip.origin} → {trip.destinations[trip.destinations.length - 1]}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="chip">👥 {t('home.people', { n: trip.travellers })}</span>
                    <span className="chip">{t('home.perPerson', { money: money(trip.budgetPerPerson, trip.homeCurrency) })}</span>
                    {trip.transportModes.slice(0, 3).map((m) => (
                      <span className="chip" key={m}>
                        {TRANSPORT[m].icon} {transportLabel(t, m)}
                      </span>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center gap-2 overflow-hidden text-sm">
                    {route.map((n, i) => (
                      <span key={n.city + n.start} className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ background: n.color }} />
                        {n.city}
                        {i < route.length - 1 && <span style={{ color: 'var(--muted)' }}>→</span>}
                      </span>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center justify-between text-sm">
                    <span className="hand text-lg" style={{ color: 'var(--muted)' }}>
                      {t('home.open')}
                    </span>
                    <ArrowRight size={16} />
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
