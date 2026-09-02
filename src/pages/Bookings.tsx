import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useApp, useTrip } from '../store'
import { BOOKING_STATUS, KINDS } from '../catalog'
import type { BookingStatus, SavedKind } from '../types'
import { Label, Modal, Tone } from '../ui'
import { money } from '../lib'
import BookingSearch from '../BookingSearch'

export default function Bookings() {
  const { id } = useParams()
  const trip = useTrip(id)
  const { updateBooking, addBooking } = useApp()
  const [open, setOpen] = useState(false)
  if (!trip) return null

  const groups = ['flight', 'hotel', 'rental-car', 'activity', 'restaurant'] as SavedKind[]

  return (
    <div>
      <div className="mb-5 flex items-end justify-between">
        <div>
          <h1 className="display text-4xl">预订中心</h1>
          <p className="hand mt-1 text-xl" style={{ color: 'var(--muted)' }}>
            登机牌一点就比价。订完切回来，Boom 弹出一张小条让你记。
          </p>
        </div>
        <button className="btn" onClick={() => setOpen(true)}>
          登记一项
        </button>
      </div>

      <div className="mb-6">
        <BookingSearch trip={trip} />
      </div>

      <div className="space-y-6">
        {groups.map((kind) => {
          const items = trip.bookings.filter((b) => b.kind === kind)
          if (!items.length) return null
          const done = items.filter((b) => b.status === 'booked' || b.status === 'paid').length
          return (
            <section key={kind}>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="display text-2xl">
                  {KINDS[kind].icon} {KINDS[kind].label}
                </h2>
                <span className="text-sm" style={{ color: 'var(--muted)' }}>
                  {done}/{items.length}
                </span>
              </div>
              <div className="space-y-2">
                {items.map((b) => (
                  <div key={b.id} className="ticket p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-medium">{b.name}</div>
                        <div className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
                          {b.date || '日期待定'}
                          {b.confirmation ? ` · ${b.confirmation}` : ''}
                          {b.cost ? ` · ${money(b.cost.amount, b.cost.currency)}` : ''}
                        </div>
                      </div>
                      <Tone tone={BOOKING_STATUS[b.status].tone}>{BOOKING_STATUS[b.status].label}</Tone>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1">
                      {(Object.keys(BOOKING_STATUS) as BookingStatus[]).map((st) => (
                        <button
                          key={st}
                          className={b.status === st ? 'btn px-2 py-1 text-xs' : 'btn btn-ghost px-2 py-1 text-xs'}
                          onClick={() => updateBooking(trip.id, b.id, { status: st })}
                        >
                          {BOOKING_STATUS[st].label}
                        </button>
                      ))}
                      {b.url && (
                        <a className="btn btn-soft px-2 py-1 text-xs no-underline" href={b.url} target="_blank" rel="noreferrer">
                          打开平台
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )
        })}
      </div>
      <AddBooking
        open={open}
        onClose={() => setOpen(false)}
        onAdd={(b) => {
          addBooking(trip.id, b)
          setOpen(false)
        }}
      />
    </div>
  )
}

function AddBooking({
  open,
  onClose,
  onAdd,
}: {
  open: boolean
  onClose: () => void
  onAdd: (b: { kind: SavedKind; name: string; status: BookingStatus; date?: string; url?: string }) => void
}) {
  const [kind, setKind] = useState<SavedKind>('hotel')
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  return (
    <Modal open={open} title="登记预订" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <Label>类型</Label>
          <select className="field" value={kind} onChange={(e) => setKind(e.target.value as SavedKind)}>
            {Object.entries(KINDS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
        <input className="field" placeholder="名称" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="field" placeholder="预订链接" value={url} onChange={(e) => setUrl(e.target.value)} />
        <button className="btn w-full" disabled={!name} onClick={() => onAdd({ kind, name, status: 'need', url })}>
          加入
        </button>
      </div>
    </Modal>
  )
}
