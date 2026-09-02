import { useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { useApp, useTrip } from '../store'
import { KINDS } from '../catalog'
import type { DecisionStatus, SavedKind } from '../types'
import { Label, Modal, Tone } from '../ui'
import { money } from '../lib'
import { kindLabel, statusLabel, useT } from '../i18n'
import { STATUS } from '../catalog'

const kinds: SavedKind[] = ['flight', 'hotel', 'restaurant', 'place', 'activity', 'rental-car', 'souvenir', 'route']

export default function Saved() {
  const { id } = useParams()
  const trip = useTrip(id)
  const { addSaved, updateSaved } = useApp()
  const { t } = useT()
  const [kind, setKind] = useState<SavedKind | 'all'>('all')
  const [open, setOpen] = useState(false)
  if (!trip) return null
  const items = trip.saved.filter((s) => kind === 'all' || s.kind === kind)

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display text-4xl">{t('saved.title')}</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
            {t('saved.blurb')}
          </p>
        </div>
        <button className="btn" onClick={() => setOpen(true)}>
          {t('saved.add')}
        </button>
      </div>
      <div className="mb-4 flex gap-2 overflow-auto">
        <FilterChip active={kind === 'all'} onClick={() => setKind('all')}>
          {t('saved.all')}
        </FilterChip>
        {kinds.map((k) => (
          <FilterChip key={k} active={kind === k} onClick={() => setKind(k)}>
            {KINDS[k].icon} {kindLabel(t, k)}
          </FilterChip>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((s) => (
          <article key={s.id} className="paper p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-xs" style={{ color: 'var(--muted)' }}>
                  {KINDS[s.kind].icon} {kindLabel(t, s.kind)}
                </div>
                <div className="display text-2xl leading-tight">{s.name}</div>
                {s.subtitle && <div className="text-sm" style={{ color: 'var(--muted)' }}>{s.subtitle}</div>}
              </div>
              <Tone tone={STATUS[s.status].tone}>{statusLabel(t, s.status)}</Tone>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              {s.price && <span className="chip">{money(s.price.amount, s.price.currency)}</span>}
              {s.rating && <span className="chip">⭐ {s.rating}</span>}
              {s.watchTarget && s.price && (
                <span className="chip">{t('saved.watch', { price: money(s.watchTarget, s.price.currency) })}</span>
              )}
            </div>
            {s.pros && s.pros.length > 0 && (
              <ul className="mt-3 space-y-1 text-sm">
                {s.pros.map((p) => (
                  <li key={p}>👍 {p}</li>
                ))}
              </ul>
            )}
            {s.cons && s.cons.length > 0 && (
              <ul className="mt-1 space-y-1 text-sm">
                {s.cons.map((p) => (
                  <li key={p}>👎 {p}</li>
                ))}
              </ul>
            )}
            {s.status === 'rejected' && s.rejectReason && (
              <p className="mt-2 text-sm" style={{ color: 'var(--muted)' }}>
                {t('saved.reject', { reason: s.rejectReason })}
              </p>
            )}
            {s.notes && <p className="mt-2 text-sm">{s.notes}</p>}
            {s.priceHistory && s.priceHistory.length > 0 && (
              <p className="mt-2 text-xs" style={{ color: 'var(--muted)' }}>
                {t('saved.price', { history: s.priceHistory.map((h) => `${h.date.slice(5)} ${h.amount}`).join(' → ') })}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-1">
              {(Object.keys(STATUS) as DecisionStatus[]).map((st) => (
                <button
                  key={st}
                  className={s.status === st ? 'btn px-2 py-1 text-xs' : 'btn btn-ghost px-2 py-1 text-xs'}
                  onClick={() => updateSaved(trip.id, s.id, { status: st })}
                >
                  {statusLabel(t, st)}
                </button>
              ))}
            </div>
            {s.url && (
              <a className="mt-3 inline-block text-sm" href={s.url} target="_blank" rel="noreferrer">
                {t('saved.open')}
              </a>
            )}
          </article>
        ))}
      </div>
      <AddSaved
        open={open}
        onClose={() => setOpen(false)}
        onAdd={(item) => {
          addSaved(trip.id, item)
          setOpen(false)
        }}
      />
    </div>
  )
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button className={active ? 'btn whitespace-nowrap' : 'btn btn-ghost whitespace-nowrap'} onClick={onClick}>
      {children}
    </button>
  )
}

function AddSaved({
  open,
  onClose,
  onAdd,
}: {
  open: boolean
  onClose: () => void
  onAdd: (item: { kind: SavedKind; name: string; subtitle?: string; status: DecisionStatus; price?: { amount: number; currency: string }; url?: string; notes?: string }) => void
}) {
  const { t } = useT()
  const [kind, setKind] = useState<SavedKind>('hotel')
  const [name, setName] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [price, setPrice] = useState('')
  const [url, setUrl] = useState('')
  const [notes, setNotes] = useState('')
  return (
    <Modal open={open} title={t('saved.add')} onClose={onClose}>
      <div className="space-y-3">
        <div>
          <Label>{t('saved.kind')}</Label>
          <select className="field" value={kind} onChange={(e) => setKind(e.target.value as SavedKind)}>
            {kinds.map((k) => (
              <option key={k} value={k}>
                {kindLabel(t, k)}
              </option>
            ))}
          </select>
        </div>
        <input className="field" placeholder={t('saved.name')} value={name} onChange={(e) => setName(e.target.value)} />
        <input className="field" placeholder={t('saved.extra')} value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
        <input className="field" placeholder={t('saved.pricePh')} value={price} onChange={(e) => setPrice(e.target.value)} />
        <input className="field" placeholder={t('saved.urlPh')} value={url} onChange={(e) => setUrl(e.target.value)} />
        <textarea className="field" placeholder={t('saved.notesPh')} value={notes} onChange={(e) => setNotes(e.target.value)} />
        <button
          className="btn w-full"
          disabled={!name}
          onClick={() =>
            onAdd({
              kind,
              name,
              subtitle,
              status: 'interested',
              url,
              notes,
              price: price ? { amount: Number(price), currency: 'AUD' } : undefined,
            })
          }
        >
          {t('saved.save')}
        </button>
      </div>
    </Modal>
  )
}
