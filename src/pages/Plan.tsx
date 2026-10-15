import { itineraryRequest } from '../boomiChat'
import { TripButton, TripInput, TripSelect, TripTextarea } from '../TripControls'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Camera, GripVertical, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react'
import { useApp, useTrip } from '../store'
import type { PlaceSetting, PlaceStop, PlanVariant, Priority, TransportMode, SavedItem } from '../types'
import { TRANSPORT, WEATHER } from '../catalog'
import { formatDayLong, money, toISODate, addMinutesToTime, compressPhoto, safeWebUrl } from '../lib'
import { Label, Modal, Tone } from '../ui'
import { activePlaces, dayDistance, outdoorRatio, suggestedSwap, weatherAdvice } from '../domain'
import DaySuggest from '../DaySuggest'
import ScheduleSaved from '../ScheduleSaved'
import { useTripContext } from '../useTripContext'
import { planFingerprint, type RecommendationUndo } from '../recommendationApplication'
import { nearbyOrder, scheduleConflicts } from '../planOrdering'
import { ensurePlaceGeo, hopMeta, mapsNavigateUrl, mapsDayRoute, mapsDirUrl, mapsPlaceUrl, routeHop, searchPlaces, type HopRoute, type PlaceSearchHit } from '../geo'
import { PLACE_CATS, placeCatLabel, priorityLabel, settingLabel, transportLabel, useT, weatherCompact } from '../i18n'

export default function Plan() {
  const { id } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const request = itineraryRequest(searchParams.get('request') || '')
  const [requestDraft, setRequestDraft] = useState<{ name?: string; time?: string; notes?: string }>()
  const trip = useTrip(id)
  const { addDayPlace, removePlace, reorderPlaces, setActivePlan, updatePlace, updateTrip, replacePlaces, applyRecommendation, undoRecommendation } = useApp()
  const { t, locale } = useT()
  const { day, placeId, selectDay, href } = useTripContext(trip)
  const [recommendOpen, setRecommendOpen] = useState(false)
  const [savedOpen, setSavedOpen] = useState(false)
  const [savedItem, setSavedItem] = useState<SavedItem | null>(null)
  const [ordering, setOrdering] = useState<{ before: string; places: PlaceStop[] } | null>(null)
  const [undo, setUndo] = useState<{ dayId: string; plan: PlanVariant; snapshot: RecommendationUndo } | null>(null)
  const [notice, setNotice] = useState('')
  const [open, setOpen] = useState(false)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const places = day ? activePlaces(day) : []
  const advice = day ? weatherAdvice(day, t) : null
  const dist = dayDistance(places)
  const swap = day ? suggestedSwap(day) : null
  const planned = useMemo(
    () =>
      (trip?.days || []).filter((d) => d.id !== day?.id).flatMap((d) =>
        activePlaces(d).map((p) => ({ name: p.name, date: d.date, city: d.city, coords: p.coords })),
      ),
    [trip?.days, day?.id],
  )

  useEffect(() => {
    if (!trip || !day) return
    let live = true
    ;(async () => {
      for (const p of places) {
        if (!p.coords && !p.locationPending) {
          const g = await ensurePlaceGeo(day.city, p)
          if (!live) return
          if (g.coords) updatePlace(trip.id, day.id, day.activePlan, p.id, { coords: g.coords, address: g.address })
        }
      }
    })()
    return () => {
      live = false
    }
  }, [trip?.id, day?.id, places.map((p) => p.id).join(',')])

  useEffect(() => {
    if (placeId) document.getElementById(`stop-${placeId}`)?.scrollIntoView({ block: 'center', behavior: 'instant' })
  }, [day?.id, placeId])

  if (!trip || !day) return null
  const currentTrip = trip
  const currentDay = day
  const plan = day.activePlan

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const ids = places.map((p) => p.id)
    const oldIndex = ids.indexOf(String(active.id))
    const newIndex = ids.indexOf(String(over.id))
    reorderPlaces(currentTrip.id, currentDay.id, plan, arrayMove(ids, oldIndex, newIndex))
  }

  return (
    <div className="flex flex-col gap-5 lg:flex-row">
      <div className="lg:w-[220px] shrink-0">
        <h1 className="display mb-3 text-3xl">{t('plan.title')}</h1>
        <div className="flex gap-2 overflow-auto pb-2 lg:flex-col">
          {trip.days.map((d, i) => (
            <TripButton data-browse
              key={d.id}
              onClick={() => { selectDay(d.id); setRecommendOpen(false) }}
              aria-pressed={d.id === day.id}
              className="paper min-w-[140px] p-3 text-left"
              style={{ outline: d.id === day.id ? '2px solid var(--ink)' : undefined }}
            >
              <div className="text-xs" style={{ color: 'var(--muted)' }}>
                {t('ui.day', { n: i + 1 })} · {WEATHER[d.weather.condition].icon}
              </div>
              <div className="font-medium">{d.city}</div>
              <div className="text-xs" style={{ color: 'var(--muted)' }}>
                {d.date.slice(5)} · {t('ui.plan', { p: d.activePlan })}
              </div>
            </TripButton>
          ))}
        </div>
      </div>

      <div className="min-w-0 flex-1 space-y-4">
        {request && <section className="paper space-y-3 p-4" data-guide="plan-request">
          <h2 className="display text-xl">{t('plan.requestTitle')}</h2><p className="text-sm">{request.text}</p>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>{t('plan.requestHint')}</p>
          <div className="flex flex-wrap gap-2"><TripButton className="btn text-sm" onClick={() => { setRequestDraft({ name: request.place, time: request.time, notes: request.text }); setOpen(true) }}>{t('plan.requestAdd')}</TripButton>
          <TripButton className="btn btn-ghost text-sm" onClick={() => { const next = new URLSearchParams(searchParams); next.delete('request'); setSearchParams(next, { replace: true }) }}>{t('plan.requestDismiss')}</TripButton></div>
        </section>}

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-sm" style={{ color: 'var(--muted)' }}>
              {formatDayLong(day.date, locale)}
            </div>
            <h2 className="display text-4xl">
              {t('ui.day', { n: trip.days.findIndex((d) => d.id === day.id) + 1 })} — {day.city}
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {(['A', 'B'] as PlanVariant[]).map((p) => (
              <TripButton key={p} className={plan === p ? 'btn' : 'btn btn-ghost'} onClick={() => setActivePlan(trip.id, day.id, p)}>
                {p === 'A' ? t('ui.planA') : t('ui.planB')}
              </TripButton>
            ))}
          </div>
        </div>

        {day.date === toISODate(new Date()) && places.length > 0 && <section className="paper journey-next p-4">
          <p className="text-xs" style={{ color: 'var(--muted)' }}>{t('journey.nextStop')}</p>
          {(() => { const next = places.find((place) => !place.checkedIn); return next ? <div className="mt-2 flex flex-wrap items-center justify-between gap-3"><div><h3 className="display text-2xl">{next.time} · {next.name}</h3></div><a className="btn no-underline" href={mapsNavigateUrl(`${next.name} ${day.city}`, next.coords, day.transportMode)} target="_blank" rel="noreferrer">{t('journey.navigate')}</a></div> : <div className="mt-2"><h3 className="display text-2xl">{t('journey.dayDone')}</h3><Link className="btn btn-ghost mt-3 no-underline" to={href('journal')}>{t('trip.journal')} →</Link></div> })()}
        </section>}

        <div className="flex flex-wrap gap-2 text-sm">
          <span className="chip">
            {weatherCompact(day.weather, t)}
          </span>
          <span className="chip">{TRANSPORT[day.transportMode].icon} {transportLabel(t, day.transportMode)}</span>
          {day.stay && <span className="chip">🏨 {day.stay}</span>}
          <span className="chip">{t('plan.outdoor', { n: Math.round(outdoorRatio(places) * 100) })}</span>
          {dist.km > 0 && (
            <span className="chip">
              {t('plan.about', { km: dist.km.toFixed(1), min: dist.minutes })}
            </span>
          )}
        </div>

        {advice && (
          <div className="paper p-4">
            <Tone tone={advice.level === 'warn' ? 'warn' : 'info'}>{advice.title}</Tone>
            <p className="mt-2 text-sm leading-6">{advice.text}</p>
            {advice.suggestSwitch && (
              <TripButton className="btn mt-3 text-sm" onClick={() => setActivePlan(trip.id, day.id, 'B')}>
                {t('plan.switchB')}
              </TripButton>
            )}
          </div>
        )}





        <div className="flex flex-wrap gap-2">
          <TripButton className="btn" onClick={() => { setRequestDraft(undefined); setOpen(true) }}><Plus size={16} />{t('plan.addPlace')}</TripButton>
          <TripButton className="btn btn-ghost" onClick={() => setSavedOpen(true)}>{t('journey.addSaved')}</TripButton>
          <Link className="btn btn-ghost no-underline" to={href('map')}>{t('journey.map')}</Link>
          {mapsDayRoute(places) && <a className="btn btn-ghost no-underline" href={mapsDayRoute(places)} target="_blank" rel="noreferrer">{t('plan.openRoute')}</a>}
          <TripButton className="btn btn-ghost" data-guide="recommend" aria-expanded={recommendOpen} onClick={() => setRecommendOpen(!recommendOpen)}><Sparkles size={16} />{t('journey.recommend')}</TripButton>
        </div>
        {(notice || undo) && <div role="status" className="flex flex-wrap items-center gap-3 text-sm"><span>{notice}</span>{undo && <TripButton className="btn btn-ghost text-sm" onClick={() => { const restored = undoRecommendation(trip.id, undo.dayId, undo.plan, undo.snapshot); setNotice(restored ? t('journey.restored') : t('journey.undoChanged')); setUndo(null) }}>{t('journey.undo')}</TripButton>}</div>}

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={places.map((p) => p.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {places.length === 0 && (
                <div className="paper p-8 text-center text-sm" style={{ color: 'var(--muted)' }}>
                  {plan === 'B' ? t('plan.emptyB') : t('plan.emptyA')}
                </div>
              )}
              {places.map((place, i) => (
                <SortablePlace
                  key={place.id}
                  number={i + 1}
                  selected={placeId === place.id}
                  bookingHref={href('bookings')}
                  place={place}
                  city={day.city}
                  next={places[i + 1]}
                  onRemove={() => { const before = [...places]; removePlace(trip.id, day.id, plan, place.id); setUndo({ dayId: day.id, plan, snapshot: { before, after: planFingerprint(before.filter((item) => item.id !== place.id)) } }); setNotice(t('journey.deleted', { name: place.name })) }}
                  onPatch={(patch) => updatePlace(trip.id, day.id, plan, place.id, patch)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>



        <div>
          <Label>{t('plan.dayNotes')}</Label>
          <TripTextarea
            className="field min-h-[80px]"
            value={day.notes || ''}
            onChange={(e) =>
              updateTrip(trip.id, {
                days: trip.days.map((d) => (d.id === day.id ? { ...d, notes: e.target.value } : d)),
              })
            }
          />
        </div>
        {recommendOpen && <div data-guide="recommend-panel"><DaySuggest
          key={`${trip.id}-${day.id}-${plan}-${locale}`}
          city={day.city}
          date={day.date}
          weather={day.weather}
          existing={places}
          plan={plan}
          transportMode={day.transportMode}
          planned={planned}
          onApply={(next, mode, expected) => applyRecommendation(trip.id, day.id, plan, mode, next, expected)}
          onUndo={(undo) => undoRecommendation(trip.id, day.id, plan, undo)}
        /></div>}
        <details className="paper p-4"><summary className="cursor-pointer text-sm font-medium">{t('journey.tools')}</summary><div className="mt-4 space-y-4">
          <TripButton className="btn btn-ghost" disabled={places.length < 3} onClick={() => setOrdering({ before: planFingerprint(places), places: nearbyOrder(places) })}>{t('plan.optimize')}</TripButton>
          {day.transportMode === 'self-drive' && (
          <SmartStops
            city={day.city}
            existing={places.map((p) => p.name)}
            onAdd={(place) => addDayPlace(trip.id, day.id, plan, place)}
          />
        )}

        {swap && plan === 'A' && (
          <div className="paper p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Sparkles size={16} /> {t('plan.weatherSwap')}
            </div>
            <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
              {t('plan.weatherSwapHint')}
            </p>
            <ol className="mt-2 text-sm">
              {swap.map((p) => (
                <li key={p.id}>
                  {p.time} {p.name} · {settingLabel(t, p.setting)}
                </li>
              ))}
            </ol>
            <TripButton className="btn btn-soft mt-3 text-sm" onClick={() => replacePlaces(trip.id, day.id, 'A', swap)}>
              {t('plan.apply')}
            </TripButton>
          </div>
        )}
        </div></details>
        <Modal open={!!ordering} title={t('journey.optimizeTitle')} onClose={() => setOrdering(null)}>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>{t('journey.optimizeHint')}</p>
          <ol className="mt-4 space-y-2 text-sm">{ordering?.places.map((place, index) => <li key={place.id}>{index + 1}. {place.time || '—'} · {place.name}{place.booked ? ' 🔒' : ''}</li>)}</ol>
          {ordering && scheduleConflicts(ordering.places).length > 0 && <p className="mt-3 text-sm" style={{ color: 'var(--warn)' }}>{t('journey.conflicts', { names: scheduleConflicts(ordering.places).map((place) => place.name).join(' · ') })}</p>}
          <TripButton className="btn mt-4" onClick={() => { if (!ordering) return; if (ordering.before !== planFingerprint(places)) { setNotice(t('journey.orderChanged')); setOrdering(null); return }; replacePlaces(trip.id, day.id, plan, ordering.places); setUndo({ dayId: day.id, plan, snapshot: { before: [...places], after: planFingerprint(ordering.places) } }); setNotice(t('journey.ordered')); setOrdering(null) }}>{t('journey.applyOrder')}</TripButton>
        </Modal>
        <Modal open={savedOpen} title={t('journey.addSaved')} onClose={() => setSavedOpen(false)}>
          <div className="space-y-2">{trip.saved.filter((item) => ['restaurant', 'place', 'activity', 'souvenir'].includes(item.kind) && item.status !== 'rejected').map((item) => <TripButton key={item.id} className="paper flex min-h-12 w-full items-center justify-between gap-3 p-3 text-left" onClick={() => { setSavedOpen(false); setSavedItem(item) }}>{item.name}<Plus size={16} /></TripButton>)}</div>
          {!trip.saved.some((item) => ['restaurant', 'place', 'activity', 'souvenir'].includes(item.kind) && item.status !== 'rejected') && <p className="text-sm">{t('journey.noSaved')}</p>}
          <Link className="btn btn-ghost mt-4 no-underline" to={href('saved')}>{t('trip.saved')} →</Link>
        </Modal>
        {savedItem && <ScheduleSaved key={savedItem.id} trip={trip} item={savedItem} onClose={() => setSavedItem(null)} />}
        <AddPlaceModal
          initial={requestDraft}
          defaultTime={nextStopTime(places)}
          open={open}
          city={day.city}
          onClose={() => setOpen(false)}
          onAdd={(place) => {
            const newId = addDayPlace(trip.id, day.id, plan, { ...place, locationPending: !place.coords })
            setOpen(false)
            void ensurePlaceGeo(day.city, place).then((located) => {
              const latest = useApp.getState().trips.find((item) => item.id === trip.id)?.days.find((item) => item.id === day.id)
              const stop = (plan === 'A' ? latest?.planA : latest?.planB)?.find((item) => item.id === newId)
              if (located.coords && stop?.name === place.name && !stop.coords) updatePlace(trip.id, day.id, plan, newId, { coords: located.coords, address: located.address, locationPending: false })
            }).catch(() => {})
          }}
        />
      </div>
    </div>
  )
}

function SortablePlace({
  number, selected, bookingHref,
  place,
  city,
  next,
  onRemove,
  onPatch,
}: {
  number: number
  selected: boolean
  bookingHref: string
  place: PlaceStop
  city: string
  next?: PlaceStop
  onRemove: () => void
  onPatch: (p: Partial<PlaceStop>) => void
}) {
  const { t } = useT()
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: place.id })
  const style = { transform: CSS.Transform.toString(transform), transition }
  const ticketUrl = safeWebUrl(place.ticketUrl)
  return (
    <div ref={setNodeRef} id={`stop-${place.id}`} style={{ ...style, outline: selected ? '2px solid var(--accent)' : undefined, scrollMarginTop: 100 }} className="paper relative p-4">
      {place.booked && (
        <span className="stamp absolute right-10 top-3 z-10">booked</span>
      )}
      <div className="plan-stop-layout flex items-start gap-3">
        <TripButton className="mt-1 opacity-50" {...attributes} {...listeners} aria-label={t('plan.drag')}>
          <GripVertical size={16} />
        </TripButton>
        <span className="route-stop-number">{number}</span>
        <TripInput
          type="time" aria-label={t('plan.time')} className="stop-time w-[104px] min-w-[104px] rounded-lg border px-2 py-1 text-sm"
          style={{ borderColor: 'var(--line)', background: 'transparent' }}
          value={place.time || ''}
          onChange={(e) => onPatch({ time: e.target.value })}
          placeholder="09:00"
        />
        <div className="stop-details min-w-0 flex-1">
          <div className="font-medium">{place.name}</div>
          <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
            <span className="chip">{placeCatLabel(t, place.category)}</span>
            <span className="chip">{settingLabel(t, place.setting)}</span>
            {place.priority && <span className="chip">{priorityLabel(t, place.priority)}</span>}
            {place.ticketNeeded && <span className="chip">{t('plan.ticket')}</span>}
            {place.booked && <Tone tone="good">{t('plan.booked')}</Tone>}
            {place.cost && <span className="chip">{money(place.cost.amount, place.cost.currency)}</span>}
          </div>
          {place.address && (
            <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
              {place.address}
            </p>
          )}
          <div className="mt-1 flex flex-wrap gap-2 text-xs">
            {place.coords && (
              <a className="underline" href={mapsPlaceUrl(place.name, place.coords)} target="_blank" rel="noreferrer">
                {t('plan.mapLink')}
              </a>
            )}
            {!place.coords && place.locationPending && (
              <a className="underline" href={mapsPlaceUrl(`${place.name} ${city}`)} target="_blank" rel="noreferrer">
                {t('suggest.confirmLocation')}
              </a>
            )}
            {place.ticketNeeded && ticketUrl && (
              <a className="underline" href={ticketUrl} target="_blank" rel="noreferrer">
                {t('plan.buyTicket')}
              </a>
            )}
          </div>
          {place.socialBuzz && (
            <p className="mt-1 text-xs" style={{ color: 'var(--accent)' }}>
              {place.socialBuzz}
            </p>
          )}
          {place.notes && (
            <p className="mt-2 text-sm" style={{ color: 'var(--muted)' }}>
              {place.notes}
            </p>
          )}
          {place.checkedIn && (
            <div className="mt-2 text-sm">
              <span className="chip">✓ {t('plan.checkedIn')}</span>
              {place.feeling && <p className="mt-1 leading-6">{place.feeling}</p>}
              {place.photos && place.photos.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {place.photos.map((src, i) => (
                    <img key={i} src={src} alt="" className="h-16 w-16 rounded-lg object-cover" />
                  ))}
                </div>
              )}
            </div>
          )}
          {next && (
            <PlaceHop from={place} to={next} onMode={(mode) => onPatch({ transportToNext: mode })} />
          )}
        </div>
        <div className="stop-actions flex flex-col items-end gap-2">
          <EditPlaceBtn place={place} onPatch={onPatch} />
          <CheckInBtn place={place} onPatch={onPatch} />
          {place.bookingId ? <Link className="text-xs underline" to={bookingHref} title={t('journey.orderLinked')}>{t('journey.order')}</Link> : <label className="text-xs" style={{ color: 'var(--muted)' }}>
            <TripInput type="checkbox" checked={!!place.booked} onChange={(e) => onPatch({ booked: e.target.checked })} /> {t('plan.bookingCheck')}
          </label>}
          <TripButton className="opacity-50 hover:opacity-100" onClick={onRemove} aria-label={t('plan.delete')}>
            <Trash2 size={16} />
          </TripButton>
        </div>
      </div>
    </div>
  )
}

function EditPlaceBtn({ place, onPatch }: { place: PlaceStop; onPatch: (p: Partial<PlaceStop>) => void }) {
  const { t } = useT()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(place.name)
  const [time, setTime] = useState(place.time || '')
  const [duration, setDuration] = useState(String(place.durationMin || 60))
  const [category, setCategory] = useState(place.category)
  const [setting, setSetting] = useState<PlaceSetting>(place.setting)
  const [priority, setPriority] = useState<Priority>(place.priority || 'want')
  const [notes, setNotes] = useState(place.notes || '')
  const [cost, setCost] = useState(place.cost ? String(place.cost.amount) : '')
  const [currency, setCurrency] = useState(place.cost?.currency || 'AUD')
  const [ticketNeeded, setTicketNeeded] = useState(!!place.ticketNeeded)
  const [ticketUrl, setTicketUrl] = useState(place.ticketUrl || '')

  function show() {
    setName(place.name)
    setTime(place.time || '')
    setDuration(String(place.durationMin || 60))
    setCategory(place.category)
    setSetting(place.setting)
    setPriority(place.priority || 'want')
    setNotes(place.notes || '')
    setCost(place.cost ? String(place.cost.amount) : '')
    setCurrency(place.cost?.currency || 'AUD')
    setTicketNeeded(!!place.ticketNeeded)
    setTicketUrl(place.ticketUrl || '')
    setOpen(true)
  }

  const categories = Array.from(new Set([place.category, ...PLACE_CATS]))
  const durationValue = Number(duration)
  const costValue = cost ? Number(cost) : undefined
  const safeTicketUrl = ticketUrl ? safeWebUrl(ticketUrl) : undefined
  const invalidDuration = !Number.isInteger(durationValue) || durationValue < 5 || durationValue > 1440
  const invalidCost = costValue !== undefined && (!Number.isFinite(costValue) || costValue < 0 || costValue > 1_000_000_000_000)
  const invalidTicketUrl = ticketNeeded && Boolean(ticketUrl) && !safeTicketUrl
  return (
    <>
      <TripButton className="btn btn-ghost px-2 py-1 text-xs" onClick={show} aria-label={t('plan.edit')}>
        <Pencil size={12} /> {t('plan.edit')}
      </TripButton>
      <Modal open={open} title={t('plan.editTitle', { name: place.name })} onClose={() => setOpen(false)}>
        <div className="space-y-3">
          <div>
            <Label>{t('plan.placeName')}</Label>
            <TripInput className="field" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>{t('plan.time')}</Label>
              <TripInput className="field" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
            <div>
              <Label>{t('plan.duration')}</Label>
              <TripInput className="field" type="number" min={5} max={1440} step={5} value={duration} onChange={(e) => setDuration(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>{t('plan.category')}</Label>
            <TripSelect className="field" value={category} onChange={(e) => setCategory(e.target.value)}>
              {categories.map((c) => <option key={c} value={c}>{placeCatLabel(t, c)}</option>)}
            </TripSelect>
          </div>
          <div>
            <Label>{t('plan.setting')}</Label>
            <div className="flex flex-wrap gap-2">
              {(['outdoor', 'indoor', 'mixed'] as PlaceSetting[]).map((value) => (
                <TripButton key={value} className={setting === value ? 'btn' : 'btn btn-ghost'} onClick={() => setSetting(value)}>{settingLabel(t, value)}</TripButton>
              ))}
            </div>
          </div>
          <div>
            <Label>{t('plan.priority')}</Label>
            <div className="flex flex-wrap gap-2">
              {(['must', 'want', 'optional'] as Priority[]).map((value) => (
                <TripButton key={value} className={priority === value ? 'btn' : 'btn btn-ghost'} onClick={() => setPriority(value)}>{priorityLabel(t, value)}</TripButton>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>{t('plan.cost')}</Label>
              <TripInput className="field" type="number" min={0} max={1_000_000_000_000} step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} />
            </div>
            <div>
              <Label>{t('plan.currency')}</Label>
              <TripSelect className="field" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {['AUD', 'CNY', 'USD', 'JPY', 'EUR', 'IDR'].map((value) => <option key={value}>{value}</option>)}
              </TripSelect>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <TripInput type="checkbox" checked={ticketNeeded} onChange={(e) => setTicketNeeded(e.target.checked)} /> {t('plan.needTicket')}
          </label>
          {ticketNeeded && (
            <div>
              <Label>{t('plan.ticketUrl')}</Label>
              <TripInput className="field" type="url" value={ticketUrl} onChange={(e) => setTicketUrl(e.target.value)} />
            </div>
          )}
          <div>
            <Label>{t('plan.notes')}</Label>
            <TripTextarea className="field min-h-[90px]" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <TripButton
            className="btn w-full"
            disabled={!name.trim() || invalidDuration || invalidCost || invalidTicketUrl}
            onClick={() => {
              onPatch({
                name: name.trim(),
                time,
                durationMin: durationValue,
                category,
                setting,
                priority,
                notes,
                cost: costValue === undefined ? undefined : { amount: costValue, currency, status: place.cost?.status || 'estimated' },
                ticketNeeded,
                ticketUrl: ticketNeeded ? safeTicketUrl : undefined,
              })
              setOpen(false)
            }}
          >
            {t('plan.saveEdit')}
          </TripButton>
        </div>
      </Modal>
    </>
  )
}

const HOP_MODES: TransportMode[] = ['walking', 'public', 'taxi', 'self-drive', 'cycling']

function PlaceHop({
  from,
  to,
  onMode,
}: {
  from: PlaceStop
  to: PlaceStop
  onMode: (m: TransportMode) => void
}) {
  const { t } = useT()
  const [hop, setHop] = useState<HopRoute | null>(from.coords && to.coords ? hopMeta(from, to) && {
    mode: from.transportToNext || 'public',
    minutes: hopMeta(from, to)!.minutes,
    km: hopMeta(from, to)!.km,
    geometry: [],
    source: 'estimate' as const,
  } : null)
  const mode = from.transportToNext || 'public'
  useEffect(() => {
    if (!from.coords || !to.coords) return
    let live = true
    void routeHop(from.coords, to.coords, mode).then((h) => {
      if (live) setHop(h)
    })
    return () => {
      live = false
    }
  }, [from.coords?.lat, from.coords?.lng, to.coords?.lat, to.coords?.lng, mode])
  const eta = addMinutesToTime(from.time, (from.durationMin || 45) + (hop?.minutes || 0))
  const url = from.coords && to.coords ? mapsDirUrl(from.coords, to.coords, mode) : ''
  return (
    <div className="mt-2 space-y-1">
      <div className="flex flex-wrap gap-1">
        {HOP_MODES.map((m) => (
          <TripButton key={m} className={mode === m ? 'btn px-2 py-0.5 text-[11px]' : 'btn btn-ghost px-2 py-0.5 text-[11px]'} onClick={() => onMode(m)}>
            {TRANSPORT[m].icon} {transportLabel(t, m)}
          </TripButton>
        ))}
      </div>
      <div className="text-xs" style={{ color: 'var(--muted)' }}>
        {hop ? t('plan.hopEta', { km: hop.km.toFixed(1), min: hop.minutes }) : !from.coords || !to.coords ? t('route.locate') : t('plan.hopWait')}
        {eta && hop && from.coords && to.coords ? ` · ${t('plan.arrive', { time: eta })}` : ''}
        {url && (
          <>
            {' · '}
            <a className="underline" href={url} target="_blank" rel="noreferrer">
              {t('plan.routeLink')}
            </a>
          </>
        )}
      </div>
    </div>
  )
}

function CheckInBtn({ place, onPatch }: { place: PlaceStop; onPatch: (p: Partial<PlaceStop>) => void }) {
  const { t } = useT()
  const [open, setOpen] = useState(false)
  const [feeling, setFeeling] = useState(place.feeling || '')
  if (place.checkedIn) {
    return (
      <TripButton className="btn btn-ghost px-2 py-1 text-xs" data-guide="check-in" onClick={() => onPatch({ checkedIn: false })}>
        {t('plan.uncheck')}
      </TripButton>
    )
  }
  return (
    <>
      <TripButton className="btn btn-soft px-2 py-1 text-xs" data-guide="check-in" onClick={() => setOpen(true)}>
        <Camera size={12} /> {t('plan.checkIn')}
      </TripButton>
      <Modal open={open} title={t('plan.checkInTitle', { name: place.name })} onClose={() => setOpen(false)}>
        <div className="space-y-3">
          <TripTextarea className="field min-h-[90px]" placeholder={t('plan.feeling')} value={feeling} onChange={(e) => setFeeling(e.target.value)} />
          <TripInput
            type="file"
            accept="image/*"
            multiple
            onChange={async (e) => {
              const files = [...(e.target.files || [])].slice(0, 3)
              const photos = [...(place.photos || [])]
              for (const f of files) {
                if (photos.length >= 3) break
                photos.push(await compressPhoto(f))
              }
              onPatch({ photos })
            }}
          />
          <TripButton
            className="btn w-full"
            onClick={() => {
              onPatch({ checkedIn: true, checkedInAt: new Date().toISOString(), feeling })
              setOpen(false)
            }}
          >
            {t('plan.saveCheckIn')}
          </TripButton>
        </div>
      </Modal>
    </>
  )
}

function AddPlaceModal({
  initial,
  defaultTime = '10:00',
  open,
  city,
  onClose,
  onAdd,
}: {
  initial?: { name?: string; time?: string; notes?: string }
  defaultTime?: string
  open: boolean
  city: string
  onClose: () => void
  onAdd: (p: Omit<PlaceStop, 'id'>) => void
}) {
  const [name, setName] = useState('')
  const [time, setTime] = useState('10:00')
  const [category, setCategory] = useState('景点')
  const [setting, setSetting] = useState<PlaceSetting>('mixed')
  const [priority, setPriority] = useState<Priority>('want')
  const [notes, setNotes] = useState('')
  const [ticket, setTicket] = useState(false)
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<PlaceSearchHit[]>([])
  const [searching, setSearching] = useState(false)
  const searchGeneration = useRef(0)
  const searchController = useRef<AbortController | null>(null)
  const searchInFlight = useRef(false)
  const { t } = useT()

  useEffect(() => {
    if (!open) return
    setName(initial?.name || '')
    setTime(initial?.time || defaultTime)
    setNotes(initial?.notes || '')
    setCategory('景点')
    setSetting('mixed')
    setPriority('want')
    setTicket(false)
    setQ(initial?.name || '')
    setHits([])
  }, [open, initial, defaultTime])

  useEffect(() => {
    if (open) return
    searchGeneration.current += 1
    searchController.current?.abort()
    searchController.current = null
    searchInFlight.current = false
    setSearching(false)
  }, [open])

  useEffect(() => {
    searchGeneration.current += 1
    searchController.current?.abort()
    searchController.current = null
    searchInFlight.current = false
    setSearching(false)
    setQ('')
    setHits([])
  }, [city])

  useEffect(() => () => {
    searchGeneration.current += 1
    searchController.current?.abort()
  }, [])

  async function search() {
    const query = q.trim()
    if (!query || searchInFlight.current) return
    const controller = new AbortController()
    searchController.current = controller
    searchInFlight.current = true
    const id = ++searchGeneration.current
    setSearching(true)
    try {
      const data = await searchPlaces(query, city, controller.signal)
      if (id === searchGeneration.current && !controller.signal.aborted) setHits(data)
    } catch {
      if (id === searchGeneration.current && !controller.signal.aborted) setHits([])
    } finally {
      if (id === searchGeneration.current) {
        searchController.current = null
        searchInFlight.current = false
        setSearching(false)
      }
    }
  }

  function changeSearchQuery(value: string) {
    searchGeneration.current += 1
    searchController.current?.abort()
    searchController.current = null
    searchInFlight.current = false
    setSearching(false)
    setQ(value)
    setHits([])
  }

  const picked = useMemo(() => hits[0], [hits])

  return (
    <Modal open={open} title={t('plan.addTitle')} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          {t('plan.addHint', { city })}
        </p>
        <TripInput className="field" placeholder={t('plan.addName')} value={name} onChange={(e) => setName(e.target.value)} />
        <div className="flex gap-2">
          <TripInput className="field" placeholder={t('plan.searchMap')} value={q} onChange={(e) => changeSearchQuery(e.target.value)} />
          <TripButton className="btn btn-ghost" disabled={searching || !q.trim()} onClick={search}>
            {t('plan.search')}
          </TripButton>
        </div>
        {hits.map((h) => (
          <TripButton
            key={h.lat + h.lon}
            className="block w-full rounded-xl px-3 py-2 text-left text-sm"
            style={{ background: 'var(--bg-2)' }}
            onClick={() => {
              setName(name || h.display_name.split(',')[0])
              setQ(h.display_name)
              setHits([h])
            }}
          >
            {h.display_name}
          </TripButton>
        ))}
        <div className="grid grid-cols-2 gap-2">
          <TripInput className="field" type="time" aria-label={t('plan.time')} value={time} onChange={(e) => setTime(e.target.value)} />
          <TripSelect className="field" value={category} onChange={(e) => { setCategory(e.target.value); setSetting(settingForCategory(e.target.value)) }}>
            {PLACE_CATS.map((c) => (
              <option key={c} value={c}>
                {placeCatLabel(t, c)}
              </option>
            ))}
          </TripSelect>
        </div>
        <div className="flex flex-wrap gap-2">
          {(['outdoor', 'indoor', 'mixed'] as PlaceSetting[]).map((s) => (
            <TripButton key={s} className={setting === s ? 'btn' : 'btn btn-ghost'} onClick={() => setSetting(s)}>
              {settingLabel(t, s)}
            </TripButton>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {(['must', 'want', 'optional'] as Priority[]).map((s) => (
            <TripButton key={s} className={priority === s ? 'btn' : 'btn btn-ghost'} onClick={() => setPriority(s)}>
              {priorityLabel(t, s)}
            </TripButton>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <TripInput type="checkbox" checked={ticket} onChange={(e) => setTicket(e.target.checked)} /> {t('plan.needTicket')}
        </label>
        <TripTextarea className="field" placeholder={t('plan.notes')} value={notes} onChange={(e) => setNotes(e.target.value)} />
        <TripButton
          className="btn w-full"
          disabled={!name}
          onClick={() =>
            onAdd({
              name,
              time,
              category,
              setting,
              priority,
              notes,
              ticketNeeded: ticket,
              transportToNext: 'public' as TransportMode,
              coords: picked && Number.isFinite(Number(picked.lat)) && Number.isFinite(Number(picked.lon)) ? { lat: Number(picked.lat), lng: Number(picked.lon) } : undefined,
              address: picked?.display_name,
            })
          }
        >
          {t('plan.addToDay')}
        </TripButton>
      </div>
    </Modal>
  )
}

/** Food, stays and shopping are usually indoors; sights and activities stay mixed until the user says otherwise. */
function settingForCategory(category: string): PlaceSetting {
  return ['餐饮', '住宿', '购物'].includes(category) ? 'indoor' : 'mixed'
}

/** Next stop defaults to after the latest timed stop (its duration, or 90 min), capped at 21:00. */
function nextStopTime(places: { time?: string; durationMin?: number }[]): string {
  let latest = -1
  for (const place of places) {
    const match = /^(\d{1,2}):(\d{2})$/.exec(place.time || '')
    if (!match) continue
    const end = Number(match[1]) * 60 + Number(match[2]) + (place.durationMin && place.durationMin > 0 ? place.durationMin : 90)
    latest = Math.max(latest, end)
  }
  if (latest < 0) return '10:00'
  const rounded = Math.min(21 * 60, Math.ceil(latest / 15) * 15)
  return `${String(Math.floor(rounded / 60)).padStart(2, '0')}:${String(rounded % 60).padStart(2, '0')}`
}

const STOPS: Record<string, Array<Omit<PlaceStop, 'id'> & { detour: string; rating: number }>> = {
  Fuji: [
    {
      name: '足柄服务区',
      category: '休息区',
      setting: 'mixed',
      notes: '厕所 / 加油站 / 便利店',
      detour: '+6 min',
      rating: 4.4,
      durationMin: 20,
      coords: { lat: 35.343, lng: 138.992 },
    },
    {
      name: '忍野八海',
      category: '景点',
      setting: 'outdoor',
      notes: '观景台 · 清泉',
      detour: '+18 min',
      rating: 4.6,
      durationMin: 45,
      coords: { lat: 35.4606, lng: 138.8278 },
    },
  ],
  Lorne: [
    {
      name: 'Lorne 小镇',
      category: '景点',
      setting: 'outdoor',
      notes: 'Recommended Stop · 咖啡 + 海边',
      detour: '+8 min',
      rating: 4.7,
      durationMin: 45,
      coords: { lat: -38.536, lng: 143.975 },
    },
  ],
  'Apollo Bay': [
    {
      name: 'Apollo Bay Bakery',
      category: '餐饮',
      setting: 'indoor',
      notes: '加油站 + 午餐',
      detour: '+3 min',
      rating: 4.5,
      durationMin: 30,
      coords: { lat: -38.755, lng: 143.669 },
    },
  ],
}

function SmartStops({
  city,
  existing,
  onAdd,
}: {
  city: string
  existing: string[]
  onAdd: (p: Omit<PlaceStop, 'id'>) => void
}) {
  const list = (STOPS[city] || []).filter((s) => !existing.includes(s.name))
  const { t } = useT()
  if (!list.length) return null
  return (
    <div className="paper p-4">
      <div className="text-sm font-medium">{t('plan.smartStops')}</div>
      <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
        {t('plan.smartHint')}
      </p>
      <div className="mt-3 space-y-2">
        {list.map((s) => (
          <div key={s.name} className="flex items-start justify-between gap-3 rounded-2xl p-3" style={{ background: 'var(--bg-2)' }}>
            <div>
              <div className="font-medium">{s.name}</div>
              <div className="text-xs" style={{ color: 'var(--muted)' }}>
                {s.detour} detour · ⭐ {s.rating} · {s.durationMin} min · {s.notes}
              </div>
            </div>
            <div className="flex gap-1">
              <TripButton className="btn px-2 py-1 text-xs" onClick={() => onAdd(s)}>
                {t('plan.add')}
              </TripButton>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
