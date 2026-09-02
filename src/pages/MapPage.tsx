import { useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { useTrip } from '../store'
import { DAY_COLORS, TRANSPORT, WEATHER } from '../catalog'
import { activePlaces, cityRoute, dayDistance } from '../domain'
import { formatDay } from '../lib'
import type { Coords } from '../types'

export default function MapPage() {
  const { id } = useParams()
  const trip = useTrip(id)
  const [filter, setFilter] = useState<'all' | string>('all')
  if (!trip) return null

  const days = filter === 'all' ? trip.days : trip.days.filter((d) => d.id === filter)
  const layers = days.map((d) => {
    const pts = activePlaces(d).filter((p) => p.coords)
    const color = DAY_COLORS[trip.days.findIndex((x) => x.id === d.id) % DAY_COLORS.length]
    return { day: d, pts, color }
  })
  const allPts = layers.flatMap((l) => l.pts.map((p) => p.coords!))
  const route = cityRoute(trip)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="display text-4xl">路线图</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
          规划完成后，一眼看出有没有绕路、某一天跨度是不是太大。
        </p>
      </div>
      <div className="flex gap-2 overflow-auto pb-1">
        <Chip active={filter === 'all'} onClick={() => setFilter('all')}>
          All Trip
        </Chip>
        {trip.days.map((d, i) => (
          <Chip key={d.id} active={filter === d.id} onClick={() => setFilter(d.id)} color={DAY_COLORS[i % DAY_COLORS.length]}>
            Day {i + 1} · {d.city}
          </Chip>
        ))}
      </div>

      <div className="paper overflow-hidden p-3">
        <RouteCanvas points={allPts} layers={layers} />
      </div>

      {filter === 'all' ? (
        <div className="paper p-5">
          <h2 className="display text-2xl">全旅行节点</h2>
          <div className="mt-4 space-y-3">
            <div className="text-sm">{trip.origin}</div>
            {route.map((n) => (
              <div key={n.city + n.start} className="flex items-start gap-3">
                <span className="mt-1 h-3 w-3 rounded-full" style={{ background: n.color }} />
                <div>
                  <div className="font-medium">{n.city}</div>
                  <div className="text-sm" style={{ color: 'var(--muted)' }}>
                    {formatDay(n.start)} · {n.nights} 天 · {n.stay || '住宿待定'} · {n.transport}
                    {n.weather && ` · ${WEATHER[n.weather.condition].icon} ${n.weather.tMin}–${n.weather.tMax}°`}
                  </div>
                </div>
              </div>
            ))}
            <div className="text-sm">{trip.origin} 返程</div>
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
              <ol className="mt-3 space-y-2">
                {pts.map((p, i) => (
                  <li key={p.id} className="flex gap-3 text-sm">
                    <span className="w-12" style={{ color: 'var(--muted)' }}>
                      {p.time || '—'}
                    </span>
                    <span className="flex-1">{p.name}</span>
                    {pts[i + 1] && (
                      <span style={{ color: 'var(--muted)' }}>{TRANSPORT[p.transportToNext || 'public'].icon}</span>
                    )}
                  </li>
                ))}
              </ol>
              {dist.km > 0 && (
                <p className="mt-3 text-sm" style={{ color: 'var(--muted)' }}>
                  当天连线约 {dist.km.toFixed(1)} km，{dist.minutes} 分钟（粗估）
                </p>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}

function RouteCanvas({
  points,
  layers,
}: {
  points: Coords[]
  layers: { color: string; pts: { id: string; name: string; time?: string; coords?: Coords }[] }[]
}) {
  const w = 900
  const h = 520
  const pad = 48
  if (!points.length) {
    return (
      <div className="grid h-[420px] place-items-center text-sm" style={{ color: 'var(--muted)' }}>
        这一天还没有带坐标的地点。添加地点时搜一下，就会出现在路线上。
      </div>
    )
  }
  const lats = points.map((p) => p.lat)
  const lngs = points.map((p) => p.lng)
  const minLat = Math.min(...lats) - 0.08
  const maxLat = Math.max(...lats) + 0.08
  const minLng = Math.min(...lngs) - 0.08
  const maxLng = Math.max(...lngs) + 0.08
  const xy = (c: Coords) => ({
    x: pad + ((c.lng - minLng) / (maxLng - minLng || 1)) * (w - pad * 2),
    y: pad + ((maxLat - c.lat) / (maxLat - minLat || 1)) * (h - pad * 2),
  })

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-[min(520px,70vh)] w-full rounded-[18px]" style={{ background: 'var(--map)' }}>
      {layers.map((l, li) => {
        const pts = l.pts.filter((p) => p.coords).map((p) => xy(p.coords!))
        const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
        return (
          <g key={li}>
            {pts.length > 1 && <path d={d} fill="none" stroke={l.color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />}
            {l.pts.map((p, idx) => {
              if (!p.coords) return null
              const pos = xy(p.coords)
              return (
                <g key={p.id}>
                  <circle cx={pos.x} cy={pos.y} r={idx === 0 || idx === l.pts.length - 1 ? 8 : 6} fill={l.color} stroke="white" strokeWidth="2" />
                  <text x={pos.x + 10} y={pos.y - 8} fontSize="11" fill="currentColor">
                    {p.time ? `${p.time} ` : ''}
                    {p.name}
                  </text>
                </g>
              )
            })}
          </g>
        )
      })}
    </svg>
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
  children: ReactNode
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
