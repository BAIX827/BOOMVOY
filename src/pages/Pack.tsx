import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Luggage, Plus, Trash2 } from 'lucide-react'
import { useApp, useTrip } from '../store'
import type { PackBag, PackCategory, PackItem, PackingState } from '../types'
import {
  PACK_BAGS,
  PACK_CATS,
  FLIGHT_TIPS,
  applyReturnExtras,
  applyWeather,
  customPackItem,
  emptyPacking,
  tripFlies,
  tripNights,
  weatherRange,
} from '../packing'
import { Label } from '../ui'
import { useT } from '../i18n'

function itemName(item: PackItem, t: (key: string) => string) {
  if (item.catalogId) {
    const key = `pack.item.${item.catalogId}`
    const label = t(key)
    if (label !== key) return label
  }
  return item.name
}

export default function Pack() {
  const { id } = useParams()
  const trip = useTrip(id)
  const updateTrip = useApp((s) => s.updateTrip)
  const { t } = useT()
  const [tipsOpen, setTipsOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [cat, setCat] = useState<PackCategory>('other')
  const [bag, setBag] = useState<PackBag>('suitcase')

  useEffect(() => {
    if (!trip || trip.packing) return
    updateTrip(trip.id, { packing: emptyPacking(trip) })
  }, [trip?.id, trip?.packing, trip, updateTrip])

  const packing = trip?.packing

  const grouped = useMemo(() => {
    if (!packing) return []
    const groups = packing.groupBy === 'category' ? PACK_CATS : PACK_BAGS
    return groups
      .map((g) => ({
        key: g,
        items: packing.items.filter((it) => (packing.groupBy === 'category' ? it.category : it.bag) === g),
      }))
      .filter((g) => g.items.length > 0)
  }, [packing])

  if (!trip || !packing) return null

  const currentTrip = trip
  const list = packing

  function save(next: PackingState) {
    updateTrip(currentTrip.id, { packing: next })
  }

  function patchItem(itemId: string, patch: Partial<PackItem>) {
    save({ ...list, items: list.items.map((it) => (it.id === itemId ? { ...it, ...patch } : it)) })
  }

  function removeItem(item: PackItem) {
    save({
      ...list,
      items: list.items.filter((it) => it.id !== item.id),
      dismissed:
        item.catalogId && !list.dismissed.includes(item.catalogId) ? [...list.dismissed, item.catalogId] : list.dismissed,
    })
  }

  const phase = list.phase
  const packedKey = phase === 'out' ? 'packedOut' : 'packedBack'
  const done = list.items.filter((it) => it[packedKey]).length
  const leftBehind = list.items.filter((it) => it.packedOut && !it.packedBack).length
  const wx = weatherRange(currentTrip)
  const nights = tripNights(currentTrip)
  const flies = tripFlies(currentTrip)

  return (
    <div className="space-y-5" data-guide="pack-list">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display text-4xl">{phase === 'out' ? t('pack.outTitle') : t('pack.backTitle')}</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
            {phase === 'out' ? t('pack.outHint') : t('pack.backHint')}
          </p>
        </div>
        <div className="text-right">
          <div className="display text-3xl">
            {done}/{list.items.length}
          </div>
          {phase === 'back' && leftBehind > 0 && (
            <div className="mt-1 text-xs" style={{ color: 'var(--warn)' }}>
              {t('pack.leftBehind', { n: leftBehind })}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {phase === 'out' ? (
          <button className="btn btn-accent" onClick={() => save(applyReturnExtras({ ...list, phase: 'back' }))}>
            {t('pack.ready')}
          </button>
        ) : (
          <button className="btn" onClick={() => save({ ...list, phase: 'out' })}>
            {t('pack.backToOut')}
          </button>
        )}
        <button
          className={list.groupBy === 'category' ? 'btn' : 'btn btn-ghost'}
          onClick={() => save({ ...list, groupBy: 'category' })}
        >
          {t('pack.byCat')}
        </button>
        <button
          className={list.groupBy === 'bag' ? 'btn' : 'btn btn-ghost'}
          onClick={() => save({ ...list, groupBy: 'bag' })}
        >
          {t('pack.byBag')}
        </button>
      </div>

      <div className="paper flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="text-sm" style={{ color: 'var(--muted)' }}>
          {t('pack.weatherLine', { n: nights, min: wx.tMin, max: wx.tMax })}
        </div>
        <button className="btn btn-ghost text-sm" onClick={() => save(applyWeather(currentTrip, list))}>
          {t('pack.fillWeather')}
        </button>
      </div>

      <div className="paper overflow-hidden" data-guide="pack-tips">
        <button
          type="button"
          className="flex w-full items-center justify-between px-5 py-3 text-left"
          onClick={() => setTipsOpen((v) => !v)}
        >
          <span className="text-sm font-medium">
            {flies ? t('pack.tips') : t('pack.tipsMaybe')}
          </span>
          <span className="text-xs" style={{ color: 'var(--muted)' }}>
            {tipsOpen ? t('pack.tipsHide') : t('pack.tipsShow')}
          </span>
        </button>
        {tipsOpen && (
          <div className="grid gap-3 border-t px-5 py-4 sm:grid-cols-2" style={{ borderColor: 'var(--line)' }}>
            {FLIGHT_TIPS.map((tip) => (
              <article key={tip} className="rounded-2xl p-3" style={{ background: 'color-mix(in srgb, var(--ink) 5%, transparent)' }}>
                <div className="text-sm font-medium">{t(`pack.tip.${tip}t`)}</div>
                <p className="mt-1 text-xs leading-5" style={{ color: 'var(--muted)' }}>
                  {t(`pack.tip.${tip}s`)}
                </p>
              </article>
            ))}
          </div>
        )}
      </div>

      {grouped.map((g) => (
        <section key={g.key} className="paper overflow-hidden">
          <div className="border-b px-5 py-3 text-sm" style={{ borderColor: 'var(--line)', color: 'var(--muted)' }}>
            {list.groupBy === 'category' ? t(`pack.cat.${g.key}`) : t(`pack.bag.${g.key}`)}
          </div>
          <ul>
            {g.items.map((item) => {
              const checked = item[packedKey]
              const warnBack = phase === 'back' && item.packedOut && !item.packedBack
              return (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center gap-3 border-b px-5 py-3 last:border-b-0"
                  style={{ borderColor: 'var(--line)' }}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={checked}
                    onChange={(e) => patchItem(item.id, { [packedKey]: e.target.checked })}
                  />
                  <div className="min-w-0 flex-1">
                    <div className={checked ? 'text-sm line-through' : 'text-sm'} style={{ opacity: checked ? 0.55 : 1 }}>
                      {itemName(item, t)}
                      {item.qty > 1 ? ` ×${item.qty}` : ''}
                      {item.suggested ? (
                        <span className="ml-2 text-[11px]" style={{ color: 'var(--accent)' }}>
                          {t('pack.suggested')}
                        </span>
                      ) : null}
                    </div>
                    {warnBack && (
                      <div className="mt-0.5 text-xs" style={{ color: 'var(--warn)' }}>
                        {t('pack.bringBack')}
                      </div>
                    )}
                  </div>
                  {list.groupBy === 'category' && (
                    <select
                      className="field w-auto py-1 text-xs"
                      value={item.bag}
                      onChange={(e) => patchItem(item.id, { bag: e.target.value as PackBag })}
                      aria-label={t('pack.bag')}
                    >
                      {PACK_BAGS.map((b) => (
                        <option key={b} value={b}>
                          {t(`pack.bag.${b}`)}
                        </option>
                      ))}
                    </select>
                  )}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="btn btn-ghost px-2 py-1 text-xs"
                      onClick={() => patchItem(item.id, { qty: Math.max(1, item.qty - 1) })}
                    >
                      −
                    </button>
                    <span className="min-w-4 text-center text-xs">{item.qty}</span>
                    <button
                      type="button"
                      className="btn btn-ghost px-2 py-1 text-xs"
                      onClick={() => patchItem(item.id, { qty: item.qty + 1 })}
                    >
                      +
                    </button>
                  </div>
                  <button type="button" className="btn btn-ghost px-2 py-1" onClick={() => removeItem(item)} aria-label={t('pack.delete')}>
                    <Trash2 size={14} />
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}

      <form
        className="paper space-y-3 p-5"
        onSubmit={(e) => {
          e.preventDefault()
          if (!draft.trim()) return
          save({ ...list, items: [...list.items, customPackItem(draft, cat, bag)] })
          setDraft('')
        }}
      >
        <div className="flex items-center gap-2 text-sm">
          <Luggage size={16} /> {t('pack.add')}
        </div>
        <input className="field" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={t('pack.addPh')} />
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>{t('pack.category')}</Label>
            <select className="field" value={cat} onChange={(e) => setCat(e.target.value as PackCategory)}>
              {PACK_CATS.map((c) => (
                <option key={c} value={c}>
                  {t(`pack.cat.${c}`)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>{t('pack.bag')}</Label>
            <select className="field" value={bag} onChange={(e) => setBag(e.target.value as PackBag)}>
              {PACK_BAGS.map((b) => (
                <option key={b} value={b}>
                  {t(`pack.bag.${b}`)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button className="btn" type="submit" disabled={!draft.trim()}>
          <Plus size={15} /> {t('pack.addBtn')}
        </button>
      </form>
    </div>
  )
}
