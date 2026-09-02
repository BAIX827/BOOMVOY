import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { useApp } from './store'
import { uid } from './lib'
import { TRANSPORT } from './catalog'
import { suggestDays, type DaySuggestion } from './suggestions'
import { resolveLlm } from './llm'
import { hopMeta, mapsDayRoute, mapsPlaceUrl } from './geo'
import type { PlaceSetting, PlaceStop, WeatherSnap } from './types'
import { placeCatLabel, settingLabel, transportLabel, useT } from './i18n'

export default function DaySuggest({
  city,
  date,
  weather,
  existing,
  onApply,
  onReplace,
}: {
  city: string
  date?: string
  weather?: WeatherSnap
  existing: string[]
  onApply: (places: Omit<PlaceStop, 'id'>[]) => void
  onReplace: (places: PlaceStop[]) => void
}) {
  const profile = useApp((s) => s.profile)
  const llm = resolveLlm(profile)
  const { t } = useT()
  const [items, setItems] = useState<DaySuggestion[]>([])
  const [source, setSource] = useState<'local' | 'api'>('local')
  const [loading, setLoading] = useState(false)
  const [picked, setPicked] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    let live = true
    setLoading(true)
    setError('')
    suggestDays({
      city,
      date,
      weather,
      existing: [],
      llmUrl: llm.llmUrl,
      llmKey: llm.llmKey,
      llmModel: llm.llmModel,
    })
      .then((r) => {
        if (!live) return
        setItems(r.items)
        setSource(r.source)
        setPicked(0)
        setError(r.error ? t(`suggest.${r.error}`) : '')
      })
      .finally(() => {
        if (live) setLoading(false)
      })
    return () => {
      live = false
    }
  }, [city, date, weather?.rainProb, llm.llmUrl, llm.llmKey, llm.llmModel, t])

  const named = existing.map((n) => n.toLowerCase())
  const visible = items
    .map((s) => ({
      ...s,
      places: s.places.filter((p) => !named.includes(p.name.toLowerCase())),
    }))
    .filter((s) => s.places.length > 0)
  const current = visible[picked] || visible[0]

  if (loading) {
    return (
      <div className="paper p-5">
        <div className="flex items-center gap-2 text-sm">
          <Sparkles size={16} /> {t('suggest.loading', { city })}
        </div>
      </div>
    )
  }
  if (!current) return null

  return (
    <section className="paper overflow-hidden" data-guide="day-suggest">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4" style={{ borderColor: 'var(--line)' }}>
        <div>
          <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--muted)' }}>
            <Sparkles size={14} /> {source === 'api' ? t('suggest.fromApi') : error ? t('suggest.fallback') : t('suggest.local')}
          </div>
          {error && (
            <p className="mt-1 text-xs" style={{ color: 'var(--warn)' }}>
              {error}
            </p>
          )}
          <h3 className="display mt-1 text-2xl">{t('suggest.dayFor', { city })}</h3>
          <p className="hand mt-1 text-xl" style={{ color: 'var(--muted)' }}>
            {current.vibe}
          </p>
        </div>
        <span className="stamp">{current.rainFriendly ? 'Rain plan' : 'Clear day'}</span>
      </div>
      {visible.length > 1 && (
        <div className="flex flex-wrap gap-2 px-5 pt-3">
          {visible.map((s, i) => (
            <button key={s.title} className={i === picked ? 'btn px-3 py-1 text-xs' : 'btn btn-ghost px-3 py-1 text-xs'} onClick={() => setPicked(i)}>
              {s.title}
            </button>
          ))}
        </div>
      )}
      <ol className="space-y-2 px-5 py-4">
        {current.places.map((p, i) => {
          const next = current.places[i + 1]
          const hop = next ? hopMeta(p, next) : null
          const setting = (['outdoor', 'indoor', 'mixed'] as PlaceSetting[]).includes(p.setting as PlaceSetting)
            ? (p.setting as PlaceSetting)
            : 'mixed'
          return (
            <li key={p.name} className="flex items-start gap-3 text-sm">
              <span className="chip mt-0.5 min-w-10 justify-center">{p.time || `${i + 1}`}</span>
              <div className="min-w-0 flex-1">
                <div className="font-medium">{p.name}</div>
                <div style={{ color: 'var(--muted)' }}>
                  {placeCatLabel(t, p.category)} · {settingLabel(t, setting)}
                  {p.durationMin ? ` · ${p.durationMin} min` : ''}
                </div>
                {p.address && <div className="mt-0.5 text-xs" style={{ color: 'var(--muted)' }}>{p.address}</div>}
                <div className="mt-1 flex flex-wrap gap-2 text-xs">
                  {p.coords && (
                    <a className="underline" href={mapsPlaceUrl(p.name, p.coords)} target="_blank" rel="noreferrer">
                      {t('suggest.map')}
                    </a>
                  )}
                  {p.ticketNeeded && p.ticketUrl && (
                    <a className="underline" href={p.ticketUrl} target="_blank" rel="noreferrer">
                      {t('suggest.tickets')}
                    </a>
                  )}
                </div>
                {hop && (
                  <div className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
                    ↓ {TRANSPORT[hop.mode].icon} {transportLabel(t, hop.mode)} · {hop.km.toFixed(1)} km / {hop.minutes} min
                    {' · '}
                    <a className="underline" href={hop.url} target="_blank" rel="noreferrer">
                      {t('suggest.route')}
                    </a>
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ol>
      <div className="flex flex-wrap gap-2 px-5 pb-5">
        <button
          className="btn"
          onClick={() => {
            onApply(current.places)
            setPicked((n) => Math.min(n, Math.max(0, visible.length - 2)))
          }}
        >
          {t('suggest.add')}
        </button>
        {existing.length > 0 && (
          <button className="btn btn-ghost" onClick={() => onReplace(current.places.map((p) => ({ ...p, id: uid() })))}>
            {t('suggest.replace')}
          </button>
        )}
        {mapsDayRoute(current.places) && (
          <a className="btn btn-ghost no-underline" href={mapsDayRoute(current.places)} target="_blank" rel="noreferrer">
            {t('suggest.openRoute')}
          </a>
        )}
      </div>
    </section>
  )
}
