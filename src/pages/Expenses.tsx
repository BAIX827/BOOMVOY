import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useApp, useTrip } from '../store'
import { BUDGET_CATS } from '../catalog'
import { money } from '../lib'
import { settle } from '../domain'
import { Label, Modal } from '../ui'
import { namedCat, useT } from '../i18n'

export default function Expenses() {
  const { id } = useParams()
  const trip = useTrip(id)
  const { addExpense, removeExpense, addGift, updateGift } = useApp()
  const { t } = useT()
  const [open, setOpen] = useState(false)
  if (!trip) return null
  const { transfers } = settle(trip)
  const name = (mid: string) => trip.members.find((m) => m.id === mid)?.name || mid

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="display text-4xl">{t('aa.title')}</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
            {t('aa.blurb')}
          </p>
        </div>
        <button className="btn" onClick={() => setOpen(true)}>
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
        open={open}
        members={trip.members}
        onClose={() => setOpen(false)}
        onAdd={(e) => {
          addExpense(trip.id, e)
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
}: {
  open: boolean
  onClose: () => void
  onAdd: (e: {
    title: string
    amount: number
    currency: string
    category: string
    date: string
    paidBy: string
    split: 'equal'
    excluded: string[]
    status: 'paid'
  }) => void
  members: { id: string; name: string }[]
}) {
  const { t } = useT()
  const [title, setTitle] = useState(t('aa.dinner'))
  const [amount, setAmount] = useState(12800)
  const [currency, setCurrency] = useState('JPY')
  const [category, setCategory] = useState('餐饮')
  const [paidBy, setPaidBy] = useState(members[0]?.id || '')
  const [excluded, setExcluded] = useState<string[]>([])
  return (
    <Modal open={open} title={t('aa.addTitle')} onClose={onClose}>
      <div className="space-y-3">
        <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} />
        <div className="grid grid-cols-2 gap-2">
          <input className="field" type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          <select className="field" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {['AUD', 'JPY', 'USD', 'CNY'].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
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
        </div>
        <button
          className="btn w-full"
          onClick={() =>
            onAdd({
              title,
              amount,
              currency,
              category,
              date: new Date().toISOString().slice(0, 10),
              paidBy,
              split: 'equal',
              excluded,
              status: 'paid',
            })
          }
        >
          {t('aa.save')}
        </button>
      </div>
    </Modal>
  )
}
