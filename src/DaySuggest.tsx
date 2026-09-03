import { useEffect, useRef, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { useApp } from './store'
import { uid, formatDay } from './lib'
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
  planned,
  onApply,
  onReplace,
}: {
  city: string
  date?: string
  weather?: WeatherSnap
  existing: string[]
  planned?: { name: string; date: string }[]
  onApply: (places: Omit<PlaceStop, 'id'>[]) => void
  onReplace: (places: PlaceStop[]) => void
}) {
  const profile = useApp((s) => s.profile)
  const llm = resolveLlm(profile)
  const { t, locale } = useT()
  const [items, setItems] = useState<DaySuggestion[]>([])
  const [source, setSource] = useState<'local' | 'api'>('local')
  const [loading, setLoading] = useState(false)
  const [asked, setAsked] = useState(false)
  const [picked, setPicked] = useState(0)
  const [error, setError] = useState('')

  const plannedAt = Object.fromEntries((planned || []).map((p) => [p.name.trim().toLowerCase(), p.date]))
  const gen = useRef(0)

  useEffect(() => {
    gen.current += 1
    setAsked(false)
    setItems([])
    setError('')
    setPicked(0)
    setLoading(false)
  }, [city, date])

  async function run() {
    const id = ++gen.current
    setAsked(true)
    setLoading(true)
    setError('')
    try {
      const r = await suggestDays({
        city,
        date,
        weather,
        existing,
        planned,
        llmUrl: llm.llmUrl,
        llmKey: llm.llmKey,
        llmModel: llm.llmModel,
      })
      if (id !== gen.current) return
      setItems(r.items)
      setSource(r.source)
      setPicked(0)
      setError(r.error ? t(`suggest.${r.error}`) : '')
    } finally {
      if (id === gen.current) setLoading(false)
    }
  }

  const current = items[picked] || items[0]
  const fresh = (current?.places || []).filter((p) => !plannedAt[p.name.trim().toLowerCase()])

  if (!asked && !loading) {
    return (
      <section className="paper p-5" data-guide="day-suggest">
        <button type="button" className="btn" data-guide="recommend" onClick={() => void run()}>
          <Sparkles size={16} /> {t('suggest.recommend')}
        </button>
      </section>
    )
  }

  if (loading) {
    return (
      <div className="paper p-5">
        <div className="flex items-center gap-2 text-sm">
          <Sparkles size={16} /> {t('suggest.loading', { city })}
        </div>
      </div>
    )
  }
  if (!current) {
    return (
      <section className="paper p-5" data-guide="day-suggest">
        {error && (
          <p className="mb-3 text-sm" style={{ color: 'var(--warn)' }}>
            {error}
          </p>
        )}
        <button type="button" className="btn" data-guide="recommend" onClick={() => void run()}>
          <Sparkles size={16} /> {t('suggest.recommend')}
        </button>
      </section>
    )
  }

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
          <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
            {t('suggest.socialHint')}
          </p>
        </div>
        <span className="stamp">{current.rainFriendly ? 'Rain plan' : 'Clear day'}</span>
      </div>
      {items.length > 1 && (
        <div className="flex flex-wrap gap-2 px-5 pt-3">
          {items.map((s, i) => (
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
          const already = plannedAt[p.name.trim().toLowerCase()]
          return (
            <li key={p.name} className="flex items-start gap-3 text-sm" style={{ opacity: already ? 0.55 : 1 }}>
              <span className="chip mt-0.5 min-w-10 justify-center">{p.time || `${i + 1}`}</span>
              <div className="min-w-0 flex-1">
                <div className="font-medium">{p.name}</div>
                <div style={{ color: 'var(--muted)' }}>
                  {placeCatLabel(t, p.category)} · {settingLabel(t, setting)}
                  {p.durationMin ? ` · ${p.durationMin} min` : ''}
                </div>
                {already && (
                  <div className="mt-0.5 text-xs" style={{ color: 'var(--accent)' }}>
                    {t('suggest.already', { date: formatDay(already, locale) })}
                  </div>
                )}
                {p.socialBuzz && !already && (
                  <div className="mt-0.5 text-xs" style={{ color: 'var(--accent)' }}>
                    {p.socialBuzz}
                  </div>
                )}
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
          disabled={fresh.length === 0}
          onClick={() => {
            onApply(fresh)
            setPicked((n) => Math.min(n, Math.max(0, items.length - 2)))
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