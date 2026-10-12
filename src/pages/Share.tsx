import { useState } from 'react'
import { itineraryExport } from '../tripExport'
import { tripHref } from '../journey'
import { Link, useParams } from 'react-router-dom'
import { useTrip } from '../store'
import { CoverArt } from '../ui'
import { formatRange, money } from '../lib'
import { TRANSPORT, WEATHER } from '../catalog'
import { activePlaces, cityRoute } from '../domain'
import { Mark } from '../Shell'
import { transportLabel, useT } from '../i18n'

export default function Share() {
  const { id } = useParams()
  const trip = useTrip(id)
  const { t, locale } = useT()
  const [status, setStatus] = useState('')
  if (!trip) return <div className="p-10">{t('share.notFound')}</div>

  const route = cityRoute(trip)

  function exportTrip() {
    if (!trip) return
    const data = itineraryExport(trip)
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `boomvoy-trip-${trip.id}.json`
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    setStatus(t('journey.exportDone'))
  }

  return (
    <div className={`share-page theme-${trip.theme} min-h-screen px-4 py-10`}>
      <div className="mx-auto max-w-2xl">
        <div className="share-controls mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link to={tripHref(trip.id)} className="flex items-center gap-2 no-underline" style={{ color: 'var(--ink)' }}>
            <Mark />
            <span className="display text-xl">BOOMVOY</span>
          </Link>
          <div className="flex flex-wrap gap-2"><button className="btn" onClick={exportTrip}>{t('journey.exportTrip')}</button><button className="btn btn-ghost" onClick={() => window.print()}>{t('journey.printTrip')}</button></div>
        </div>
        <p className="share-controls mb-5 text-sm" style={{ color: 'var(--muted)' }}>{t('journey.shareHint')}</p>
        {status && <p className="share-controls mb-4 text-sm" role="status">{status}</p>}
        <article className="paper overflow-hidden">
          <CoverArt kind={trip.cover} title={trip.name} />
          <div className="p-6">
            <div className="text-sm" style={{ color: 'var(--muted)' }}>
              {formatRange(trip.startDate, trip.endDate, locale)} · {t('journey.sharePreview')}
            </div>
            <p className="mt-2 text-lg">
              {trip.origin} → {trip.destinations.join(' → ')} → {trip.origin}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="chip">{t('share.people', { n: trip.travellers })}</span>
              <span className="chip">{t('share.perPerson', { money: money(trip.budgetPerPerson, trip.homeCurrency) })}</span>
              {trip.transportModes.map((m) => (
                <span className="chip" key={m}>
                  {TRANSPORT[m].icon} {transportLabel(t, m)}
                </span>
              ))}
            </div>
            {trip.notes && <p className="mt-4 text-sm leading-7">{trip.notes}</p>}
          </div>
        </article>

        <ol className="paper mt-5 p-6">
          <h2 className="display mb-4 text-3xl">{t('share.route')}</h2>
          {route.map((n) => (
            <li key={n.city + n.start} className="relative border-l pb-5 pl-5" style={{ borderColor: 'var(--line)' }}>
              <span className="absolute -left-[7px] top-1 h-3.5 w-3.5 rounded-full" style={{ background: n.color }} />
              <div className="display text-2xl">{n.city}</div>
              <div className="text-sm" style={{ color: 'var(--muted)' }}>
                {t('share.nights', { date: n.start.slice(5), n: n.nights })} {n.stay ? `· ${n.stay}` : ''}
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
