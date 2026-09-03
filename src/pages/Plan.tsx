import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
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
import { Camera, GripVertical, Plus, Sparkles, Trash2 } from 'lucide-react'
import { useApp, useTrip } from '../store'
import type { PlaceSetting, PlaceStop, PlanVariant, Priority, TransportMode } from '../types'
import { TRANSPORT, WEATHER } from '../catalog'
import { formatDayLong, money, nearestNeighbor, addMinutesToTime, compressPhoto } from '../lib'
import { Label, Modal, Tone } from '../ui'
import { activePlaces, dayDistance, outdoorRatio, suggestedSwap, weatherAdvice } from '../domain'
import DaySuggest from '../DaySuggest'
import { ensurePlaceGeo, ensurePlacesGeo, hopMeta, mapsDayRoute, mapsDirUrl, mapsPlaceUrl, routeHop, type HopRoute } from '../geo'
import { PLACE_CATS, placeCatLabel, priorityLabel, settingLabel, transportLabel, useT } from '../i18n'

export default function Plan() {
  const { id } = useParams()
  const trip = useTrip(id)
  const { addDayPlace, removePlace, reorderPlaces, setActivePlan, updatePlace, updateTrip, replacePlaces } = useApp()
  const { t, locale } = useT()
  const [dayId, setDayId] = useState(trip?.days[0]?.id)
  const [open, setOpen] = useState(false)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const day = trip?.days.find((d) => d.id === dayId) || trip?.days[0]
  const places = day ? activePlaces(day) : []
  const advice = day ? weatherAdvice(day, t) : null
  const dist = dayDistance(places)
  const swap = day ? suggestedSwap(day) : null
  const planned = useMemo(
    () =>
      (trip?.days || []).flatMap((d) =>
        [...d.planA, ...d.planB].map((p) => ({ name: p.name, date: d.date })),
      ),
    [trip?.days],
  )

  useEffect(() => {
    if (!trip || !day) return
    let live = true
    ;(async () => {
      for (const p of places) {
        if (!p.coords) {
          const g = await ensurePlaceGeo(day.city, p)
          if (g.coords && live) updatePlace(trip.id, day.id, day.activePlan, p.id, { coords: g.coords, address: g.address })
        }
      }
    })()
    return () => {
      live = false
    }
  }, [trip?.id, day?.id, places.map((p) => p.id).join(',')])

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
            <button
              key={d.id}
              onClick={() => setDayId(d.id)}
              className="paper min-w-[140px] p-3 text-left"
              style={{ outline: d.id === day.id ? '2px solid var(--ink)' : undefined }}
            >
              <div className="text-xs" style={{ color: 'var(--muted)' }}>
                Day {i + 1} · {WEATHER[d.weather.condition].icon}
              </div>
              <div className="font-medium">{d.city}</div>
              <div className="text-xs" style={{ color: 'var(--muted)' }}>
                {d.date.slice(5)} · Plan {d.activePlan}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="min-w-0 flex-1 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-sm" style={{ color: 'var(--muted)' }}>
              {formatDayLong(day.date, locale)}
            </div>
            <h2 className="display text-4xl">
              Day {trip.days.findIndex((d) => d.id === day.id) + 1} — {day.city}
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {(['A', 'B'] as PlanVariant[]).map((p) => (
              <button key={p} className={plan === p ? 'btn' : 'btn btn-ghost'} onClick={() => setActivePlan(trip.id, day.id, p)}>
                {p === 'A' ? '☀️ Plan A' : '🌧️ Plan B'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-sm">
          <span className="chip">
            {WEATHER[day.weather.condition].icon} {day.weather.tMin}–{day.weather.tMax}°C · {t('plan.rainChip', { n: day.weather.rainProb })}
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
              <button className="btn mt-3 text-sm" onClick={() => setActivePlan(trip.id, day.id, 'B')}>
                {t('plan.switchB')}
              </button>
            )}
          </div>
        )}

        <DaySuggest
          city={day.city}
          date={day.date}
          weather={day.weather}
          existing={places.map((p) => p.name)}
          planned={planned}
          onApply={(next) => {
            void ensurePlacesGeo(currentDay.city, next).then((geo) =>
              geo.forEach((place) => addDayPlace(currentTrip.id, currentDay.id, plan, place)),
            )
          }}
          onReplace={(next) => {
            void ensurePlacesGeo(currentDay.city, next).then((geo) =>
              replacePlaces(
                currentTrip.id,
                currentDay.id,
                plan,
                geo.map((p) => ({ ...p, id: p.id })),
              ),
            )
          }}
        />

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
            <button className="btn btn-soft mt-3 text-sm" onClick={() => replacePlaces(trip.id, day.id, 'A', swap)}>
              {t('plan.apply')}
            </button>
          </div>
        )}

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
                  place={place}
                  next={places[i + 1]}
                  onRemove={() => removePlace(trip.id, day.id, plan, place.id)}
                  onPatch={(patch) => updatePlace(trip.id, day.id, plan, place.id, patch)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <div className="flex flex-wrap gap-2">
          <button className="btn" onClick={() => setOpen(true)}>
            <Plus size={16} /> {t('plan.addPlace')}
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => replacePlaces(trip.id, day.id, plan, nearestNeighbor(places))}
            disabled={places.length < 3}
          >
            {t('plan.optimize')}
          </button>
          {mapsDayRoute(places) && (
            <a className="btn btn-ghost no-underline" href={mapsDayRoute(places)} target="_blank" rel="noreferrer">
              {t('plan.openRoute')}
            </a>
          )}
        </div>

        <div>
          <Label>{t('plan.dayNotes')}</Label>
          <textarea
            className="field min-h-[80px]"
            value={day.notes || ''}
            onChange={(e) =>
              updateTrip(trip.id, {
                days: trip.days.map((d) => (d.id === day.id ? { ...d, notes: e.target.value } : d)),
              })
            }
          />
        </div>
        <AddPlaceModal
          open={open}
          city={day.city}
          onClose={() => setOpen(false)}
          onAdd={(place) => {
            void ensurePlaceGeo(day.city, place).then((g) => {
              addDayPlace(trip.id, day.id, plan, g)
              setOpen(false)
            })
          }}
        />
      </div>
    </div>
  )
}

function SortablePlace({
  place,
  next,
  onRemove,
  onPatch,
}: {
  place: PlaceStop
  next?: PlaceStop
  onRemove: () => void
  onPatch: (p: Partial<PlaceStop>) => void
}) {
  const { t } = useT()
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: place.id })
  const style = { transform: CSS.Transform.toString(transform), transition }
  return (
    <div ref={setNodeRef} style={style} className="paper relative p-4">
      {place.booked && (
        <span className="stamp absolute right-10 top-3 z-10">booked</span>
      )}
      <div className="flex items-start gap-3">
        <button className="mt-1 opacity-50" {...attributes} {...listeners} aria-label={t('plan.drag')}>
          <GripVertical size={16} />
        </button>
        <input
          className="w-[72px] rounded-lg border px-2 py-1 text-sm"
          style={{ borderColor: 'var(--line)', background: 'transparent' }}
          value={place.time || ''}
          onChange={(e) => onPatch({ time: e.target.value })}
          placeholder="09:00"
        />
        <div className="min-w-0 flex-1">
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
            {place.ticketNeeded && place.ticketUrl && (
              <a className="underline" href={place.ticketUrl} target="_blank" rel="noreferrer">
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
        <div className="flex flex-col items-end gap-2">
          <CheckInBtn place={place} onPatch={onPatch} />
          <label className="text-xs" style={{ color: 'var(--muted)' }}>
            <input type="checkbox" checked={!!place.booked} onChange={(e) => onPatch({ booked: e.target.checked })} /> {t('plan.bookingCheck')}
          </label>
          <button className="opacity-50 hover:opacity-100" onClick={onRemove} aria-label={t('plan.delete')}>
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
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
          <button key={m} className={mode === m ? 'btn px-2 py-0.5 text-[11px]' : 'btn btn-ghost px-2 py-0.5 text-[11px]'} onClick={() => onMode(m)}>
            {TRANSPORT[m].icon} {transportLabel(t, m)}
          </button>
        ))}
      </div>
      <div className="text-xs" style={{ color: 'var(--muted)' }}>
        {hop ? t('plan.hopEta', { km: hop.km.toFixed(1), min: hop.minutes }) : t('plan.hopWait')}
        {eta ? ` · ${t('plan.arrive', { time: eta })}` : ''}
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
      <button className="btn btn-ghost px-2 py-1 text-xs" onClick={() => onPatch({ checkedIn: false })}>
        {t('plan.uncheck')}
      </button>
    )
  }
  return (
    <>
      <button className="btn btn-soft px-2 py-1 text-xs" onClick={() => setOpen(true)}>
        <Camera size={12} /> {t('plan.checkIn')}
      </button>
      <Modal open={open} title={t('plan.checkInTitle', { name: place.name })} onClose={() => setOpen(false)}>
        <div className="space-y-3">
          <textarea className="field min-h-[90px]" placeholder={t('plan.feeling')} value={feeling} onChange={(e) => setFeeling(e.target.value)} />
          <input
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
          <button
            className="btn w-full"
            onClick={() => {
              onPatch({ checkedIn: true, checkedInAt: new Date().toISOString(), feeling })
              setOpen(false)
            }}
          >
            {t('plan.saveCheckIn')}
          </button>
        </div>
      </Modal>
    </>
  )
}

function AddPlaceModal({
  open,
  city,
  onClose,
  onAdd,
}: {
  open: boolean
  city: string
  onClose: () => void
  onAdd: (p: Omit<PlaceStop, 'id'>) => void
}) {
  const [name, setName] = useState('')
  const [time, setTime] = useState('10:00')
  const [category, setCategory] = useState('景点')
  const [setting, setSetting] = useState<PlaceSetting>('outdoor')
  const [priority, setPriority] = useState<Priority>('want')
  const [notes, setNotes] = useState('')
  const [ticket, setTicket] = useState(false)
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<Array<{ display_name: string; lat: string; lon: string }>>([])
  const { t } = useT()

  async function search() {
    if (!q.trim()) return
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}`
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    const data = await res.json()
    setHits(data.slice(0, 5))
  }

  const picked = useMemo(() => hits[0], [hits])

  return (
    <Modal open={open} title={t('plan.addTitle')} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          {t('plan.addHint', { city })}
        </p>
        <input className="field" placeholder={t('plan.addName')} value={name} onChange={(e) => setName(e.target.value)} />
        <div className="flex gap-2">
          <input className="field" placeholder={t('plan.searchMap')} value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="btn btn-ghost" onClick={search}>
            {t('plan.search')}
          </button>
        </div>
        {hits.map((h) => (
          <button
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
          </button>
        ))}
        <div className="grid grid-cols-2 gap-2">
          <input className="field" value={time} onChange={(e) => setTime(e.target.value)} />
          <select className="field" value={category} onChange={(e) => setCategory(e.target.value)}>
            {PLACE_CATS.map((c) => (
              <option key={c} value={c}>
                {placeCatLabel(t, c)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          {(['outdoor', 'indoor', 'mixed'] as PlaceSetting[]).map((s) => (
            <button key={s} className={setting === s ? 'btn' : 'btn btn-ghost'} onClick={() => setSetting(s)}>
              {settingLabel(t, s)}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {(['must', 'want', 'optional'] as Priority[]).map((s) => (
            <button key={s} className={priority === s ? 'btn' : 'btn btn-ghost'} onClick={() => setPriority(s)}>
              {priorityLabel(t, s)}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={ticket} onChange={(e) => setTicket(e.target.checked)} /> {t('plan.needTicket')}
        </label>
        <textarea className="field" placeholder={t('plan.notes')} value={notes} onChange={(e) => setNotes(e.target.value)} />
        <button
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
              coords: picked ? { lat: Number(picked.lat), lng: Number(picked.lon) } : undefined,
              address: picked?.display_name,
            })
          }
        >
          {t('plan.addToDay')}
        </button>
      </div>
    </Modal>
  )
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
              <button className="btn px-2 py-1 text-xs" onClick={() => onAdd(s)}>
                {t('plan.add')}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
