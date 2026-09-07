import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useApp, useTrip } from '../store'
import { BUDGET_CATS } from '../catalog'
import { money } from '../lib'
import { settle } from '../domain'
import { Label, Modal } from '../ui'
import { namedCat, useT } from '../i18n'
import type { Expense } from '../types'

const MAX_AMOUNT = 1_000_000_000_000
function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T12:00:00Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

export default function Expenses() {
  const { id } = useParams()
  const trip = useTrip(id)
  const { addExpense, updateExpense, removeExpense, addGift, updateGift } = useApp()
  const { t } = useT()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Expense | undefined>()
  if (!trip) return null
  const { transfers } = settle(trip)
  const name = (mid: string) => trip.members.find((m) => m.id === mid)?.name || mid

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <h1 className="display text-4xl">{t('aa.title')}</h1>
        <button className="btn" onClick={() => { setEditing(undefined); setOpen(true) }}>
          {t('aa.add')}
        </button>
      </div>

      <div className="paper p-5">
        <h2 className="display text-2xl">{t('aa.settle')}</h2>
        {transfers.length === 0 ? (
          <p className="mt-2 text-sm" style={{ color: 'var(--muted)' }}>
            {t('aa.even')}
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {transfers.map((tr, i) => (
              <li key={i} className="flex justify-between text-sm">
                <span>
                  {name(tr.from)} → {name(tr.to)}
                </span>
                <span className="font-medium">{money(tr.amount, trip.homeCurrency)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-2">
        {trip.expenses.map((e) => (
          <div key={e.id} className="paper flex items-start justify-between gap-3 p-4">
            <div>
              <div className="font-medium">{e.title}</div>
              <div className="text-sm" style={{ color: 'var(--muted)' }}>
                {namedCat(t, e.category)} · {e.date} · {t('aa.paidBy', { name: name(e.paidBy) })} ·
                {e.split === 'equal' ? ` ${t('aa.equal')}` : ` ${t('aa.custom')}`}
                {e.excluded.length ? ` · ${t('aa.excluded')}` : ''}
              </div>
            </div>
            <div className="text-right">
              <div>
                {e.currency === trip.homeCurrency
                  ? money(e.amount, e.currency)
                  : `${e.currency} ${e.amount.toLocaleString()} ≈ ${money(e.homeAmount ?? e.amount * 0.0102, trip.homeCurrency)}`}
              </div>
              <button className="text-xs" style={{ color: 'var(--muted)' }} onClick={() => removeExpense(trip.id, e.id)}>
                {t('aa.delete')}
              </button>
              <button className="ml-2 text-xs" style={{ color: 'var(--muted)' }} onClick={() => { setEditing(e); setOpen(true) }}>
                {t('aa.edit')}
              </button>
            </div>
          </div>
        ))}
      </div>

      <section>
        <h2 className="display mb-3 text-2xl">{t('aa.gifts')}</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {trip.gifts.map((g) => (
            <div key={g.id} className="paper flex items-center justify-between p-3">
              <div>
                <div className="font-medium">
                  {g.forWhom} → {g.item}
                </div>
                <div className="text-xs" style={{ color: 'var(--muted)' }}>
                  {g.city}
                </div>
              </div>
              <select
                className="field w-auto"
                value={g.status}
                onChange={(e) => updateGift(trip.id, g.id, { status: e.target.value as typeof g.status })}
              >
                <option value="need">{t('aa.giftNeed')}</option>
                <option value="bought">{t('aa.giftBought')}</option>
                <option value="packed">{t('aa.giftPacked')}</option>
              </select>
            </div>
          ))}
        </div>
        <button
          className="btn btn-ghost mt-3 text-sm"
          onClick={() => addGift(trip.id, { forWhom: t('aa.giftWho'), item: t('aa.giftItem'), city: trip.destinations[0], status: 'need' })}
        >
          {t('aa.addGift')}
        </button>
      </section>

      <AddExpense
        key={editing?.id || 'new'}
        open={open}
        members={trip.members}
        homeCurrency={trip.homeCurrency}
        initial={editing}
        onClose={() => setOpen(false)}
        onAdd={(e) => {
          if (editing) updateExpense(trip.id, editing.id, e)
          else addExpense(trip.id, e)
          setOpen(false)
        }}
      />
    </div>
  )
}

function AddExpense({
  open,
  onClose,
  onAdd,
  members,
  homeCurrency,
  initial,
}: {
  open: boolean
  onClose: () => void
  onAdd: (e: Omit<Expense, 'id'>) => void
  members: { id: string; name: string }[]
  homeCurrency: string
  initial?: Expense
}) {
  const { t } = useT()
  const [title, setTitle] = useState(initial?.title || t('aa.dinner'))
  const [amount, setAmount] = useState(initial?.amount ?? 0)
  const [currency, setCurrency] = useState(initial?.currency || homeCurrency)
  const [category, setCategory] = useState(initial?.category || '餐饮')
  const [date, setDate] = useState(initial?.date || new Date().toISOString().slice(0, 10))
  const [paidBy, setPaidBy] = useState(initial?.paidBy || members[0]?.id || '')
  const [excluded, setExcluded] = useState<string[]>(initial?.excluded || [])
  const [mode, setMode] = useState<'equal' | 'custom'>(initial?.split === 'equal' || !initial ? 'equal' : 'custom')
  const [shares, setShares] = useState<Record<string, number>>(initial?.split === 'equal' || !initial ? {} : initial.split)
  const [rate, setRate] = useState(initial?.exchangeRate ? String(initial.exchangeRate) : '')
  const [error, setError] = useState('')
  const customShares = Object.fromEntries(members.map((member) => [member.id, shares[member.id] || 0]))
  const shareValuesValid = Object.values(customShares).every((share) => Number.isFinite(share) && share >= 0 && share <= MAX_AMOUNT)
  const customTotal = Object.values(customShares).reduce((sum, share) => sum + share, 0)
  const needsRate = currency !== homeCurrency

  function save() {
    if (!title.trim() || title.length > 20_000 || !Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT
      || !validDate(date)) return setError(t('aa.errorAmount'))
    const exchangeRate = needsRate ? Number(rate) : 1
    const homeAmount = amount * exchangeRate
    if (!Number.isFinite(exchangeRate) || exchangeRate <= 0 || exchangeRate > 1_000_000
      || !Number.isFinite(homeAmount) || homeAmount < 0 || homeAmount > MAX_AMOUNT) return setError(t('aa.errorRate'))
    if (mode === 'equal' && members.every((member) => excluded.includes(member.id))) return setError(t('aa.errorEveryoneExcluded'))
    if (mode === 'custom' && (!shareValuesValid || Math.abs(customTotal - amount) > 0.01)) return setError(t('aa.errorSplit', { amount: amount.toFixed(2), currency }))
    onAdd({
      title: title.trim(),
      amount,
      currency,
      homeAmount,
      exchangeRate,
      category,
      date,
      paidBy,
      split: mode === 'equal' ? 'equal' : customShares,
      excluded: mode === 'equal' ? excluded : members.filter((member) => !(customShares[member.id] > 0)).map((member) => member.id),
      status: initial?.status || 'paid',
      notes: initial?.notes && initial.notes.length <= 20_000 ? initial.notes : undefined,
      bookingId: initial?.bookingId && initial.bookingId.length <= 20_000 ? initial.bookingId : undefined,
    })
  }
  return (
    <Modal open={open} title={initial ? t('aa.editTitle') : t('aa.addTitle')} onClose={onClose}>
      <div className="space-y-3">
        <input className="field" maxLength={20_000} value={title} onChange={(e) => setTitle(e.target.value)} />
        <div className="grid grid-cols-2 gap-2">
          <input className="field" type="number" min={0} max={MAX_AMOUNT} step="0.01" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          <select className="field" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {Array.from(new Set([homeCurrency, 'AUD', 'JPY', 'USD', 'CNY', 'EUR', 'IDR'])).map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        {needsRate && (
          <div>
            <Label>{t('aa.rate', { from: currency, to: homeCurrency })}</Label>
            <input className="field" type="number" min="0.000001" max={1_000_000} step="0.000001" value={rate} onChange={(e) => setRate(e.target.value)} placeholder={t('aa.ratePh')} />
            {Number(rate) > 0 && Number(rate) <= 1_000_000 && <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>{currency} {amount.toLocaleString()} ≈ {money(amount * Number(rate), homeCurrency)}</p>}
          </div>
        )}
        <div>
          <Label>{t('aa.date')}</Label>
          <input className="field" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <select className="field" value={category} onChange={(e) => setCategory(e.target.value)}>
          {BUDGET_CATS.map((c) => (
            <option key={c} value={c}>
              {namedCat(t, c)}
            </option>
          ))}
        </select>
        <div>
          <Label>{t('aa.whoPaid')}</Label>
          <select className="field" value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>{t('aa.splitMode')}</Label>
          <div className="flex gap-2">
            <button className={mode === 'equal' ? 'btn' : 'btn btn-ghost'} onClick={() => setMode('equal')}>{t('aa.equal')}</button>
            <button className={mode === 'custom' ? 'btn' : 'btn btn-ghost'} onClick={() => setMode('custom')}>{t('aa.custom')}</button>
          </div>
        </div>
        {mode === 'equal' ? <div>
          <Label>{t('aa.skip')}</Label>
          <div className="mt-1 flex gap-2">
            {members.map((m) => (
              <button
                key={m.id}
                className={excluded.includes(m.id) ? 'btn' : 'btn btn-ghost'}
                onClick={() => setExcluded((xs) => (xs.includes(m.id) ? xs.filter((x) => x !== m.id) : [...xs, m.id]))}
              >
                {m.name}
              </button>
            ))}
          </div>
        </div> : (
          <div>
            <Label>{t('aa.customAmounts', { currency })}</Label>
            <div className="space-y-2">
              {members.map((member) => (
                <label key={member.id} className="flex items-center justify-between gap-3 text-sm">
                  <span>{member.name}</span>
                  <input className="field w-32" type="number" min={0} max={MAX_AMOUNT} step="0.01" value={shares[member.id] || ''} onChange={(e) => setShares((current) => ({ ...current, [member.id]: Number(e.target.value) }))} />
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs" style={{ color: Math.abs(customTotal - amount) <= 0.01 ? 'var(--muted)' : 'var(--warn)' }}>
              {t('aa.customTotal', { total: customTotal.toFixed(2), amount: amount.toFixed(2), currency })}
            </p>
          </div>
        )}
        {error && <p className="text-sm" style={{ color: 'var(--warn)' }}>{error}</p>}
        <button className="btn w-full" onClick={save}>
          {initial ? t('aa.saveEdit') : t('aa.save')}
        </button>
      </div>
    </Modal>
  )
}
