import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useApp, useTrip } from '../store'
import { DAY_COLORS, TRANSPORT } from '../catalog'
import { activePlaces, cityRoute, dayDistance } from '../domain'
import { formatDay } from '../lib'
import { ensurePlaceGeo, mapsDayRoute, mapsDirUrl, routeHop, type HopRoute } from '../geo'
import TripMap, { type MapLine, type MapStop } from '../TripMap'
import type { PlaceStop, TransportMode } from '../types'
import { transportLabel, useT } from '../i18n'

const HOP_MODES: TransportMode[] = ['walking', 'public', 'taxi', 'self-drive', 'cycling']

export default function MapPage() {
  const { id } = useParams()
  const trip = useTrip(id)
  const updatePlace = useApp((s) => s.updatePlace)
  const { t, locale } = useT()
  const [filter, setFilter] = useState<'all' | string>('all')
  const [routes, setRoutes] = useState<Record<string, HopRoute>>({})
  if (!trip) return null

  const days = filter === 'all' ? trip.days : trip.days.filter((d) => d.id === filter)

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

  useEffect(() => {
    let live = true
    ;(async () => {
      const next: Record<string, HopRoute> = {}
      for (const d of days) {
        const pts = activePlaces(d).filter((p) => p.coords)
        for (let i = 0; i < pts.length - 1; i++) {
          const a = pts[i]
          const b = pts[i + 1]
          const hop = await routeHop(a.coords!, b.coords!, a.transportToNext || 'public')
          if (!live) return
          next[`${a.id}-${b.id}`] = hop
        }
      }
      if (live) setRoutes(next)
    })()
    return () => {
      live = false
    }
  }, [days.map((d) => `${d.id}:${activePlaces(d).map((p) => `${p.id}:${p.transportToNext}`).join(',')}`).join('|')])

  const stops: MapStop[] = days.flatMap((d) => {
    const color = DAY_COLORS[trip.days.findIndex((x) => x.id === d.id) % DAY_COLORS.length]
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
  const lines: MapLine[] = Object.entries(routes).map(([id, hop]) => {
    const day = trip.days.find((d) => activePlaces(d).some((p) => id.startsWith(p.id)))
    const color = DAY_COLORS[Math.max(0, trip.days.findIndex((x) => x.id === day?.id)) % DAY_COLORS.length]
    return { id, color, pts: hop.geometry }
  })
  const route = cityRoute(trip)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="display text-4xl">{t('map.title')}</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
          {t('map.blurb')}
        </p>
      </div>
      <div className="flex gap-2 overflow-auto pb-1">
        <Chip active={filter === 'all'} onClick={() => setFilter('all')}>
          {t('map.all')}
        </Chip>
        {trip.days.map((d, i) => (
          <Chip key={d.id} active={filter === d.id} onClick={() => setFilter(d.id)} color={DAY_COLORS[i % DAY_COLORS.length]}>
            Day {i + 1} · {d.city}
          </Chip>
        ))}
      </div>

      <div className="paper overflow-hidden p-3">
        <TripMap stops={stops} lines={lines} empty={t('map.empty')} />
      </div>

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
          const dist = dayDistance(pts)
          return (
            <div key={d.id} className="paper p-5">
              <h2 className="display text-2xl">
                {d.city} · Plan {d.activePlan}
              </h2>
              <ol className="mt-3 space-y-3">
                {pts.map((p, i) => (
                  <li key={p.id} className="text-sm">
                    <div className="flex gap-3">
                      <span className="w-12" style={{ color: 'var(--muted)' }}>
                        {p.time || '—'}
                      </span>
                      <span className="flex-1 font-medium">{p.name}</span>
                      {p.checkedIn && <span className="chip">✓</span>}
                    </div>
                    {pts[i + 1] && (
                      <HopPick
                        from={p}
                        to={pts[i + 1]}
                        hop={routes[`${p.id}-${pts[i + 1].id}`]}
                        onMode={(mode) => updatePlace(trip.id, d.id, d.activePlan, p.id, { transportToNext: mode })}
                      />
                    )}
                  </li>
                ))}
              </ol>
              {dist.km > 0 && (
                <p className="mt-3 text-sm" style={{ color: 'var(--muted)' }}>
                  {t('map.dayKm', { km: dist.km.toFixed(1), min: dist.minutes })}
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
