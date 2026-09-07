import { useEffect, useMemo, useRef, useState } from 'react'
import { Sparkles } from 'lucide-react'
import type { Trip } from './types'
import type { Cuisine, DecisionCandidate, DecisionPreferences, RankedDecision } from './decisionTypes'
import { CUISINES, buildDecisionLinks, parseDecisionIntent, planMeals, rankDecisions, safeDecisionUrl } from './decision'
import { DECISION_CATALOG } from './decisionCatalog'
import { fetchDecisionCandidates } from './decisionClient'
import { savedDecisionCandidates } from './decisionSelection'
import { useApp } from './store'
import { useT } from './i18n'
import { money } from './lib'
import { Modal } from './ui'
import { tripHotelStays } from './bookingLinks'

function nextDay(date: string) {
  const value = new Date(date + 'T12:00:00Z')
  if (!Number.isFinite(value.getTime())) return ''
  value.setUTCDate(value.getUTCDate() + 1)
  return value.toISOString().slice(0, 10)
}
function validDate(date: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date + 'T12:00:00Z')) && new Date(date + 'T12:00:00Z').toISOString().slice(0, 10) === date
}
const criterionKey = (key: string) => key === 'reviews' ? 'reviewCount' : key

export default function DecisionAssistant({ trip }: { trip: Trip }) {
  const { t, locale } = useT()
  const { saveDecision, updateTrip } = useApp()
  const endpoint = useApp((state) => state.profile.decisionApiUrl) || '/api/decisions/search'
  const stay = tripHotelStays(trip)[0]
  const [prefs, setPrefs] = useState<DecisionPreferences>(() => trip.decisionPreferences || ({
    kind: 'hotel', city: stay?.city || trip.destinations[0] || trip.origin,
    currency: trip.homeCurrency, seaView: false, parking: false, freeParking: false, cuisine: 'any', variety: false,
    minRating: 4.3, minReviews: 100, checkin: stay?.checkin || trip.startDate, checkout: stay?.checkout || nextDay(trip.startDate),
    travellers: trip.travellers,
  }))
  const [prompt, setPrompt] = useState('')
  const [live, setLive] = useState<DecisionCandidate[]>([])
  const [searched, setSearched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [offline, setOffline] = useState(false)
  const [status, setStatus] = useState('')
  const [selectionError, setSelectionError] = useState('')
  const [label, setLabel] = useState('')
  const [pending, setPending] = useState<{ ranked: RankedDecision; choose: boolean; preferences: DecisionPreferences } | null>(null)
  const generation = useRef(0)
  const controller = useRef<AbortController | null>(null)
  const panel = useRef<HTMLElement>(null)
  const committing = useRef(false)
  useEffect(() => () => { generation.current += 1; controller.current?.abort() }, [trip.id, locale, endpoint])

  const saved = useMemo(() => savedDecisionCandidates(trip.saved), [trip.saved])
  const candidates = useMemo(() => [...live, ...saved, ...DECISION_CATALOG].filter((candidate, index, all) => all.findIndex((other) => other.id === candidate.id) === index), [saved, live])
  const results = useMemo(() => rankDecisions(candidates, prefs).filter((result) => result.confidence !== 'excluded').slice(0, 8), [candidates, prefs])
  const valid = prefs.city.trim().length > 0 && validDate(prefs.checkin) && (prefs.kind === 'restaurant' || validDate(prefs.checkout) && prefs.checkout > prefs.checkin)
    && Number.isInteger(prefs.travellers) && prefs.travellers >= 1 && prefs.travellers <= 20
    && (prefs.budgetMax === undefined || Number.isFinite(prefs.budgetMax) && prefs.budgetMax > 0 && prefs.budgetMax <= 1_000_000)
  const meals = prefs.kind === 'restaurant' && prefs.variety ? planMeals(trip.days, prefs, candidates, (trip.mealSelections || []).map((meal) => ({
    ...meal, repeated: false, candidate: candidates.find((candidate) => candidate.id === trip.saved.find((item) => item.id === meal.savedId)?.meta?.decisionId),
  }))) : []

  function change(patch: Partial<DecisionPreferences>) {
    controller.current?.abort()
    generation.current += 1
    setPrefs((previous) => ({ ...previous, ...patch }))
    setLive([])
    setSearched(false)
    setLoading(false)
    setStatus('')
    setPending(null)
  }
  function readIntent(text = prompt) {
    change(parseDecisionIntent(text, prefs))
    setPrompt(text)
    setStatus(t('decision.parsed'))
  }
  async function search() {
    if (!valid) { setStatus(t('decision.invalid')); return }
    controller.current?.abort()
    const abort = new AbortController()
    controller.current = abort
    const id = ++generation.current
    setLoading(true); setStatus(''); setOffline(false); setLive([]); setSearched(false)
    updateTrip(trip.id, { decisionPreferences: { ...prefs } })
    try {
      const data = await fetchDecisionCandidates(prefs, locale, endpoint, abort.signal)
      if (id !== generation.current || abort.signal.aborted) return
      setLive(data)
      setSearched(true)
    } catch {
      if (id !== generation.current || abort.signal.aborted) return
      setOffline(true); setSearched(true)
    } finally {
      if (id === generation.current) setLoading(false)
    }
  }
  function select(ranked: RankedDecision, choose: boolean) {
    setPending({ ranked, choose, preferences: { ...prefs } })
    setLabel(ranked.candidate.source === 'google' ? '' : ranked.candidate.name)
    setSelectionError('')
  }
  function commit() {
    if (!pending || committing.current) return
    committing.current = true
    try {
      const error = saveDecision(trip.id, pending.ranked.candidate, pending.preferences, label, pending.choose, t(pending.ranked.candidate.kind === 'hotel' ? 'decision.hotel' : 'decision.restaurant'))
      if (error) {
        setSelectionError(t(error === 'label' ? 'decision.savedLabelError' : error === 'date' ? 'decision.dateError' : error === 'mealConflict' ? 'decision.mealConflict' : 'decision.tripError'))
      } else {
        setStatus(t(pending.choose ? 'decision.chosen' : 'decision.saved'))
        setPending(null)
      }
    } finally { committing.current = false }
  }
  const unknowns = pending?.ranked.criteria.filter((criterion) => criterion.state === 'unknown').map((criterion) => t('decision.' + criterionKey(criterion.key))).join(' · ')
  const searchLinks = buildDecisionLinks(prefs)

  return (
    <section ref={panel} className="paper p-4 sm:p-5" data-guide="smart-decision" aria-busy={loading}>
      <h2 className="display flex items-center gap-2 text-2xl"><Sparkles size={20} />{t('decision.title')}</h2>
      <p className="mt-2 text-sm" style={{ color: 'var(--muted)' }}>{t('decision.intro')}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {(['hotel', 'restaurant'] as const).map((kind) => <button key={kind} className={prefs.kind === kind ? 'btn' : 'btn btn-ghost'} aria-pressed={prefs.kind === kind} onClick={() => change({ kind, budgetMax: undefined })}>{t('decision.' + kind)}</button>)}
      </div>
      <label className="mt-4 block space-y-2 text-sm"><span>{t('decision.prompt')}</span><textarea className="field min-h-20" value={prompt} maxLength={2000} onChange={(event) => setPrompt(event.target.value)} placeholder={t('decision.promptPh')} /></label>
      <div className="mt-2 flex flex-wrap gap-2">
        <button className="btn btn-soft text-xs" disabled={!prompt.trim()} onClick={() => readIntent()}>{t('decision.parse')}</button>
        <button className="btn btn-ghost text-xs" onClick={() => readIntent(t('decision.hotelExample'))}>{t('decision.hotelExample')}</button>
        <button className="btn btn-ghost text-xs" onClick={() => readIntent(t('decision.foodExample'))}>{t('decision.foodExample')}</button>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <label className="min-w-0 space-y-1 text-xs"><span>{t('decision.city')}</span><input className="field" list={'decision-cities-' + trip.id} value={prefs.city} maxLength={120} onChange={(event) => change({ city: event.target.value })} /></label>
        <datalist id={'decision-cities-' + trip.id}>{[...new Set([...trip.destinations, ...DECISION_CATALOG.map((candidate) => candidate.city)])].map((city) => <option key={city} value={city} />)}</datalist>
        <label className="min-w-0 space-y-1 text-xs"><span>{t(prefs.kind === 'hotel' ? 'decision.budgetHotel' : 'decision.budgetFood')}</span><input className="field" type="number" min="1" value={prefs.budgetMax ?? ''} placeholder={t('decision.budgetNone')} onChange={(event) => change({ budgetMax: event.target.value === '' ? undefined : Number(event.target.value) })} /></label>
        <label className="min-w-0 space-y-1 text-xs"><span>{t('decision.currency')}</span><select className="field" value={prefs.currency} onChange={(event) => change({ currency: event.target.value })}>{[...new Set([trip.homeCurrency, 'AUD', 'USD', 'CNY', 'JPY', 'EUR', 'IDR'])].map((currency) => <option key={currency}>{currency}</option>)}</select></label>
        <label className="min-w-0 space-y-1 text-xs"><span>{t('decision.guests')}</span><input className="field" type="number" min="1" max="20" value={prefs.travellers} onChange={(event) => change({ travellers: Number(event.target.value) })} /></label>
        <label className="min-w-0 space-y-1 text-xs"><span>{t(prefs.kind === 'hotel' ? 'decision.checkin' : 'decision.mealDate')}</span><input className="field" type="date" value={prefs.checkin} onChange={(event) => change({ checkin: event.target.value })} /></label>
        {prefs.kind === 'hotel' ? <label className="min-w-0 space-y-1 text-xs"><span>{t('decision.checkout')}</span><input className="field" type="date" value={prefs.checkout} onChange={(event) => change({ checkout: event.target.value })} /></label> : <label className="min-w-0 space-y-1 text-xs"><span>{t('decision.cuisine')}</span><select className="field" value={prefs.cuisine} onChange={(event) => change({ cuisine: event.target.value as Cuisine })}>{CUISINES.map((cuisine) => <option key={cuisine} value={cuisine}>{t('decision.cuisine.' + cuisine)}</option>)}</select></label>}
        <label className="min-w-0 space-y-1 text-xs"><span>{t('decision.minRating')}</span><select className="field" value={prefs.minRating} onChange={(event) => change({ minRating: Number(event.target.value) })}>{[0, 4, 4.3, 4.5, 4.7].map((value) => <option key={value} value={value}>{value === 0 ? '—' : value.toFixed(1)}</option>)}</select></label>
        <label className="min-w-0 space-y-1 text-xs"><span>{t('decision.minReviews')}</span><select className="field" value={prefs.minReviews} onChange={(event) => change({ minReviews: Number(event.target.value) })}>{[0, 50, 100, 500].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
      </div>
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        {prefs.kind === 'hotel' && <label className="flex items-center gap-2"><input type="checkbox" checked={prefs.seaView} onChange={(event) => change({ seaView: event.target.checked })} />{t('decision.seaView')}</label>}
        <label className="flex items-center gap-2"><input type="checkbox" checked={prefs.parking} onChange={(event) => change({ parking: event.target.checked, freeParking: event.target.checked ? prefs.freeParking : false })} />{t('decision.parking')}</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={prefs.freeParking} onChange={(event) => change({ freeParking: event.target.checked, parking: event.target.checked || prefs.parking })} />{t('decision.freeParking')}</label>
        {prefs.kind === 'restaurant' && <label className="flex items-center gap-2"><input type="checkbox" checked={prefs.variety} onChange={(event) => change({ variety: event.target.checked })} />{t('decision.variety')}</label>}
      </div>
      {prefs.kind === 'restaurant' && <details className="mt-3 text-xs"><summary className="cursor-pointer">{t('decision.exclusions')}</summary><div className="mt-2 flex flex-wrap gap-3">{CUISINES.filter((cuisine) => cuisine !== 'any').map((cuisine) => <label key={cuisine} className="flex items-center gap-1"><input type="checkbox" checked={prefs.excludedCuisines?.includes(cuisine) || false} onChange={(event) => change({ excludedCuisines: event.target.checked ? [...(prefs.excludedCuisines || []), cuisine] : prefs.excludedCuisines?.filter((value) => value !== cuisine), cuisine: event.target.checked && prefs.cuisine === cuisine ? 'any' : prefs.cuisine })} />{t('decision.cuisine.' + cuisine)}</label>)}</div></details>}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button className="btn" disabled={loading || !valid} onClick={() => void search()}><Sparkles size={16} />{t(loading ? 'decision.loading' : 'decision.find')}</button>
        {loading && <button className="btn btn-ghost" onClick={() => { controller.current?.abort(); generation.current += 1; setLoading(false) }}>{t('decision.cancel')}</button>}
      </div>
      {!valid && <p role="alert" className="mt-3 text-sm" style={{ color: 'var(--warn)' }}>{t('decision.invalid')}</p>}
      {status && <p role="status" className="mt-3 text-sm">{status}</p>}
      {searched && <div className="mt-5 space-y-4">
        {offline && <p role="status" className="rounded-xl p-3 text-sm" style={{ background: 'var(--bg-2)' }}>{t('decision.offline')}</p>}
        <p className="text-xs" style={{ color: 'var(--muted)' }}>{t('decision.scoreHint')}</p>
        {results.length === 0 && <p className="text-sm">{t('decision.noResults')}</p>}
        {results.length > 0 && results.every((result) => !result.candidate.rating) && <p className="text-xs" style={{ color: 'var(--muted)' }}>{t('decision.pendingOnly')}</p>}
        <div className="grid gap-3 xl:grid-cols-2">
          {results.map((ranked) => {
            const candidate = ranked.candidate
            const links = buildDecisionLinks(prefs, candidate)
            return <article key={candidate.id} className="min-w-0 rounded-2xl border p-4" style={{ borderColor: 'var(--line)' }}>
              <div className="flex flex-wrap items-start justify-between gap-2"><h3 className="display text-xl">{candidate.name}</h3><span className="chip text-xs">{t(ranked.confidence === 'confirmed' ? 'decision.confirmed' : 'decision.conditional')}</span></div>
              {candidate.address && <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>{candidate.address}</p>}
              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                <span className="chip">{t('decision.match', { n: ranked.matchScore })}</span>
                {candidate.rating ? <a className="chip underline" href={safeDecisionUrl(candidate.rating.sourceUrl)} target="_blank" rel="noreferrer">⭐ {candidate.rating.value.toFixed(1)} / 5 {candidate.rating.count !== undefined ? ' · ' + t('decision.reviews', { n: candidate.rating.count }) : ''}</a> : <span className="chip">{t('decision.noRating')}</span>}
              </div>
              <p className="mt-2 text-xs">{candidate.price ? t('decision.referencePrice', { price: (candidate.price.min !== undefined ? money(candidate.price.min, candidate.price.currency) + '–' : '') + money(candidate.price.max, candidate.price.currency) }) + ' ' + t(candidate.price.basis === 'night' ? 'decision.perNight' : 'decision.perPerson') : t('decision.priceUnknown')}</p>
              <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>{t('decision.availability')}</p>
              {candidate.seaView === 'room' && <p className="mt-2 text-xs">{t('decision.viewRoom')}</p>}
              {candidate.seaView === 'property' && <p className="mt-2 text-xs">{t('decision.viewProperty')}</p>}
              <ul className="mt-3 space-y-1 text-xs">{ranked.criteria.map((criterion) => <li key={criterion.key}>{criterion.state === 'match' ? '✓' : '?'} {t('decision.' + criterionKey(criterion.key))} · {t('decision.' + (criterion.state === 'match' ? 'matches' : 'unknown'))}</li>)}</ul>
              <div className="mt-3 flex flex-wrap gap-3 text-xs">{links.map((link) => <a key={link.url} className="underline" href={link.url} target="_blank" rel="noreferrer">{link.label}</a>)}</div>
              <div className="mt-3 border-t pt-2 text-xs" style={{ borderColor: 'var(--line)', color: 'var(--muted)' }}>
                <a href={safeDecisionUrl(candidate.sourceUrl)} target="_blank" rel="noreferrer" className="underline">{candidate.source === 'google' ? <span translate="no" style={{ fontFamily: 'sans-serif', fontWeight: 400, color: '#5e5e5e', whiteSpace: 'nowrap' }}>Google Maps</span> : t(candidate.source === 'curated' ? 'decision.sourceCurated' : 'decision.sourceSaved')}</a>
                {candidate.checkedAt && <span> · {t('decision.checked', { date: candidate.checkedAt.slice(0, 10) })}</span>}
                {candidate.attributions?.map((attribution, index) => <span key={index}> · {safeDecisionUrl(attribution.url) ? <a href={safeDecisionUrl(attribution.url)} target="_blank" rel="noreferrer">{attribution.name}</a> : attribution.name}</span>)}
              </div>
              <div className="mt-3 flex flex-wrap gap-2"><button className="btn btn-soft text-xs" onClick={() => select(ranked, false)}>{t('decision.save')}</button><button className="btn text-xs" onClick={() => select(ranked, true)}>{t('decision.choose')}</button></div>
            </article>
          })}
        </div>
        <div className="rounded-xl p-3 text-sm" style={{ background: 'var(--bg-2)' }}><p className="mb-2">{t('decision.search')}</p><div className="flex flex-wrap gap-3">{searchLinks.map((link) => <a key={link.url} className="underline" href={link.url} target="_blank" rel="noreferrer">{link.label}</a>)}</div></div>
      </div>}
      {prefs.kind === 'restaurant' && prefs.variety && <div className="mt-6 border-t pt-5" style={{ borderColor: 'var(--line)' }}>
        <h3 className="display text-xl">{t('decision.mealTitle')}</h3><p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>{t('decision.mealHint')}</p>
        {!meals.length && <p className="mt-3 text-sm">{t('decision.mealNoCuisine')}</p>}
        <ol className="mt-3 grid gap-2 sm:grid-cols-2">{meals.map((meal) => {
          const assigned = trip.mealSelections?.find((entry) => entry.date === meal.date)
          const savedMeal = trip.saved.find((entry) => entry.id === assigned?.savedId)
          return <li key={meal.date} className="rounded-xl p-3 text-sm" style={{ background: 'var(--bg-2)' }}>
            <p>{meal.date.slice(5)} · {meal.city} · {t('decision.cuisine.' + (assigned?.cuisine || meal.cuisine))}</p>
            {meal.repeated && !assigned && <p className="mt-1 text-xs">{t('decision.mealRepeat')}</p>}
            {savedMeal ? <div className="mt-2"><p>{t('decision.mealChosen', { name: savedMeal.name })}</p><button className="mt-2 underline text-xs" onClick={() => updateTrip(trip.id, { mealSelections: (useApp.getState().trips.find((entry) => entry.id === trip.id)?.mealSelections || []).filter((entry) => entry.date !== meal.date) })}>{t('decision.mealRemove')}</button></div> : <button className="btn btn-ghost mt-2 text-xs" onClick={() => { change({ kind: 'restaurant', city: meal.city, cuisine: meal.cuisine, checkin: meal.date, checkout: nextDay(meal.date) }); setStatus(t('decision.mealReady', { date: meal.date, city: meal.city })); panel.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}>{t('decision.mealFilter')}</button>}
          </li>
        })}</ol>
      </div>}
      <details className="mt-5 text-xs"><summary className="cursor-pointer">{t('decision.setup')}</summary><p className="mt-2 leading-6">{t('decision.endpointHint')}</p><p><a href="https://developers.google.com/maps/documentation/places/web-service/policies" target="_blank" rel="noreferrer" className="underline">Google Maps Platform</a></p></details>
      <Modal open={!!pending} title={t('decision.confirm')} onClose={() => setPending(null)}>
        {pending && <div className="space-y-4">
          <p className="text-sm">{pending.ranked.candidate.name}</p>
          {unknowns && <p className="text-sm" style={{ color: 'var(--warn)' }}>{t('decision.unknownConfirm', { items: unknowns })}</p>}
          <label className="block space-y-2 text-sm"><span>{t('decision.label')}</span><input className="field" value={label} maxLength={160} placeholder={t('decision.googleLabel')} onChange={(event) => setLabel(event.target.value)} /></label>
          {pending.ranked.candidate.source === 'google' && <p className="text-xs">{t('decision.googleRetention')}</p>}
          {pending.choose && <p className="text-sm">{t('decision.reminder')}</p>}
          {selectionError && <p role="alert" className="text-sm" style={{ color: 'var(--warn)' }}>{selectionError}</p>}
          <button className="btn" disabled={!label.trim()} onClick={commit}>{t(pending.choose ? 'decision.choose' : 'decision.save')}</button>
        </div>}
      </Modal>
    </section>
  )
}
