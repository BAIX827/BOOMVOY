import { useParams } from 'react-router-dom'
import { useApp, useTrip } from '../store'
import { SETTING, WEATHER } from '../catalog'
import { formatDayLong } from '../lib'
import { activePlaces, outdoorRatio, suggestedSwap, weatherAdvice } from '../domain'
import { Tone } from '../ui'

export default function Weather() {
  const { id } = useParams()
  const trip = useTrip(id)
  const { setActivePlan, replacePlaces } = useApp()
  if (!trip) return null

  return (
    <div className="space-y-4">
      <div>
        <h1 className="display text-4xl">天气感知</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
          天气不只是 22°C。它会检查当天户外比例，并问你要不要切到 Plan B。
        </p>
      </div>
      {trip.days.map((d, i) => {
        const places = activePlaces(d)
        const advice = weatherAdvice(d)
        const swap = suggestedSwap(d)
        return (
          <article key={d.id} className="paper p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm" style={{ color: 'var(--muted)' }}>
                  Day {i + 1} · {formatDayLong(d.date)}
                </div>
                <h2 className="display text-3xl">
                  {d.city} {WEATHER[d.weather.condition].icon}
                </h2>
              </div>
              <div className="text-right">
                <div className="display text-2xl">
                  {d.weather.tMin}–{d.weather.tMax}°C
                </div>
                <div className="text-sm">雨 {d.weather.rainProb}%</div>
              </div>
            </div>
            <p className="mt-2 text-sm">{d.weather.summary}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              <span className="chip">当前 Plan {d.activePlan}</span>
              <span className="chip">户外 {Math.round(outdoorRatio(places) * 100)}%</span>
              {places.map((p) => (
                <span className="chip" key={p.id}>
                  {p.time} {p.name} · {SETTING[p.setting].label}
                </span>
              ))}
            </div>
            {advice && (
              <div className="mt-4 rounded-2xl p-4" style={{ background: 'var(--accent-soft)' }}>
                <Tone tone={advice.level === 'warn' ? 'warn' : 'info'}>{advice.title}</Tone>
                <p className="mt-2 text-sm leading-6">{advice.text}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {advice.suggestSwitch && (
                    <button className="btn text-sm" onClick={() => setActivePlan(trip.id, d.id, 'B')}>
                      Switch to Rain Plan
                    </button>
                  )}
                  <button className="btn btn-ghost text-sm" onClick={() => setActivePlan(trip.id, d.id, 'A')}>
                    Keep Original
                  </button>
                </div>
              </div>
            )}
            {swap && d.activePlan === 'A' && (
              <div className="mt-3 text-sm">
                <div className="font-medium">自动重排建议</div>
                <ol className="mt-1">
                  {swap.map((p) => (
                    <li key={p.id}>
                      {p.time} {p.name} ({SETTING[p.setting].label})
                    </li>
                  ))}
                </ol>
                <button className="btn btn-soft mt-2 text-sm" onClick={() => replacePlaces(trip.id, d.id, 'A', swap)}>
                  Apply Changes
                </button>
              </div>
            )}
            {d.planB.length > 0 && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <PlanCol title="☀️ Plan A" items={d.planA.map((p) => p.name)} />
                <PlanCol title="🌧️ Plan B" items={d.planB.map((p) => p.name)} />
              </div>
            )}
          </article>
        )
      })}
    </div>
  )
}

function PlanCol({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl p-3" style={{ background: 'var(--bg-2)' }}>
      <div className="text-sm font-medium">{title}</div>
      <ul className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
        {items.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
    </div>
  )
}
