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

type Draft = { kind: SavedKind; name: string; date?: string; url?: string }

const SHOP_KEY = 'boomvoy-shop'

export default function BookingSearch({ trip }: { trip: Trip }) {
  const plan = tripFlightPlan(trip)
  const stays = tripHotelStays(trip)
  const openJaw = openJawLinks(trip)
  const addBooking = useApp((s) => s.addBooking)
  const [from, setFrom] = useState(plan.outbound.from)
  const [to, setTo] = useState(plan.outbound.to)
  const [go, setGo] = useState(plan.outbound.date)
  const [back, setBack] = useState(plan.sameCity ? plan.inbound.date : '')
  const [draft, setDraft] = useState<Draft | null>(null)

  const custom = flightLinks(from, to, go, trip, back || undefined)

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
            <h2 className="display text-3xl">登机牌</h2>
            <p className="hand mt-1 text-xl" style={{ color: 'var(--muted)' }}>
              点开主按钮就能比价。订完切回来，Boom 帮你记一笔。
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
            订完了？记一笔
          </button>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Pass
            from={plan.outbound.from}
            to={plan.outbound.to}
            date={plan.outbound.date}
            stub="OUTBOUND"
            people={trip.travellers}
            links={flightLinks(plan.outbound.from, plan.outbound.to, plan.outbound.date, trip)}
            onShop={shop}
          />
          <Pass
            from={plan.inbound.from}
            to={plan.inbound.to}
            date={plan.inbound.date}
            stub="RETURN"
            people={trip.travellers}
            links={flightLinks(plan.inbound.from, plan.inbound.to, plan.inbound.date, trip)}
            onShop={shop}
          />
        </div>

        {openJaw && (
          <div className="paper mt-4 p-4">
            <div className="text-sm font-medium">开口票 · 去东京、从大阪回</div>
            <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
              进出机场不一样时，一次搜两段通常更便宜。
            </p>
            <LinkRow
              links={openJaw}
              onShop={(href, name) => shop(href, { kind: 'flight', name: `开口票 · ${name}`, date: plan.outbound.date, url: href })}
            />
          </div>
        )}

        <div className="paper mt-4 p-4">
          <div className="text-sm font-medium">自己改航线</div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <input className="field" value={from} onChange={(e) => setFrom(e.target.value)} placeholder="出发，如 Melbourne" />
            <input className="field" value={to} onChange={(e) => setTo(e.target.value)} placeholder="到达，如 Tokyo" />
            <input className="field" type="date" value={go} onChange={(e) => setGo(e.target.value)} />
            <input className="field" type="date" value={back} onChange={(e) => setBack(e.target.value)} />
          </div>
          <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
            回程留空 = 单程。人数按这次 {trip.travellers} 人。
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
          <h2 className="display mb-3 text-3xl">房卡</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {stays.map((s) => {
              const links = hotelLinks(s.city, s.checkin, s.checkout, trip)
              const primary = links[0]
              return (
                <div key={s.city + s.checkin} className="keycard p-4">
                  <div className="text-[11px] tracking-[0.2em] text-white/70">GUEST KEY</div>
                  <div className="display mt-1 text-3xl text-white">{s.city}</div>
                  <div className="mt-8 text-sm" style={{ color: 'var(--muted)' }}>
                    {formatDay(s.checkin)} – {formatDay(s.checkout)}
                    {s.stay ? ` · ${s.stay}` : ''}
                  </div>
                  {primary && (
                    <button
                      className="btn mt-3"
                      onClick={() =>
                        shop(primary.href, {
                          kind: 'hotel',
                          name: `${s.city} 住宿`,
                          date: s.checkin,
                          url: primary.href,
                        })
                      }
                    >
                      打开 {primary.name}
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
        <h2 className="display text-2xl">门票 / 体验</h2>
        <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
          Klook、GetYourGuide。订完切回来登记。
        </p>
        <div className="mt-3 flex flex-wrap gap-4">
          {[...new Set(trip.destinations)].map((city) => (
            <div key={city}>
              <div className="text-sm font-medium">{city}</div>
              <LinkRow
                links={activityLinks(city)}
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
  return (
    <article className="pass">
      <div className="pass-body">
        <div className="text-[11px] tracking-[0.18em]" style={{ color: 'var(--muted)' }}>
          {formatDay(date)} · {people} PAX
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
            打开 {primary.name}
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

  if (!draft) return null
  return (
    <Modal open={open} title="订好了吗？" onClose={onClose}>
      <p className="mb-3 text-sm" style={{ color: 'var(--muted)' }}>
        不用填完整。订了就标已预订，没订就关掉。
      </p>
      <div className="space-y-3">
        <input className="field" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>价格（选填）</Label>
            <input className="field" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder={currency} />
          </div>
          <div>
            <Label>确认号（选填）</Label>
            <input className="field" value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {(['booked', 'need'] as BookingStatus[]).map((s) => (
            <button key={s} className={status === s ? 'btn' : 'btn btn-ghost'} onClick={() => setStatus(s)}>
              {s === 'booked' ? '已订' : '还在看'}
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
          记进预订中心
        </button>
      </div>
    </Modal>
  )
}
