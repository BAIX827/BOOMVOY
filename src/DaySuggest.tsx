import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { useApp } from './store'
import { uid } from './lib'
import { SETTING } from './catalog'
import { suggestDays, type DaySuggestion } from './suggestions'
import { resolveLlm } from './llm'
import type { PlaceStop, WeatherSnap } from './types'

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
        setError(r.error || '')
      })
      .finally(() => {
        if (live) setLoading(false)
      })
    return () => {
      live = false
    }
  }, [city, date, weather?.rainProb, llm.llmUrl, llm.llmKey, llm.llmModel])

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
          <Sparkles size={16} /> Boom 正在按 {city} 想一天…
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
            <Sparkles size={14} /> {source === 'api' ? '来自 OpenAI' : error ? 'API 暂时不可用，先用本地建议' : 'Boom 的本地建议'}
          </div>
          {error && (
            <p className="mt-1 text-xs" style={{ color: 'var(--warn)' }}>
              {error}
            </p>
          )}
          <h3 className="display mt-1 text-2xl">给 {city} 的这一天</h3>
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
        {current.places.map((p, i) => (
          <li key={p.name} className="flex items-start gap-3 text-sm">
            <span className="chip mt-0.5 min-w-10 justify-center">{p.time || `${i + 1}`}</span>
            <div className="min-w-0">
              <div className="font-medium">{p.name}</div>
              <div style={{ color: 'var(--muted)' }}>
                {p.category} · {(p.setting in SETTING ? SETTING[p.setting] : { label: p.setting }).label}
                {p.ticketNeeded ? ' · 门票' : ''}
                {p.durationMin ? ` · ${p.durationMin} min` : ''}
              </div>
            </div>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2 px-5 pb-5">
        <button
          className="btn"
          onClick={() => {
            onApply(current.places)
            setPicked((n) => Math.min(n, Math.max(0, visible.length - 2)))
          }}
        >
          一键加入计划表
        </button>
        {existing.length > 0 && (
          <button className="btn btn-ghost" onClick={() => onReplace(current.places.map((p) => ({ ...p, id: uid() })))}>
            换成这一套
          </button>
        )}
      </div>
    </section>
  )
}
