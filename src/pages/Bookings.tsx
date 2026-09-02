import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useApp, useTrip } from '../store'
import { BOOKING_STATUS, KINDS } from '../catalog'
import type { BookingStatus, SavedKind } from '../types'
import { Label, Modal, Tone } from '../ui'
import { money } from '../lib'
import BookingSearch from '../BookingSearch'
import { bookingStatusLabel, kindLabel, useT } from '../i18n'

export default function Bookings() {
  const { id } = useParams()
  const trip = useTrip(id)
  const { updateBooking, addBooking } = useApp()
  const { t } = useT()
  const [open, setOpen] = useState(false)
  if (!trip) return null

  const groups = ['flight', 'hotel', 'rental-car', 'activity', 'restaurant'] as SavedKind[]

  return (
    <div>
      <div className="mb-5 flex items-end justify-between">
        <div>
          <h1 className="display text-4xl">{t('book.title')}</h1>
          <p className="hand mt-1 text-xl" style={{ color: 'var(--muted)' }}>
            {t('book.blurb')}
          </p>
        </div>
        <button className="btn" onClick={() => setOpen(true)}>
          {t('book.register')}
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
                  {KINDS[kind].icon} {kindLabel(t, kind)}
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
                          {b.date || t('book.dateTbd')}
                          {b.confirmation ? ` · ${b.confirmation}` : ''}
                          {b.cost ? ` · ${money(b.cost.amount, b.cost.currency)}` : ''}
                        </div>
                      </div>
                      <Tone tone={BOOKING_STATUS[b.status].tone}>{bookingStatusLabel(t, b.status)}</Tone>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1">
                      {(Object.keys(BOOKING_STATUS) as BookingStatus[]).map((st) => (
                        <button
                          key={st}
                          className={b.status === st ? 'btn px-2 py-1 text-xs' : 'btn btn-ghost px-2 py-1 text-xs'}
                          onClick={() => updateBooking(trip.id, b.id, { status: st })}
                        >
                          {bookingStatusLabel(t, st)}
                        </button>
                      ))}
                      {b.url && (
                        <a className="btn btn-soft px-2 py-1 text-xs no-underline" href={b.url} target="_blank" rel="noreferrer">
                          {t('book.openSite')}
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
  const { t } = useT()
  const [kind, setKind] = useState<SavedKind>('hotel')
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  return (
    <Modal open={open} title={t('book.addTitle')} onClose={onClose}>
      <div className="space-y-3">
        <div>
          <Label>{t('book.kind')}</Label>
          <select className="field" value={kind} onChange={(e) => setKind(e.target.value as SavedKind)}>
            {Object.keys(KINDS).map((k) => (
              <option key={k} value={k}>
                {kindLabel(t, k as SavedKind)}
              </option>
            ))}
          </select>
        </div>
        <input className="field" placeholder={t('book.name')} value={name} onChange={(e) => setName(e.target.value)} />
        <input className="field" placeholder={t('book.url')} value={url} onChange={(e) => setUrl(e.target.value)} />
        <button className="btn w-full" disabled={!name} onClick={() => onAdd({ kind, name, status: 'need', url })}>
          {t('book.add')}
        </button>
      </div>
    </Modal>
  )
}
