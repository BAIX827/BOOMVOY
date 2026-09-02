import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useApp, useTrip } from '../store'
import { WEATHER } from '../catalog'
import { formatDayLong } from '../lib'
import { activePlaces, outdoorRatio, suggestedSwap, weatherAdvice } from '../domain'
import { Tone } from '../ui'
import { refreshTripWeather } from '../weather'
import { settingLabel, useT, weatherBlurb } from '../i18n'

export default function Weather() {
  const { id } = useParams()
  const trip = useTrip(id)
  const { setActivePlan, replacePlaces, patchDaysWeather } = useApp()
  const { t, locale } = useT()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (!trip) return null
  const current = trip

  async function refresh() {
    setBusy(true)
    setError('')
    try {
      const r = await refreshTripWeather(current, true, locale)
      if (r) patchDaysWeather(current.id, r.byKey, r.fetchedAt)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('wx.fail'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display text-4xl">{t('wx.title')}</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
            {t('wx.blurb')}
          </p>
        </div>
        <button className="btn" disabled={busy} onClick={refresh}>
          {busy ? t('wx.busy') : t('wx.refresh')}
        </button>
      </div>
      {error && (
        <p className="text-sm" style={{ color: 'var(--warn)' }}>
          {error}
        </p>
      )}
      {trip.weatherUpdatedAt && (
        <p className="text-xs" style={{ color: 'var(--muted)' }}>
          {t('wx.updated', { at: trip.weatherUpdatedAt.replace('T', ' ').slice(0, 16) })}
        </p>
      )}
      {trip.days.map((d, i) => {
        const places = activePlaces(d)
        const advice = weatherAdvice(d, t)
        const swap = suggestedSwap(d)
        return (
          <article key={d.id} className="paper p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm" style={{ color: 'var(--muted)' }}>
                  Day {i + 1} · {formatDayLong(d.date, locale)}
                </div>
                <h2 className="display text-3xl">
                  {d.city} {WEATHER[d.weather.condition].icon}
                </h2>
              </div>
              <div className="text-right">
                <div className="display text-2xl">
                  {d.weather.tMin}–{d.weather.tMax}°C
                </div>
                <div className="text-sm">{t('wx.rain', { n: d.weather.rainProb })}</div>
              </div>
            </div>
            <p className="mt-2 text-sm">{weatherBlurb(d.weather, t)}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              <span className="chip">{t('wx.plan', { plan: d.activePlan })}</span>
              <span className="chip">{t('wx.outdoor', { n: Math.round(outdoorRatio(places) * 100) })}</span>
              {places.map((p) => (
                <span className="chip" key={p.id}>
                  {p.time} {p.name} · {settingLabel(t, p.setting)}
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
                      {t('wx.switchB')}
                    </button>
                  )}
                  <button className="btn btn-ghost text-sm" onClick={() => setActivePlan(trip.id, d.id, 'A')}>
                    {t('wx.keepA')}
                  </button>
                </div>
              </div>
            )}
            {swap && d.activePlan === 'A' && (
              <div className="mt-3 text-sm">
                <div className="font-medium">{t('wx.reorder')}</div>
                <ol className="mt-1">
                  {swap.map((p) => (
                    <li key={p.id}>
                      {p.time} {p.name} ({settingLabel(t, p.setting)})
                    </li>
                  ))}
                </ol>
                <button className="btn btn-soft mt-2 text-sm" onClick={() => replacePlaces(trip.id, d.id, 'A', swap)}>
                  {t('wx.apply')}
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
