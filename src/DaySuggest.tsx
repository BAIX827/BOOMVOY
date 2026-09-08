import { useEffect, useMemo, useRef, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { useApp } from './store'
import { belongsToRecommendationCity, enrichSuggestedPlaces, suggestionContextKey, suggestDays, type DaySuggestion } from './suggestions'
import { backendEndpoint, resolveBackend } from './llm'
import { mapsDayRoute, mapsPlaceUrl } from './geo'
import type { PlaceStop, PlanVariant, TransportMode, WeatherSnap } from './types'
import { placeCatLabel, settingLabel, transportLabel, useT } from './i18n'
import { Modal } from './ui'
import { DEFAULT_RECOMMENDATION_PREFERENCES, samePlace, scheduleSuggestion, type PlannedPlace, type RecommendationPreferences } from './recommendation'
import { hasTravelRecord, planFingerprint, type RecommendationApplyResult, type RecommendationMode, type RecommendationUndo } from './recommendationApplication'

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/
function endMinutes(place: PlaceStop) {
  const [h, m] = (place.time || '00:00').split(':').map(Number)
  return h * 60 + m + (place.durationMin || 60)
}

export default function DaySuggest({ city, date, weather, existing, planned = [], plan, transportMode, onApply, onUndo }: {
  city: string
  date?: string
  weather?: WeatherSnap
  existing: PlaceStop[]
  planned?: PlannedPlace[]
  plan: PlanVariant
  transportMode: TransportMode
  onApply: (places: Omit<PlaceStop, 'id'>[], mode: RecommendationMode, expected: string) => RecommendationApplyResult
  onUndo: (undo: RecommendationUndo) => boolean
}) {
  const profile = useApp((s) => s.profile)
  const backend = resolveBackend(profile)
  const { t, locale } = useT()
  const [preferences, setPreferences] = useState<RecommendationPreferences>(() => ({
    ...DEFAULT_RECOMMENDATION_PREFERENCES,
    transportMode: transportMode === 'flight' ? 'public' : transportMode,
    indoorOnly: plan === 'B' || (weather?.source === 'forecast' && weather.rainProb >= 50),
  }))
  const [mode, setMode] = useState<RecommendationMode>('append')
  const [items, setItems] = useState<DaySuggestion[]>([])
  const [source, setSource] = useState<'local' | 'api'>('local')
  const [loading, setLoading] = useState(false)
  const [locating, setLocating] = useState(false)
  const [asked, setAsked] = useState(false)
  const [picked, setPicked] = useState(0)
  const [excluded, setExcluded] = useState<Set<number>>(new Set())
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [undo, setUndo] = useState<RecommendationUndo | null>(null)
  const [pending, setPending] = useState<{ places: Omit<PlaceStop, 'id'>[]; expected: string } | null>(null)
  const generation = useRef(0)
  const controller = useRef<AbortController | null>(null)
  const applying = useRef(false)
  const revision = useMemo(() => planFingerprint(existing), [existing])
  const context = useMemo(() => suggestionContextKey({
    city, date, planned, weather, preferences, locale,
    existing: mode === 'append' ? existing.map((place) => place.name) : [],
    anchor: mode === 'append' ? existing[existing.length - 1] : undefined,
    apiUrl: backend.ready ? backendEndpoint(backend.baseUrl, '/recommendations/day') : undefined,
  }), [city, date, planned, weather, preferences, locale, mode, backend.baseUrl, backend.ready, existing])

  function clearResults() {
    generation.current += 1
    controller.current?.abort()
    setItems([])
    setAsked(false)
    setLoading(false)
    setError('')
    setPending(null)
  }

  useEffect(() => {
    clearResults()
    return () => {
      generation.current += 1
      controller.current?.abort()
    }
  }, [context, revision])

  const protectedPlan = hasTravelRecord(existing)
  const missingTime = mode === 'append' && existing.some((place) => !TIME.test(place.time || ''))
  const validWindow = TIME.test(preferences.startTime) && TIME.test(preferences.endTime) && preferences.startTime < preferences.endTime
  const anchor = mode === 'append' ? existing[existing.length - 1] : undefined
  const orderConflict = !!anchor && !missingTime && existing.some((place) => endMinutes(place) > endMinutes(anchor))
  const current = items[picked]
  const candidates = (current?.places || []).filter((place) =>
    !planned.some((other) => (!other.city || belongsToRecommendationCity(other.city, city)) && samePlace(place, other)) &&
    (mode === 'replace' || !existing.some((other) => samePlace(place, other))),
  ).map((place) => {
    const previous = mode === 'replace' ? existing.find((other) => samePlace(place, other)) : undefined
    const coords = previous?.coords || place.coords
    return {
      ...place,
      coords,
      locationPending: !coords,
      address: previous?.coords ? previous.address || place.address : place.address,
      notes: previous?.notes || place.notes,
      cost: previous?.cost || place.cost,
    }
  })
  const selected = candidates.filter((_, index) => !excluded.has(index))
  const schedule = scheduleSuggestion(selected, preferences, anchor)
  const route = schedule.unlocated === 0 && (!anchor || anchor.coords)
    ? mapsDayRoute(anchor ? [anchor, ...schedule.places] : schedule.places) : ''
  const cannotGenerate = !validWindow || missingTime || orderConflict || (mode === 'replace' && protectedPlan)

  function changePreferences(patch: Partial<RecommendationPreferences>) {
    clearResults()
    setStatus('')
    setPreferences((value) => ({ ...value, ...patch }))
  }

  async function run() {
    if (cannotGenerate) return
    controller.current?.abort()
    const abort = new AbortController()
    controller.current = abort
    const id = ++generation.current
    setAsked(true)
    setLoading(true)
    setItems([])
    setError('')
    setStatus('')
    try {
      const result = await suggestDays({
        city, date, weather, locale, preferences, anchor,
        existing: mode === 'append' ? existing.map((place) => place.name) : [],
        planned, signal: abort.signal,
        apiUrl: backend.ready ? backendEndpoint(backend.baseUrl, '/recommendations/day') : undefined,
      })
      if (id !== generation.current || abort.signal.aborted) return
      setItems(result.items)
      setSource(result.source)
      setPicked(0)
      setExcluded(new Set())
      setError(result.error ? t(`suggest.${result.error}`) : '')
      if (result.cached) setStatus(t('suggest.cached'))
    } catch {
      if (id === generation.current && !abort.signal.aborted) setError(t('suggest.failed'))
    } finally {
      if (id === generation.current) setLoading(false)
    }
  }

  async function apply(places: Omit<PlaceStop, 'id'>[], expected: string) {
    if (applying.current) return
    applying.current = true
    setLocating(true)
    const signal = controller.current?.signal
    try {
      const ready = source === 'api' ? await enrichSuggestedPlaces(places, { city, signal }) : places
      if (signal?.aborted) return
      const result = onApply(ready, mode, expected)
      setPending(null)
      if (result.ok) {
        setUndo(result.undo)
        clearResults()
        setStatus(t('suggest.applied', { n: result.count, plan }))
      } else {
        setStatus(t(`suggest.apply.${result.reason}`))
      }
    } catch (error) {
      if (!(error instanceof Error && error.name === 'AbortError')) setStatus(t('suggest.failed'))
    } finally {
      applying.current = false
      setLocating(false)
    }
  }

  return (
    <section className="paper overflow-hidden" data-guide="day-suggest" aria-busy={loading || locating}>
      <div className="space-y-4 p-5">
        <div>
          <h3 className="display flex items-center gap-2 text-2xl"><Sparkles size={20} />{t('suggest.dayFor', { city })}</h3>
          <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>{t('suggest.preferencesHint')}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className="min-w-0 space-y-1 text-xs">
            <span>{t('suggest.pace')}</span>
            <select className="field w-full" value={preferences.pace} onChange={(e) => changePreferences({ pace: e.target.value as RecommendationPreferences['pace'] })}>
              {(['relaxed', 'balanced', 'full'] as const).map((pace) => <option key={pace} value={pace}>{t(`suggest.pace.${pace}`)}</option>)}
            </select>
          </label>
          <label className="min-w-0 space-y-1 text-xs">
            <span>{t('suggest.transport')}</span>
            <select className="field w-full" value={preferences.transportMode} onChange={(e) => changePreferences({ transportMode: e.target.value as TransportMode })}>
              {(['public', 'walking', 'taxi', 'self-drive', 'cycling', 'mixed'] as TransportMode[]).map((value) => <option key={value} value={value}>{transportLabel(t, value)}</option>)}
            </select>
          </label>
          <label className="min-w-0 space-y-1 text-xs"><span>{t('suggest.startTime')}</span><input className="field w-full" type="time" value={preferences.startTime} onChange={(e) => changePreferences({ startTime: e.target.value })} /></label>
          <label className="min-w-0 space-y-1 text-xs"><span>{t('suggest.endTime')}</span><input className="field w-full" type="time" value={preferences.endTime} onChange={(e) => changePreferences({ endTime: e.target.value })} /></label>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={preferences.indoorOnly} onChange={(e) => changePreferences({ indoorOnly: e.target.checked })} />{t('suggest.indoorOnly')}</label>
          {existing.length > 0 && <label className="flex flex-wrap items-center gap-2"><span>{t('suggest.mode')}</span><select className="field" value={mode} onChange={(e) => { clearResults(); setStatus(''); setMode(e.target.value as RecommendationMode) }}><option value="append">{t('suggest.mode.append')}</option><option value="replace" disabled={protectedPlan}>{t('suggest.mode.replace')}</option></select></label>}
        </div>
        {anchor && !missingTime && <p className="text-xs" style={{ color: 'var(--muted)' }}>{t('suggest.anchor', { name: anchor.name })}</p>}
        {!validWindow && <p role="alert" className="text-sm" style={{ color: 'var(--warn)' }}>{t('suggest.invalidWindow')}</p>}
        {missingTime && <p role="alert" className="text-sm" style={{ color: 'var(--warn)' }}>{t('suggest.missingTime')}</p>}
        {orderConflict && <p role="alert" className="text-sm" style={{ color: 'var(--warn)' }}>{t('suggest.orderConflict')}</p>}
        {protectedPlan && <p className="text-xs" style={{ color: 'var(--muted)' }}>{t('suggest.protectedHint')}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn" disabled={loading || locating || cannotGenerate} data-guide="recommend" onClick={() => void run()}><Sparkles size={16} />{asked ? t('suggest.regenerate') : t('suggest.recommend')}</button>
          {loading && <button type="button" className="btn btn-ghost" onClick={() => { clearResults(); setStatus(t('suggest.cancelled')) }}>{t('suggest.cancel')}</button>}
          {loading && <span role="status" className="text-sm">{t('suggest.loading', { city })}</span>}
        </div>
        {(status || undo) && <div role="status" className="flex flex-wrap items-center gap-3 text-sm"><span>{status}</span>{undo && <button className="btn btn-ghost text-xs" onClick={() => { setStatus(t(onUndo(undo) ? 'suggest.undone' : 'suggest.undoChanged')); setUndo(null) }}>{t('suggest.undo')}</button>}</div>}
        {error && <p role="status" className="text-xs" style={{ color: 'var(--warn)' }}>{error}</p>}
        {asked && !loading && !current && <p className="text-sm">{t('suggest.noCandidates')}</p>}
      </div>
      {current && <div className="space-y-4 border-t p-5" style={{ borderColor: 'var(--line)' }}>
        <div className="flex flex-wrap gap-2" aria-label={t('suggest.options')}>
          {items.map((item, index) => <button key={`${item.title}-${index}`} type="button" aria-pressed={picked === index} className={picked === index ? 'btn text-xs' : 'btn btn-ghost text-xs'} onClick={() => { setPicked(index); setExcluded(new Set()); setStatus('') }}>{item.title}</button>)}
        </div>
        <div>
          <p className="text-sm">{current.vibe}</p>
          <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>{source === 'api' ? t('suggest.fromApi') : t('suggest.local')} · {t('suggest.reviewHours')}</p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span>{t('suggest.summary', { n: schedule.places.length, min: schedule.totalMinutes, travel: schedule.travelMinutes })}</span>
          <button className="btn btn-ghost text-xs" onClick={() => setExcluded(excluded.size ? new Set() : new Set(candidates.map((_, index) => index)))}>{excluded.size ? t('suggest.selectAll') : t('suggest.deselectAll')}</button>
        </div>
        {schedule.omitted > 0 && <p className="text-xs" style={{ color: 'var(--warn)' }}>{t('suggest.omitted', { n: schedule.omitted })}</p>}
        {schedule.unlocated > 0 && <p className="text-xs" style={{ color: 'var(--warn)' }}>{t('suggest.unlocatedHint')}</p>}
        <ol className="space-y-3">
          {candidates.map((place, index) => {
            const scheduled = schedule.places.find((item) => samePlace(item, place))
            const selectedPlace = !excluded.has(index)
            return <li key={`${place.name}-${index}`} className="flex items-start gap-3 text-sm" style={{ opacity: scheduled ? 1 : 0.6 }}>
              <input type="checkbox" className="mt-1" aria-label={t('suggest.selectPlace', { name: place.name })} checked={selectedPlace} onChange={() => setExcluded((previous) => { const next = new Set(previous); if (next.has(index)) next.delete(index); else next.add(index); return next })} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><span className="chip text-xs">{scheduled?.time || t(selectedPlace ? 'suggest.notScheduled' : 'suggest.notSelected')}</span><span className="font-medium">{place.name}</span></div>
                <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>{placeCatLabel(t, place.category)} · {settingLabel(t, place.setting)} · {scheduled?.durationMin || place.durationMin || 60} min</p>
                {place.notes && <p className="mt-1 text-xs">{place.notes}</p>}
                {place.address && <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>{place.address}</p>}
                <div className="mt-1 flex flex-wrap gap-3 text-xs">
                  <a className="underline" href={mapsPlaceUrl(`${place.name} ${city}`, place.coords)} target="_blank" rel="noreferrer">{t(place.coords ? 'suggest.map' : 'suggest.confirmLocation')}</a>
                  {place.ticketNeeded && place.ticketUrl && <a className="underline" href={place.ticketUrl} target="_blank" rel="noreferrer">{t('suggest.tickets')}</a>}
                </div>
              </div>
            </li>
          })}
        </ol>
        {schedule.places.length === 0 && <p className="text-sm">{t(candidates.length ? 'suggest.noRoom' : 'suggest.allPlanned')}</p>}
        <div className="flex flex-wrap gap-2">
          <button className="btn" disabled={locating || !schedule.places.length || cannotGenerate} onClick={() => { if (mode === 'replace' && existing.length) setPending({ places: schedule.places, expected: revision }); else void apply(schedule.places, revision) }}>{t(mode === 'replace' ? 'suggest.replace' : 'suggest.add')}</button>
          {route && schedule.places.length > 0 && <a className="btn btn-ghost no-underline" href={route} target="_blank" rel="noreferrer">{t('suggest.openRoute')}</a>}
          {locating && <span role="status" className="text-sm">{t('suggest.locating')}</span>}
        </div>
      </div>}
      <Modal open={!!pending} title={t('suggest.confirmReplace')} onClose={() => setPending(null)}>
        <p className="text-sm">{t('suggest.replaceHint', { old: existing.length, n: pending?.places.length || 0, plan })}</p>
        <ol className="my-4 space-y-2 text-sm">{pending?.places.map((place) => <li key={place.name}>{place.time} · {place.name}</li>)}</ol>
        <button className="btn" disabled={locating} onClick={() => { if (pending) void apply(pending.places, pending.expected) }}>{t('suggest.confirmReplace')}</button>
      </Modal>
    </section>
  )
}
