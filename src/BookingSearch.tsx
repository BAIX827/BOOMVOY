import { useEffect, useState } from 'react'
import { useApp } from './store'
import type { BookingStatus, SavedKind, Trip } from './types'
import {
  activityLinks,
  flightLinks,
  hotelLinks,
  lookupAir,
  openJawLinks,
  tripFlightPlan,
  tripHotelStays,
  type ShopLink,
} from './bookingLinks'
import { formatDay } from './lib'
import { Label, Modal } from './ui'
import { useT } from './i18n'

type Draft = { kind: SavedKind; name: string; date?: string; url?: string }

const SHOP_KEY = 'boomvoy-shop'

export default function BookingSearch({ trip }: { trip: Trip }) {
  const { t, locale } = useT()
  const plan = tripFlightPlan(trip, locale)
  const stays = tripHotelStays(trip)
  const openJaw = openJawLinks(trip, locale)
  const addBooking = useApp((s) => s.addBooking)
  const [from, setFrom] = useState(plan.outbound.from)
  const [to, setTo] = useState(plan.outbound.to)
  const [go, setGo] = useState(plan.outbound.date)
  const [back, setBack] = useState(plan.sameCity ? plan.inbound.date : '')
  const [draft, setDraft] = useState<Draft | null>(null)

  const custom = flightLinks(from, to, go, trip, back || undefined, locale)

  useEffect(() => {
    const raw = sessionStorage.getItem(SHOP_KEY)
    if (!raw) return
    try {
      setDraft(JSON.parse(raw) as Draft)
    } catch {
      sessionStorage.removeItem(SHOP_KEY)
    }
  }, [])

  useEffect(() => {
    function onVis() {
      if (document.visibilityState !== 'visible') return
      const raw = sessionStorage.getItem(SHOP_KEY)
      if (!raw) return
      try {
        setDraft(JSON.parse(raw) as Draft)
      } catch {
        sessionStorage.removeItem(SHOP_KEY)
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  function shop(href: string, next: Draft) {
    sessionStorage.setItem(SHOP_KEY, JSON.stringify({ ...next, url: href }))
    window.open(href, '_blank', 'noopener')
  }

  return (
    <div className="space-y-5" data-guide="booking-links">
      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="display text-3xl">{t('shop.pass')}</h2>
            <p className="hand mt-1 text-xl" style={{ color: 'var(--muted)' }}>
              {t('shop.passHint')}
            </p>
          </div>
          <button
            className="btn btn-ghost text-sm"
            onClick={() => {
              const raw = sessionStorage.getItem(SHOP_KEY)
              if (raw) {
                try {
                  setDraft(JSON.parse(raw) as Draft)
                  return
                } catch {
                  sessionStorage.removeItem(SHOP_KEY)
                }
              }
              setDraft({
                kind: 'flight',
                name: `${plan.outbound.from} → ${plan.outbound.to}`,
                date: plan.outbound.date,
              })
            }}
          >
            {t('shop.logged')}
          </button>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Pass
            from={plan.outbound.from}
            to={plan.outbound.to}
            date={plan.outbound.date}
            stub="OUTBOUND"
            people={trip.travellers}
            links={flightLinks(plan.outbound.from, plan.outbound.to, plan.outbound.date, trip, undefined, locale)}
            onShop={shop}
          />
          <Pass
            from={plan.inbound.from}
            to={plan.inbound.to}
            date={plan.inbound.date}
            stub="RETURN"
            people={trip.travellers}
            links={flightLinks(plan.inbound.from, plan.inbound.to, plan.inbound.date, trip, undefined, locale)}
            onShop={shop}
          />
        </div>

        {openJaw && (
          <div className="paper mt-4 p-4">
            <div className="text-sm font-medium">{t('shop.openJaw')}</div>
            <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
              {t('shop.openJawHint')}
            </p>
            <LinkRow
              links={openJaw}
              onShop={(href, name) => shop(href, { kind: 'flight', name: `Open-jaw · ${name}`, date: plan.outbound.date, url: href })}
            />
          </div>
        )}

        <div className="paper mt-4 p-4">
          <div className="text-sm font-medium">{t('shop.custom')}</div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <input className="field" value={from} onChange={(e) => setFrom(e.target.value)} placeholder={t('shop.fromPh')} />
            <input className="field" value={to} onChange={(e) => setTo(e.target.value)} placeholder={t('shop.toPh')} />
            <input className="field" type="date" value={go} onChange={(e) => setGo(e.target.value)} />
            <input className="field" type="date" value={back} onChange={(e) => setBack(e.target.value)} />
          </div>
          <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
            {t('shop.customHint', { n: trip.travellers })}
          </p>
          <LinkRow
            links={custom}
            onShop={(href, name) =>
              shop(href, { kind: 'flight', name: `${from} → ${to} · ${name}`, date: go, url: href })
            }
          />
        </div>
      </section>

      {stays.length > 0 && (
        <section>
          <h2 className="display mb-3 text-3xl">{t('shop.keys')}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {stays.map((s) => {
              const links = hotelLinks(s.city, s.checkin, s.checkout, trip, locale)
              const primary = links[0]
              return (
                <div key={s.city + s.checkin} className="keycard p-4">
                  <div className="text-[11px] tracking-[0.2em] text-white/70">GUEST KEY</div>
                  <div className="display mt-1 text-3xl text-white">{s.city}</div>
                  <div className="mt-8 text-sm" style={{ color: 'var(--muted)' }}>
                    {formatDay(s.checkin, locale)} – {formatDay(s.checkout, locale)}
                    {s.stay ? ` · ${s.stay}` : ''}
                  </div>
                  {primary && (
                    <button
                      className="btn mt-3"
                      onClick={() =>
                        shop(primary.href, {
                          kind: 'hotel',
                          name: t('shop.stay', { city: s.city }),
                          date: s.checkin,
                          url: primary.href,
                        })
                      }
                    >
                      {t('shop.openX', { name: primary.name })}
                    </button>
                  )}
                  <LinkRow
                    links={links.slice(1)}
                    onShop={(href, name) =>
                      shop(href, { kind: 'hotel', name: `${s.city} · ${name}`, date: s.checkin, url: href })
                    }
                  />
                </div>
              )
            })}
          </div>
        </section>
      )}

      <section className="paper p-5">
        <h2 className="display text-2xl">{t('shop.acts')}</h2>
        <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
          {t('shop.actsHint')}
        </p>
        <div className="mt-3 flex flex-wrap gap-4">
          {[...new Set(trip.destinations)].map((city) => (
            <div key={city}>
              <div className="text-sm font-medium">{city}</div>
              <LinkRow
                links={activityLinks(city, locale)}
                onShop={(href, name) => shop(href, { kind: 'activity', name: `${city} · ${name}`, url: href })}
              />
            </div>
          ))}
        </div>
      </section>

      <Capture
        key={draft ? `${draft.kind}-${draft.name}-${draft.date || ''}` : 'idle'}
        open={!!draft}
        draft={draft}
        currency={trip.homeCurrency}
        onClose={() => {
          setDraft(null)
          sessionStorage.removeItem(SHOP_KEY)
        }}
        onSave={(item) => {
          addBooking(trip.id, item)
          setDraft(null)
          sessionStorage.removeItem(SHOP_KEY)
        }}
      />
    </div>
  )
}

function Pass({
  from,
  to,
  date,
  stub,
  people,
  links,
  onShop,
}: {
  from: string
  to: string
  date: string
  stub: string
  people: number
  links: ShopLink[]
  onShop: (href: string, draft: Draft) => void
}) {
  const primary = links[0]
  const rest = links.slice(1)
  const fromCode = lookupAir(from)?.iata || from.slice(0, 3).toUpperCase()
  const toCode = lookupAir(to)?.iata || to.slice(0, 3).toUpperCase()
  const { t, locale } = useT()
  return (
    <article className="pass">
      <div className="pass-body">
        <div className="text-[11px] tracking-[0.18em]" style={{ color: 'var(--muted)' }}>
          {formatDay(date, locale)} · {people} PAX
        </div>
        <div className="pass-codes mt-2">
          <span>{fromCode}</span>
          <span className="pass-arrow">→</span>
          <span>{toCode}</span>
        </div>
        <div className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
          {from} → {to}
        </div>
        {primary && (
          <button
            className="btn mt-4 w-full"
            onClick={() => onShop(primary.href, { kind: 'flight', name: `${from} → ${to}`, date, url: primary.href })}
          >
            {t('shop.openX', { name: primary.name })}
          </button>
        )}
        {rest.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {rest.map((l) => (
              <button
                key={l.name}
                className="btn btn-ghost px-3 py-1 text-xs"
                onClick={() => onShop(l.href, { kind: 'flight', name: `${from} → ${to} · ${l.name}`, date, url: l.href })}
              >
                {l.name}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="pass-stub">{stub}</div>
    </article>
  )
}

function LinkRow({
  links,
  onShop,
}: {
  links: ShopLink[]
  onShop: (href: string, name: string) => void
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {links.map((l) => (
        <button key={l.name + l.href} className="btn btn-soft px-3 py-1.5 text-xs" onClick={() => onShop(l.href, l.name)}>
          {l.name} ↗
        </button>
      ))}
    </div>
  )
}

function Capture({
  open,
  draft,
  currency,
  onClose,
  onSave,
}: {
  open: boolean
  draft: Draft | null
  currency: string
  onClose: () => void
  onSave: (b: {
    kind: SavedKind
    name: string
    status: BookingStatus
    date?: string
    url?: string
    confirmation?: string
    cost?: { amount: number; currency: string }
  }) => void
}) {
  const [name, setName] = useState(draft?.name || '')
  const [price, setPrice] = useState('')
  const [code, setCode] = useState('')
  const [status, setStatus] = useState<BookingStatus>('booked')
  const { t } = useT()

  if (!draft) return null
  return (
    <Modal open={open} title={t('shop.capture')} onClose={onClose}>
      <p className="mb-3 text-sm" style={{ color: 'var(--muted)' }}>
        {t('shop.captureHint')}
      </p>
      <div className="space-y-3">
        <input className="field" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>{t('shop.priceOpt')}</Label>
            <input className="field" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder={currency} />
          </div>
          <div>
            <Label>{t('shop.codeOpt')}</Label>
            <input className="field" value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {(['booked', 'need'] as BookingStatus[]).map((s) => (
            <button key={s} className={status === s ? 'btn' : 'btn btn-ghost'} onClick={() => setStatus(s)}>
              {s === 'booked' ? t('shop.booked') : t('shop.looking')}
            </button>
          ))}
        </div>
        <button
          className="btn w-full"
          disabled={!name}
          onClick={() =>
            onSave({
              kind: draft.kind,
              name,
              status,
              date: draft.date,
              url: draft.url,
              confirmation: code || undefined,
              cost: price ? { amount: Number(price), currency } : undefined,
            })
          }
        >
          {t('shop.save')}
        </button>
      </div>
    </Modal>
  )
}
