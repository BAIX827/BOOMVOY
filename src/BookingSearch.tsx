import { useState } from 'react'
import type { Trip } from './types'
import {
  activityLinks,
  flightLinks,
  hotelLinks,
  openJawLinks,
  tripFlightPlan,
  tripHotelStays,
  type ShopLink,
} from './bookingLinks'
import { formatDay } from './lib'

export default function BookingSearch({ trip }: { trip: Trip }) {
  const plan = tripFlightPlan(trip)
  const stays = tripHotelStays(trip)
  const openJaw = openJawLinks(trip)
  const [from, setFrom] = useState(plan.outbound.from)
  const [to, setTo] = useState(plan.outbound.to)
  const [go, setGo] = useState(plan.outbound.date)
  const [back, setBack] = useState(plan.sameCity ? plan.inbound.date : '')

  const custom = flightLinks(from, to, go, trip, back || undefined)

  return (
    <div className="space-y-4" data-guide="booking-links">
      <section className="paper p-5">
        <h2 className="display text-2xl">一键去比价</h2>
        <p className="mt-1 text-sm leading-6" style={{ color: 'var(--muted)' }}>
          Skyscanner / Google Flights 不能嵌进我们网页里（他们会拦截），但可以带上出发地、目的地和日期直接打开。订完回到这里标成「已预订」。
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Leg title={`去程 · ${plan.label}`} links={flightLinks(plan.outbound.from, plan.outbound.to, plan.outbound.date, trip)} />
          <Leg title={`回程 · ${plan.backLabel}`} links={flightLinks(plan.inbound.from, plan.inbound.to, plan.inbound.date, trip)} />
        </div>

        {openJaw && (
          <div className="mt-4 rounded-2xl p-3" style={{ background: 'var(--bg-2)' }}>
            <div className="text-sm font-medium">开口票（去东京、从大阪回）</div>
            <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
              进出机场不一样时，用这个一次搜两段，通常比两张单程便宜。
            </p>
            <LinkRow links={openJaw} />
          </div>
        )}

        <div className="mt-5">
          <div className="text-sm font-medium">自己改航线再搜</div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <input className="field" value={from} onChange={(e) => setFrom(e.target.value)} placeholder="出发，如 Melbourne" />
            <input className="field" value={to} onChange={(e) => setTo(e.target.value)} placeholder="到达，如 Tokyo" />
            <input className="field" type="date" value={go} onChange={(e) => setGo(e.target.value)} />
            <input className="field" type="date" value={back} onChange={(e) => setBack(e.target.value)} />
          </div>
          <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
            回程日期留空 = 单程。人数按这次旅行的 {trip.travellers} 人。
          </p>
          <LinkRow links={custom} />
        </div>
      </section>

      {stays.length > 0 && (
        <section className="paper p-5">
          <h2 className="display text-2xl">按城市订酒店</h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
            日期跟着行程走。打开 Booking / Agoda 比完价，回来把对应项标成已订。
          </p>
          <div className="mt-3 space-y-3">
            {stays.map((s) => (
              <div key={s.city + s.checkin} className="rounded-2xl p-3" style={{ background: 'var(--bg-2)' }}>
                <div className="font-medium">
                  {s.city}
                  <span className="ml-2 text-sm font-normal" style={{ color: 'var(--muted)' }}>
                    {formatDay(s.checkin)} – {formatDay(s.checkout)}
                    {s.stay ? ` · ${s.stay}` : ''}
                  </span>
                </div>
                <LinkRow links={hotelLinks(s.city, s.checkin, s.checkout, trip)} />
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="paper p-5">
        <h2 className="display text-2xl">门票 / 体验</h2>
        <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
          景点票走 Klook、GetYourGuide。第一版同样是跳转，订完回来打勾。
        </p>
        <div className="mt-3 flex flex-wrap gap-4">
          {[...new Set(trip.destinations)].map((city) => (
            <div key={city}>
              <div className="text-sm font-medium">{city}</div>
              <LinkRow links={activityLinks(city)} />
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function Leg({ title, links }: { title: string; links: ShopLink[] }) {
  return (
    <div className="rounded-2xl p-3" style={{ background: 'var(--bg-2)' }}>
      <div className="text-sm font-medium">{title}</div>
      <LinkRow links={links} />
    </div>
  )
}

function LinkRow({ links }: { links: ShopLink[] }) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {links.map((l) => (
        <a key={l.name + l.href} className="btn btn-soft px-3 py-1.5 text-xs no-underline" href={l.href} target="_blank" rel="noreferrer">
          {l.name} ↗
        </a>
      ))}
    </div>
  )
}
