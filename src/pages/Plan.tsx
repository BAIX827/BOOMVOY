import { useMemo, useState } from 'react'
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
import { GripVertical, Plus, Sparkles, Trash2 } from 'lucide-react'
import { useApp, useTrip } from '../store'
import type { PlaceSetting, PlaceStop, PlanVariant, Priority, TransportMode } from '../types'
import { PRIORITY, SETTING, TRANSPORT, WEATHER } from '../catalog'
import { formatDayLong, money, nearestNeighbor } from '../lib'
import { Label, Modal, Tone } from '../ui'
import { activePlaces, dayDistance, outdoorRatio, suggestedSwap, weatherAdvice } from '../domain'
import DaySuggest from '../DaySuggest'

export default function Plan() {
  const { id } = useParams()
  const trip = useTrip(id)
  const { addDayPlace, removePlace, reorderPlaces, setActivePlan, updatePlace, updateTrip, replacePlaces } = useApp()
  const [dayId, setDayId] = useState(trip?.days[0]?.id)
  const [open, setOpen] = useState(false)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const day = trip?.days.find((d) => d.id === dayId) || trip?.days[0]
  const places = day ? activePlaces(day) : []
  const advice = day ? weatherAdvice(day) : null
  const dist = dayDistance(places)
  const swap = day ? suggestedSwap(day) : null

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
        <h1 className="display mb-3 text-3xl">行程</h1>
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
              {formatDayLong(day.date)}
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
            {WEATHER[day.weather.condition].icon} {day.weather.tMin}–{day.weather.tMax}°C · 雨 {day.weather.rainProb}%
          </span>
          <span className="chip">{TRANSPORT[day.transportMode].icon} {TRANSPORT[day.transportMode].label}</span>
          {day.stay && <span className="chip">🏨 {day.stay}</span>}
          <span className="chip">户外 {Math.round(outdoorRatio(places) * 100)}%</span>
          {dist.km > 0 && (
            <span className="chip">
              约 {dist.km.toFixed(1)} km / {dist.minutes} min
            </span>
          )}
        </div>

        {advice && (
          <div className="paper p-4">
            <Tone tone={advice.level === 'warn' ? 'warn' : 'info'}>{advice.title}</Tone>
            <p className="mt-2 text-sm leading-6">{advice.text}</p>
            {advice.suggestSwitch && (
              <button className="btn mt-3 text-sm" onClick={() => setActivePlan(trip.id, day.id, 'B')}>
                切换到雨天 Plan B
              </button>
            )}
          </div>
        )}

        <DaySuggest
          city={day.city}
          date={day.date}
          weather={day.weather}
          existing={places.map((p) => p.name)}
          onApply={(next) => next.forEach((place) => addDayPlace(trip.id, day.id, plan, place))}
          onReplace={(next) => replacePlaces(trip.id, day.id, plan, next)}
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
              <Sparkles size={16} /> 天气替换建议
            </div>
            <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
              上午雨更大：把室内项目提前，户外挪到后面。
            </p>
            <ol className="mt-2 text-sm">
              {swap.map((p) => (
                <li key={p.id}>
                  {p.time} {p.name} · {SETTING[p.setting].label}
                </li>
              ))}
            </ol>
            <button className="btn btn-soft mt-3 text-sm" onClick={() => replacePlaces(trip.id, day.id, 'A', swap)}>
              Apply Changes
            </button>
          </div>
        )}

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={places.map((p) => p.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {places.length === 0 && (
                <div className="paper p-8 text-center text-sm" style={{ color: 'var(--muted)' }}>
                  {plan === 'B'
                    ? '还没有雨天备选。上面有室内建议，也可以自己加。'
                    : '这一天还是空的。上面选一套建议，一键贴进计划表。'}
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
            <Plus size={16} /> 添加地点
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => replacePlaces(trip.id, day.id, plan, nearestNeighbor(places))}
            disabled={places.length < 3}
          >
            Optimize · 就近排序
          </button>
        </div>

        <div>
          <Label>这一天的备注</Label>
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
            addDayPlace(trip.id, day.id, plan, place)
            setOpen(false)
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
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: place.id })
  const style = { transform: CSS.Transform.toString(transform), transition }
  return (
    <div ref={setNodeRef} style={style} className="paper relative p-4">
      {place.booked && (
        <span className="stamp absolute right-10 top-3 z-10">booked</span>
      )}
      <div className="flex items-start gap-3">
        <button className="mt-1 opacity-50" {...attributes} {...listeners} aria-label="拖动">
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
            <span className="chip">{place.category}</span>
            <span className="chip">{SETTING[place.setting].label}</span>
            {place.priority && <span className="chip">{PRIORITY[place.priority]}</span>}
            {place.ticketNeeded && <span className="chip">门票</span>}
            {place.booked && <Tone tone="good">已订</Tone>}
            {place.cost && <span className="chip">{money(place.cost.amount, place.cost.currency)}</span>}
          </div>
          {place.notes && (
            <p className="mt-2 text-sm" style={{ color: 'var(--muted)' }}>
              {place.notes}
            </p>
          )}
          {next && (
            <div className="mt-2 text-xs" style={{ color: 'var(--muted)' }}>
              ↓ {TRANSPORT[place.transportToNext || 'public'].icon} {TRANSPORT[place.transportToNext || 'public'].label}
            </div>
          )}
        </div>
        <label className="text-xs" style={{ color: 'var(--muted)' }}>
          <input type="checkbox" checked={!!place.booked} onChange={(e) => onPatch({ booked: e.target.checked })} /> 预订
        </label>
        <button className="opacity-50 hover:opacity-100" onClick={onRemove} aria-label="删除">
          <Trash2 size={16} />
        </button>
      </div>
    </div>
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

  async function search() {
    if (!q.trim()) return
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}`
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    const data = await res.json()
    setHits(data.slice(0, 5))
  }

  const picked = useMemo(() => hits[0], [hits])

  return (
    <Modal open={open} title="添加地点" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          确定一个点之后，Boom 会按 {city} 再给几套可一键加入的一天。
        </p>
        <input className="field" placeholder="名称，如 Meiji Shrine" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="flex gap-2">
          <input className="field" placeholder="在地图上搜" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="btn btn-ghost" onClick={search}>
            搜
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
            {['景点', '餐饮', '住宿', '交通', '购物', '活动'].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          {(['outdoor', 'indoor', 'mixed'] as PlaceSetting[]).map((s) => (
            <button key={s} className={setting === s ? 'btn' : 'btn btn-ghost'} onClick={() => setSetting(s)}>
              {SETTING[s].label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {(['must', 'want', 'optional'] as Priority[]).map((s) => (
            <button key={s} className={priority === s ? 'btn' : 'btn btn-ghost'} onClick={() => setPriority(s)}>
              {PRIORITY[s]}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={ticket} onChange={(e) => setTicket(e.target.checked)} /> 需要门票
        </label>
        <textarea className="field" placeholder="备注" value={notes} onChange={(e) => setNotes(e.target.value)} />
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
          加入这一天
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
  if (!list.length) return null
  return (
    <div className="paper p-4">
      <div className="text-sm font-medium">Smart Stops · 沿途推荐</div>
      <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
        自驾日会根据路线提示景点、厕所、加油站和餐厅。
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
                Add
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
