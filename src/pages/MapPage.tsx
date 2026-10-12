import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTripContext } from '../useTripContext'
import { useApp, useTrip } from '../store'
import { DAY_COLORS, TRANSPORT } from '../catalog'
import { activePlaces, cityRoute } from '../domain'
import { formatDay } from '../lib'
import { ensurePlaceGeo, mapsDayRoute, mapsDirUrl, routeHop, type HopRoute } from '../geo'
import TripMap, { type MapLine, type MapStop } from '../TripMap'
import type { PlaceStop, TransportMode } from '../types'
import { transportLabel, useT } from '../i18n'

const hopKey = (a: PlaceStop, b: PlaceStop) => `${a.id}:${a.coords?.lat},${a.coords?.lng}:${a.transportToNext || 'public'}-${b.id}:${b.coords?.lat},${b.coords?.lng}`

const HOP_MODES: TransportMode[] = ['walking', 'public', 'taxi', 'self-drive', 'cycling']

export default function MapPage() {
  const { id } = useParams()
  const trip = useTrip(id)
  const updatePlace = useApp((s) => s.updatePlace)
  const { t, locale } = useT()
  const { day: selectedDay, placeId, selectDay, selectPlace, allDays, showAllDays, href } = useTripContext(trip)
  const filter = allDays ? 'all' : selectedDay?.id
  const [routes, setRoutes] = useState<Record<string, HopRoute>>({})

  const days = filter === 'all' ? (trip?.days || []) : (trip?.days || []).filter((d) => d.id === filter)
  const geoFingerprint = (trip?.days || []).map((d) => `${d.id}:${d.city}:${d.activePlan}:${activePlaces(d)
    .map((p) => `${p.id}:${p.name}:${p.coords?.lat ?? ''},${p.coords?.lng ?? ''}`).join(',')}`).join('|')
  const routeFingerprint = days.map((d) => `${d.id}:${activePlaces(d)
    .map((p) => `${p.id}:${p.coords?.lat ?? ''},${p.coords?.lng ?? ''}:${p.transportToNext ?? ''}`).join(',')}`).join('|')

  useEffect(() => {
    let live = true
    ;(async () => {
      for (const d of days) {
        for (const p of activePlaces(d)) {
          if (!p.coords) {
            const g = await ensurePlaceGeo(d.city, p)
            if (g.coords && live) updatePlace(trip!.id, d.id, d.activePlan, p.id, { coords: g.coords, address: g.address })
          }
        }
      }
    })()
    return () => {
      live = false
    }
  }, [trip?.id, filter, geoFingerprint, updatePlace])

  useEffect(() => {
    let live = true
    ;(async () => {
      const jobs = days.flatMap((d) => {
        const pts = activePlaces(d)
        return pts.slice(0, -1).flatMap((a, index) => {
          const b = pts[index + 1]
          return a.coords && b.coords ? [{ a, b }] : []
        })
      })
      let cursor = 0
      await Promise.all(Array.from({ length: Math.min(4, jobs.length) }, async () => {
        while (cursor < jobs.length) {
          const { a, b } = jobs[cursor++]
          const hop = await routeHop(a.coords!, b.coords!, a.transportToNext || 'public')
          if (!live) return
          setRoutes((previous) => ({ ...previous, [hopKey(a, b)]: hop }))
        }
      }))
    })()
    return () => {
      live = false
    }
  }, [routeFingerprint])

  useEffect(() => { if (placeId) document.getElementById(`map-list-${placeId}`)?.scrollIntoView({ block: 'nearest', behavior: 'instant' }) }, [placeId])

  const stops: MapStop[] = days.flatMap((d) => {
    const dayIndex = (trip?.days || []).findIndex((x) => x.id === d.id)
    const color = DAY_COLORS[dayIndex % DAY_COLORS.length]
    return activePlaces(d)
      .map((p, index) => ({
        number: filter === 'all' ? `${dayIndex + 1}.${index + 1}` : String(index + 1),
        id: p.id,
        name: p.name,
        time: p.time,
        coords: p.coords!,
        color,
        checkedIn: p.checkedIn,
        feeling: p.feeling,
      })).filter((stop) => stop.coords)
  })
  const lines: MapLine[] = days.flatMap((day) => {
    const pts = activePlaces(day)
    const color = DAY_COLORS[(trip?.days || []).findIndex((entry) => entry.id === day.id) % DAY_COLORS.length]
    return pts.slice(0, -1).flatMap((place, index) => {
      const next = pts[index + 1], id = `${place.id}-${next.id}`, hop = routes[hopKey(place, next)]
      return place.coords && next.coords ? [{ id, color, pts: hop?.geometry || [[place.coords.lat, place.coords.lng], [next.coords.lat, next.coords.lng]] as [number, number][], estimated: !hop || hop.source === 'estimate' }] : []
    })
  })
  if (!trip) return null
  const route = cityRoute(trip)

  return (
    <div className="space-y-4">
      <h1 className="display text-4xl">{t('map.title')}</h1>
      <div className="flex gap-2 overflow-auto pb-1">
        <Chip active={filter === 'all'} onClick={() => showAllDays()}>
          {t('map.all')}
        </Chip>
        {(trip?.days || []).map((d, i) => (
          <Chip key={d.id} active={filter === d.id} onClick={() => selectDay(d.id)} color={DAY_COLORS[i % DAY_COLORS.length]}>
            Day {i + 1} · {d.city}
          </Chip>
        ))}
      </div>

      <div className="paper overflow-hidden p-3">
        <TripMap stops={stops} lines={lines} empty={t('journey.emptyMap')} selectedId={placeId} onSelect={(id) => { const day = trip.days.find((entry) => activePlaces(entry).some((place) => place.id === id)); selectPlace(id, day?.id) }} />
      </div>

      <p className="text-xs" style={{ color: 'var(--muted)' }}>{t('journey.numbered')}</p>
      {filter === 'all' ? (
        <div className="paper p-5">
          <h2 className="display text-2xl">{t('map.nodes')}</h2>
          <div className="mt-4 space-y-3">
            <div className="text-sm">{trip.origin}</div>
            {route.map((n) => (
              <div key={n.city + n.start} className="flex items-start gap-3">
                <span className="mt-1 h-3 w-3 rounded-full" style={{ background: n.color }} />
                <div>
                  <div className="font-medium">{n.city}</div>
                  <div className="text-sm" style={{ color: 'var(--muted)' }}>
                    {t('map.nights', {
                      date: formatDay(n.start, locale),
                      n: n.nights,
                      stay: n.stay || t('map.stayTbd'),
                      transport: `${TRANSPORT[n.mode].icon} ${transportLabel(t, n.mode)}`,
                    })}
                  </div>
                </div>
              </div>
            ))}
            <div className="text-sm">{t('map.return', { city: trip.origin })}</div>
          </div>
        </div>
      ) : (
        days.map((d) => {
          const pts = activePlaces(d)
          const hops = pts.slice(0, -1).map((point, index) => routes[hopKey(point, pts[index + 1])]).filter(Boolean)
          const routeKm = hops.reduce((sum, hop) => sum + hop.km, 0)
          const routeMinutes = hops.reduce((sum, hop) => sum + hop.minutes, 0)
          const estimated = hops.length < Math.max(0, pts.length - 1) || hops.some((hop) => hop.source === 'estimate')
          return (
            <div key={d.id} className="paper p-5">
              <h2 className="display text-2xl">
                {d.city} · Plan {d.activePlan}
              </h2>
              <Link className="btn btn-ghost mt-3 no-underline" to={href('plan', d.id)}>{t('journey.editDay')}</Link>
              <ol className="mt-3 space-y-3">
                {pts.map((p, i) => (
                  <li key={p.id} id={`map-list-${p.id}`} className="rounded-xl p-2 text-sm" style={{ background: placeId === p.id ? 'var(--accent-soft)' : undefined }}>
                    <div className="flex items-center gap-3">
                      <button className="route-stop-number" aria-label={`${i + 1}. ${p.name}`} aria-pressed={placeId === p.id} onClick={() => selectPlace(p.id)}>{i + 1}</button>
                      <span className="w-12" style={{ color: 'var(--muted)' }}>
                        {p.time || '—'}
                      </span>
                      <button className="flex-1 text-left font-medium" onClick={() => selectPlace(p.id)}>{p.name}</button>
                      {p.checkedIn && <span className="chip">✓</span>}
                    </div>
                    {pts[i + 1] && (
                      <HopPick
                        from={p}
                        to={pts[i + 1]}
                        hop={routes[hopKey(p, pts[i + 1])]}
                        onMode={(mode) => updatePlace(trip!.id, d.id, d.activePlan, p.id, { transportToNext: mode })}
                      />
                    )}
                  </li>
                ))}
              </ol>
              {routeKm > 0 && (
                <p className="mt-3 text-sm" style={{ color: 'var(--muted)' }}>
                  {t(estimated ? 'map.dayKmEstimate' : 'map.dayKmRoute', { km: routeKm.toFixed(1), min: routeMinutes })}
                </p>
              )}
              {mapsDayRoute(pts) && (
                <a className="btn mt-3 text-sm no-underline" href={mapsDayRoute(pts)} target="_blank" rel="noreferrer">
                  {t('map.google')}
                </a>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}

function HopPick({
  from,
  to,
  hop,
  onMode,
}: {
  from: PlaceStop
  to: PlaceStop
  hop?: HopRoute
  onMode: (m: TransportMode) => void
}) {
  const { t } = useT()
  const mode = from.transportToNext || 'public'
  const url = from.coords && to.coords ? mapsDirUrl(from.coords, to.coords, mode) : ''
  return (
    <div className="mt-2 ml-12 space-y-1">
      <div className="flex flex-wrap gap-1">
        {HOP_MODES.map((m) => (
          <button key={m} className={mode === m ? 'btn px-2 py-0.5 text-[11px]' : 'btn btn-ghost px-2 py-0.5 text-[11px]'} onClick={() => onMode(m)}>
            {TRANSPORT[m].icon} {transportLabel(t, m)}
          </button>
        ))}
      </div>
      <div className="text-xs" style={{ color: 'var(--muted)' }}>
        {hop
          ? t('map.hopEta', { km: hop.km.toFixed(1), min: hop.minutes })
          : t('map.hopWait')}
        {url && (
          <>
            {' · '}
            <a className="underline" href={url} target="_blank" rel="noreferrer">
              {t('map.google')}
            </a>
          </>
        )}
      </div>
    </div>
  )
}

function Chip({
  active,
  onClick,
  children,
  color,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  color?: string
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-full px-3 py-1.5 text-sm whitespace-nowrap"
      style={{
        background: active ? 'var(--ink)' : 'var(--paper)',
        color: active ? 'var(--paper)' : 'var(--ink)',
        border: '1px solid var(--line)',
        boxShadow: color && active ? `inset 0 -3px 0 ${color}` : undefined,
      }}
    >
      {children}
    </button>
  )
}
