import { TripButton, TripInput, TripSelect, TripTextarea } from '../TripControls'
import { useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { useApp, useTrip } from '../store'
import { KINDS } from '../catalog'
import type { DecisionStatus, SavedKind, SavedItem } from '../types'
import ScheduleSaved from '../ScheduleSaved'
import { Link } from 'react-router-dom'
import { useTripContext } from '../useTripContext'
import { Label, Modal, Tone } from '../ui'
import { money, safeWebUrl } from '../lib'
import { kindLabel, statusLabel, useT } from '../i18n'
import { STATUS } from '../catalog'

const kinds: SavedKind[] = ['flight', 'hotel', 'restaurant', 'place', 'activity', 'rental-car', 'souvenir', 'route']
const MAX_AMOUNT = 1_000_000_000_000
const MAX_TEXT_LENGTH = 20_000

export default function Saved() {
  const { id } = useParams()
  const trip = useTrip(id)
  const { addSaved, updateSaved, removeSaved, addCompareBoard, updateCompareBoard } = useApp()
  const { t } = useT()
  const [kind, setKind] = useState<SavedKind | 'all'>('all')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<SavedItem | undefined>()
  const [scheduling, setScheduling] = useState<SavedItem | null>(null)
  const { href } = useTripContext(trip)
  if (!trip) return null
  const items = trip.saved.filter((s) => kind === 'all' || s.kind === kind)

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h1 className="display text-4xl">{t('saved.title')}</h1>
        <TripButton className="btn" onClick={() => { setEditing(undefined); setOpen(true) }}>
          {t('saved.add')}
        </TripButton>
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
      {items.length === 0 && <p className="paper p-5 text-sm" role="status" style={{ color: 'var(--muted)' }}>{t('saved.empty')}</p>}
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((s) => {
          const safeUrl = safeWebUrl(s.url)
          return <article key={s.id} className="paper p-4">
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
                <TripButton
                  key={st}
                  className={s.status === st ? 'btn px-2 py-1 text-xs' : 'btn btn-ghost px-2 py-1 text-xs'}
                  onClick={() => updateSaved(trip.id, s.id, { status: st })}
                >
                  {statusLabel(t, st)}
                </TripButton>
              ))}
            </div>
            {safeUrl && (
              <a className="mt-3 inline-block text-sm" href={safeUrl} target="_blank" rel="noreferrer">
                {t('saved.open')}
              </a>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {['hotel', 'restaurant', 'place', 'activity', 'souvenir'].includes(s.kind) && <TripButton className="btn px-3 py-2 text-sm" onClick={() => setScheduling(s)}>{t('journey.schedule')}</TripButton>}
              {(() => {
                const board = trip.compares.find((item) => item.kind === s.kind)
                const added = !!board?.itemIds.includes(s.id)
                return (
                  <TripButton
                    className="btn btn-soft px-3 py-1 text-xs"
                    disabled={added}
                    onClick={() => {
                      if (board) updateCompareBoard(trip.id, board.id, { itemIds: [...board.itemIds, s.id] })
                      else addCompareBoard(trip.id, { kind: s.kind, title: t('compare.autoTitle', { kind: kindLabel(t, s.kind) }), itemIds: [s.id] })
                    }}
                  >
                    {added ? t('saved.inCompare') : t('saved.addCompare')}
                  </TripButton>
                )
              })()}
              {trip.compares.some((board) => board.itemIds.includes(s.id)) && <Link className="btn btn-ghost px-3 py-1 text-xs no-underline" to={href('compare')}>{t('trip.compare')} →</Link>}
              <TripButton className="btn btn-ghost px-3 py-1 text-xs" onClick={() => { setEditing(s); setOpen(true) }}>{t('saved.edit')}</TripButton>
              <TripButton className="btn btn-ghost px-3 py-1 text-xs" onClick={() => removeSaved(trip.id, s.id)}>
                {t('saved.delete')}
              </TripButton>
            </div>
          </article>
        })}
      </div>
      {scheduling && <ScheduleSaved key={scheduling.id} trip={trip} item={scheduling} onClose={() => setScheduling(null)} />}
      <SavedEditor
        key={editing?.id || `new-${open}`}
        initial={editing}
        homeCurrency={trip.homeCurrency}
        open={open}
        onClose={() => setOpen(false)}
        onAdd={(item) => {
          if (editing) updateSaved(trip.id, editing.id, item)
          else addSaved(trip.id, item)
          setOpen(false)
        }}
      />
    </div>
  )
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <TripButton data-browse className={active ? 'btn whitespace-nowrap' : 'btn btn-ghost whitespace-nowrap'} onClick={onClick}>
      {children}
    </TripButton>
  )
}

export function SavedEditor({
  initial,
  homeCurrency,
  open,
  onClose,
  onAdd,
}: {
  initial?: SavedItem
  homeCurrency: string
  open: boolean
  onClose: () => void
  onAdd: (item: Omit<SavedItem, 'id' | 'votes'>) => void
}) {
  const { t } = useT()
  const [kind, setKind] = useState<SavedKind>(initial?.kind || 'hotel')
  const [name, setName] = useState(initial?.name || '')
  const [subtitle, setSubtitle] = useState(initial?.subtitle || '')
  const [price, setPrice] = useState(initial?.price ? String(initial.price.amount) : '')
  const [currency, setCurrency] = useState(initial?.price?.currency || homeCurrency)
  const [meta, setMeta] = useState(initial?.meta || {})
  const [url, setUrl] = useState(initial?.url || '')
  const [notes, setNotes] = useState(initial?.notes || '')
  const amount = price.trim() ? Number(price) : undefined
  const amountValid = amount === undefined || Number.isFinite(amount) && amount >= 0 && amount <= MAX_AMOUNT

  function save() {
    if (!name || !amountValid || name.length > MAX_TEXT_LENGTH || subtitle.length > MAX_TEXT_LENGTH || notes.length > MAX_TEXT_LENGTH) return
    onAdd({
      ...initial,
      kind,
      name,
      subtitle,
      status: initial?.status || 'interested',
      url: safeWebUrl(url.trim()),
      notes,
      meta: { ...meta, ...(initial?.meta?.decisionSource === 'google' ? { decisionSource: 'saved' } : {}) },
      decision: initial?.decision?.source === 'google' ? undefined : initial?.decision,
      price: amount === undefined ? undefined : { amount, currency },
    })
  }

  return (
    <Modal open={open} title={initial ? t('saved.editTitle') : t('saved.add')} onClose={onClose}>
      <div className="space-y-3">
        <div>
          <Label>{t('saved.kind')}</Label>
          <TripSelect className="field" disabled={!!initial} value={kind} onChange={(e) => setKind(e.target.value as SavedKind)}>
            {kinds.map((k) => (
              <option key={k} value={k}>
                {kindLabel(t, k)}
              </option>
            ))}
          </TripSelect>
        </div>
        <TripInput className="field" maxLength={MAX_TEXT_LENGTH} placeholder={t('saved.name')} value={name} onChange={(e) => setName(e.target.value)} />
        <TripInput className="field" maxLength={MAX_TEXT_LENGTH} placeholder={t('saved.extra')} value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
        <TripInput className="field" type="number" min={0} max={MAX_AMOUNT} step="0.01" placeholder={t('saved.pricePh')} value={price} onChange={(e) => setPrice(e.target.value)} />
        <label className="block text-sm">{t('saved.currency')}<TripSelect className="field mt-1" value={currency} onChange={(e) => setCurrency(e.target.value)}>{Array.from(new Set([homeCurrency, 'AUD', 'JPY', 'USD', 'CNY', 'EUR', 'IDR'])).map((value) => <option key={value}>{value}</option>)}</TripSelect></label>
        {kind === 'hotel' && <div className="space-y-3"><label className="block text-sm">{t('saved.priceBasis')}<TripSelect className="field mt-1" value={meta.priceBasis || 'total'} onChange={(e) => setMeta({ ...meta, priceBasis: e.target.value })}><option value="total">{t('saved.totalPrice')}</option><option value="night">{t('saved.nightPrice')}</option></TripSelect></label><p className="text-sm">{t('saved.manualFacts')} · {t('saved.metaHint')}</p>{['breakfast', 'parking', 'cancel', 'size'].map((key) => <label key={key} className="block text-sm">{t('compare.' + (key === 'size' ? 'room' : key))}<TripInput className="field mt-1" maxLength={20000} value={meta[key] || ''} onChange={(e) => setMeta({ ...meta, [key]: e.target.value })} /></label>)}</div>}
        <TripInput className="field" type="url" maxLength={4096} placeholder={t('saved.urlPh')} value={url} onChange={(e) => setUrl(e.target.value)} />
        <TripTextarea className="field" maxLength={MAX_TEXT_LENGTH} placeholder={t('saved.notesPh')} value={notes} onChange={(e) => setNotes(e.target.value)} />
        <TripButton
          className="btn w-full"
          disabled={!name || !amountValid}
          onClick={save}
        >
          {initial ? t('saved.updated') : t('saved.save')}
        </TripButton>
      </div>
    </Modal>
  )
}
