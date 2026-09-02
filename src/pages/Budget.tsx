import { useParams } from 'react-router-dom'
import { useApp, useTrip } from '../store'
import { money } from '../lib'
import { budgetTotals } from '../domain'
import { Progress } from '../ui'

export default function Budget() {
  const { id } = useParams()
  const trip = useTrip(id)
  const updateTrip = useApp((s) => s.updateTrip)
  if (!trip) return null
  const tot = budgetTotals(trip)
  const cap = trip.totalBudget || tot.estimated

  return (
    <div className="space-y-5">
      <div>
        <h1 className="display text-4xl">预算</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
          每类都可以分：预估 / 已订 / 已付。本币 {trip.homeCurrency}。
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="预估" value={money(tot.estimated, trip.homeCurrency)} />
        <Stat label="已订" value={money(tot.booked, trip.homeCurrency)} />
        <Stat label="已付" value={money(tot.paid, trip.homeCurrency)} />
      </div>
      <div className="paper p-5">
        <div className="mb-2 flex justify-between text-sm">
          <span>相对总预算 {money(cap, trip.homeCurrency)}</span>
          <span>{Math.round((tot.estimated / cap) * 100) || 0}%</span>
        </div>
        <Progress value={(tot.estimated / cap) * 100} />
      </div>
      <div className="space-y-2">
        {trip.budget.map((c) => (
          <div key={c.id} className="paper p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="font-medium">{c.name}</div>
              <div className="text-sm" style={{ color: 'var(--muted)' }}>
                {money(c.paid, trip.homeCurrency)} paid
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-sm">
              {(['estimated', 'booked', 'paid'] as const).map((k) => (
                <label key={k}>
                  <span className="mb-1 block text-[11px] uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                    {k === 'estimated' ? '预估' : k === 'booked' ? '已订' : '已付'}
                  </span>
                  <input
                    className="field"
                    type="number"
                    value={c[k]}
                    onChange={(e) =>
                      updateTrip(trip.id, {
                        budget: trip.budget.map((x) => (x.id === c.id ? { ...x, [k]: Number(e.target.value) } : x)),
                      })
                    }
                  />
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="paper p-4">
      <div className="text-sm" style={{ color: 'var(--muted)' }}>
        {label}
      </div>
      <div className="display mt-1 text-3xl">{value}</div>
    </div>
  )
}
