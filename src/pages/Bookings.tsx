import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useApp, useTrip } from '../store'
import { BOOKING_STATUS, KINDS } from '../catalog'
import type { BookingStatus, SavedKind } from '../types'
import { Label, Modal, Tone } from '../ui'
import { money } from '../lib'
import BookingSearch from '../BookingSearch'
import { bookingStatusLabel, kindLabel, useT } from '../i18n'
import type { Booking } from '../types'
import { bookingBudgetCategory } from '../domain'

export default function Bookings() {
  const { id } = useParams()
  const trip = useTrip(id)
  const { updateBooking, addBooking, removeBooking, addExpense } = useApp()
  const { t } = useT()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Booking | undefined>()
  if (!trip) return null

  const groups = Object.keys(KINDS) as SavedKind[]

  return (
    <div>
      <div className="mb-5 flex items-end justify-between">
        <div>
          <h1 className="display text-4xl">{t('book.title')}</h1>
        </div>
        <button className="btn" onClick={() => { setEditing(undefined); setOpen(true) }}>
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
                          {b.kind === 'hotel' && b.checkout ? ` → ${b.checkout}` : ''}
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
                          onClick={() => {
                            const needsRate = b.cost && b.cost.currency !== trip.homeCurrency && b.homeAmount == null && b.exchangeRate == null
                            if (needsRate && (st === 'booked' || st === 'paid')) {
                              setEditing({ ...b, status: st })
                              setOpen(true)
                            } else updateBooking(trip.id, b.id, { status: st })
                          }}
                        >
                          {bookingStatusLabel(t, st)}
                        </button>
                      ))}
                      {b.url && (
                        <a className="btn btn-soft px-2 py-1 text-xs no-underline" href={b.url} target="_blank" rel="noreferrer">
                          {t('book.openSite')}
                        </a>
                      )}
                      <button className="btn btn-ghost px-2 py-1 text-xs" onClick={() => { setEditing(b); setOpen(true) }}>
                        {t('book.edit')}
                      </button>
                      {b.status === 'paid' && b.cost && !trip.expenses.some((expense) => expense.bookingId === b.id) && (
                        <button
                          className="btn btn-soft px-2 py-1 text-xs"
                          onClick={() => addExpense(trip.id, {
                            title: b.name,
                            amount: b.cost!.amount,
                            currency: b.cost!.currency,
                            homeAmount: b.homeAmount ?? (b.cost!.currency === trip.homeCurrency ? b.cost!.amount : undefined),
                            exchangeRate: b.exchangeRate,
                            category: bookingBudgetCategory(b.kind),
                            date: b.date || new Date().toISOString().slice(0, 10),
                            paidBy: trip.members.find((member) => member.id === 'me')?.id || trip.members[0]?.id || '',
                            split: 'equal',
                            excluded: [],
                            status: 'paid',
                            notes: b.notes,
                            bookingId: b.id,
                          })}
                        >
                          {t('book.toExpense')}
                        </button>
                      )}
                      {trip.expenses.some((expense) => expense.bookingId === b.id) && <Tone tone="good">{t('book.expenseLinked')}</Tone>}
                      <button className="btn btn-ghost px-2 py-1 text-xs" onClick={() => removeBooking(trip.id, b.id)}>
                        {t('book.delete')}
                      </button>
                    </div>
                    {b.notes && <p className="mt-2 text-sm" style={{ color: 'var(--muted)' }}>{b.notes}</p>}
                  </div>
                ))}
              </div>
            </section>
          )
        })}
      </div>
      <AddBooking
        key={editing?.id || 'new'}
        open={open}
        initial={editing}
        homeCurrency={trip.homeCurrency}
        onClose={() => setOpen(false)}
        onAdd={(b) => {
          if (editing) updateBooking(trip.id, editing.id, b)
          else addBooking(trip.id, b)
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
  initial,
  homeCurrency,
}: {
  open: boolean
  onClose: () => void
  onAdd: (b: Omit<Booking, 'id'>) => void
  initial?: Booking
  homeCurrency: string
}) {
  const { t } = useT()
  const [kind, setKind] = useState<SavedKind>(initial?.kind || 'hotel')
  const [name, setName] = useState(initial?.name || '')
  const [url, setUrl] = useState(initial?.url || '')
  const [status, setStatus] = useState<BookingStatus>(initial?.status || 'need')
  const [date, setDate] = useState(initial?.date || '')
  const [checkout, setCheckout] = useState(initial?.checkout || '')
  const [confirmation, setConfirmation] = useState(initial?.confirmation || '')
  const [cost, setCost] = useState(initial?.cost ? String(initial.cost.amount) : '')
  const [currency, setCurrency] = useState(initial?.cost?.currency || homeCurrency)
  const [notes, setNotes] = useState(initial?.notes || '')
  const [rate, setRate] = useState(initial?.exchangeRate ? String(initial.exchangeRate) : '')
  const [error, setError] = useState('')
  const needsRate = !!cost && currency !== homeCurrency

  function save() {
    if (!name.trim()) return
    if (kind === 'hotel' && checkout && (!date || checkout <= date)) return setError(t('decision.dateError'))
    if (needsRate && Number(rate) <= 0) return setError(t('book.rateRequired'))
    const exchangeRate = needsRate ? Number(rate) : cost ? 1 : undefined
    onAdd({
      kind,
      name: name.trim(),
      status,
      date: date || undefined,
      checkout: kind === 'hotel' ? checkout || undefined : undefined,
      confirmation: confirmation || undefined,
      cost: cost ? { amount: Number(cost), currency } : undefined,
      homeAmount: cost && exchangeRate ? Number(cost) * exchangeRate : undefined,
      exchangeRate,
      url: url || undefined,
      notes: notes || undefined,
      sourceSavedId: initial?.sourceSavedId,
    })
  }
  return (
    <Modal open={open} title={initial ? t('book.editTitle') : t('book.addTitle')} onClose={onClose}>
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
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>{t('book.date')}</Label>
            <input className="field" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label>{t('book.status')}</Label>
            <select className="field" value={status} onChange={(e) => setStatus(e.target.value as BookingStatus)}>
              {(Object.keys(BOOKING_STATUS) as BookingStatus[]).map((value) => <option key={value} value={value}>{bookingStatusLabel(t, value)}</option>)}
            </select>
          </div>
        </div>
        {kind === 'hotel' && <label className="block space-y-2 text-sm"><span>{t('decision.checkout')}</span><input className="field" type="date" value={checkout} onChange={(event) => setCheckout(event.target.value)} /></label>}
        <input className="field" placeholder={t('book.confirmation')} value={confirmation} onChange={(e) => setConfirmation(e.target.value)} />
        <div className="grid grid-cols-2 gap-2">
          <input className="field" type="number" min={0} placeholder={t('book.cost')} value={cost} onChange={(e) => setCost(e.target.value)} />
          <select className="field" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {['AUD', 'CNY', 'USD', 'JPY', 'EUR', 'IDR'].map((value) => <option key={value}>{value}</option>)}
          </select>
        </div>
        {needsRate && (
          <div>
            <Label>{t('aa.rate', { from: currency, to: homeCurrency })}</Label>
            <input className="field" type="number" min={0} step="0.000001" value={rate} onChange={(e) => setRate(e.target.value)} placeholder={t('aa.ratePh')} />
            {Number(rate) > 0 && <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>{currency} {Number(cost).toLocaleString()} ≈ {money(Number(cost) * Number(rate), homeCurrency)}</p>}
          </div>
        )}
        <input className="field" placeholder={t('book.url')} value={url} onChange={(e) => setUrl(e.target.value)} />
        <textarea className="field min-h-[90px]" placeholder={t('book.notes')} value={notes} onChange={(e) => setNotes(e.target.value)} />
        {error && <p className="text-sm" style={{ color: 'var(--warn)' }}>{error}</p>}
        <button
          className="btn w-full"
          disabled={!name.trim() || (!!cost && Number(cost) < 0)}
          onClick={save}
        >
          {initial ? t('book.save') : t('book.add')}
        </button>
      </div>
    </Modal>
  )
}
