import { useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useApp, useTrip } from '../store'
import { DAY_COLORS } from '../catalog'
import { activePlaces } from '../domain'
import { formatDay } from '../lib'
import { ensurePlaceGeo } from '../geo'
import TripMap, { type MapStop } from '../TripMap'
import { useT } from '../i18n'

export default function Journal() {
  const { id } = useParams()
  const trip = useTrip(id)
  const updatePlace = useApp((s) => s.updatePlace)
  const { t, locale } = useT()
  if (!trip) return null

  useEffect(() => {
    let live = true
    ;(async () => {
      for (const d of trip.days) {
        for (const p of activePlaces(d)) {
          if (!p.coords) {
            const g = await ensurePlaceGeo(d.city, p)
            if (g.coords && live) updatePlace(trip.id, d.id, d.activePlan, p.id, { coords: g.coords, address: g.address })
          }
        }
      }
    })()
    return () => {
      live = false
    }
  }, [trip.id])

  const stamped = useMemo(
    () =>
      trip.days.flatMap((d, i) =>
        activePlaces(d)
          .filter((p) => p.checkedIn)
          .map((p) => ({ day: d, place: p, color: DAY_COLORS[i % DAY_COLORS.length] })),
      ),
    [trip],
  )
  const allStops: MapStop[] = trip.days.flatMap((d, i) => {
    const color = DAY_COLORS[i % DAY_COLORS.length]
    return activePlaces(d)
      .filter((p) => p.coords)
      .map((p) => ({
        id: p.id,
        name: p.name,
        time: p.time,
        coords: p.coords!,
        color,
        checkedIn: p.checkedIn,
        feeling: p.feeling,
      }))
  })
  const total = trip.days.reduce((n, d) => n + activePlaces(d).length, 0)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="display text-4xl">{t('journal.title')}</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
          {t('journal.blurb')}
        </p>
      </div>
      <div className="paper p-5">
        <div className="display text-3xl">
          {stamped.length}/{total}
        </div>
        <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
          {t('journal.progress')}
        </p>
      </div>
      <div className="paper overflow-hidden p-3">
        <TripMap stops={allStops} empty={t('map.empty')} />
      </div>
      <div className="space-y-3">
        {stamped.length === 0 && (
          <div className="paper p-6 text-sm" style={{ color: 'var(--muted)' }}>
            {t('journal.empty')}
          </div>
        )}
        {stamped.map(({ day, place, color }) => (
          <article key={place.id} className="paper p-5">
            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--muted)' }}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
              {formatDay(day.date, locale)} · {day.city}
            </div>
            <h2 className="display mt-1 text-2xl">{place.name}</h2>
            {place.feeling && <p className="mt-2 text-sm leading-6">{place.feeling}</p>}
            {place.photos && place.photos.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {place.photos.map((src, i) => (
                  <img key={i} src={src} alt="" className="h-24 w-24 rounded-xl object-cover" />
                ))}
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  )
}
