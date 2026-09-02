import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { THEMES, TRANSPORT } from '../catalog'
import { useApp } from '../store'
import type { ThemeId, TransportMode } from '../types'
import { Label } from '../ui'

const modes: TransportMode[] = ['self-drive', 'public', 'walking', 'taxi', 'cycling', 'mixed']

export default function CreateTrip() {
  const createTrip = useApp((s) => s.createTrip)
  const profile = useApp((s) => s.profile)
  const nav = useNavigate()
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [origin, setOrigin] = useState(profile.homeCity)
  const [dest, setDest] = useState('')
  const [startDate, setStartDate] = useState('2026-09-25')
  const [endDate, setEndDate] = useState('2026-10-04')
  const [people, setPeople] = useState(2)
  const [members, setMembers] = useState(profile.name + ', ')
  const [budget, setBudget] = useState(3000)
  const [theme, setTheme] = useState<ThemeId>('cream')
  const [transport, setTransport] = useState<TransportMode[]>(['mixed'])

  const destinations = dest
    .split(/[,，>/→]/)
    .map((s) => s.trim())
    .filter(Boolean)

  function toggleMode(m: TransportMode) {
    setTransport((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]))
  }

  function submit() {
    const id = createTrip({
      name: name || destinations[0] || '未命名旅行',
      origin,
      destinations: destinations.length ? destinations : [origin],
      startDate,
      endDate,
      travellers: people,
      members: members.split(/[,，]/).map((s) => s.trim()).filter(Boolean),
      budgetPerPerson: budget,
      homeCurrency: profile.homeCurrency,
      theme,
      transportModes: transport.length ? transport : ['mixed'],
    })
    nav(`/trip/${id}`)
  }

  return (
    <div className="mx-auto max-w-2xl">
      <p className="text-sm" style={{ color: 'var(--muted)' }}>
        第 {step + 1} / 4 步
      </p>
      <h1 className="display mt-1 mb-6 text-4xl">创建一次旅行</h1>
      <div className="paper p-6">
        {step === 0 && (
          <div className="space-y-4">
            <div>
              <Label>旅行名称</Label>
              <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Japan 2026" />
            </div>
            <div>
              <Label>出发城市</Label>
              <input className="field" value={origin} onChange={(e) => setOrigin(e.target.value)} />
            </div>
            <div>
              <Label>目的地（用逗号或 → 分隔）</Label>
              <input
                className="field"
                value={dest}
                onChange={(e) => setDest(e.target.value)}
                placeholder="Tokyo → Fuji → Kyoto → Osaka"
              />
            </div>
          </div>
        )}
        {step === 1 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>开始</Label>
              <input className="field" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <Label>结束</Label>
              <input className="field" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
        )}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <Label>人数</Label>
              <input className="field" type="number" min={1} value={people} onChange={(e) => setPeople(Number(e.target.value))} />
            </div>
            <div>
              <Label>成员名字</Label>
              <input className="field" value={members} onChange={(e) => setMembers(e.target.value)} placeholder="Ari, Bo" />
            </div>
            <div>
              <Label>每人预算（{profile.homeCurrency}）</Label>
              <input className="field" type="number" value={budget} onChange={(e) => setBudget(Number(e.target.value))} />
            </div>
          </div>
        )}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <Label>旅行方式（可多选，之后还能按天改）</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {modes.map((m) => (
                  <button
                    key={m}
                    className={transport.includes(m) ? 'btn' : 'btn btn-ghost'}
                    onClick={() => toggleMode(m)}
                  >
                    {TRANSPORT[m].icon} {TRANSPORT[m].label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>Theme</Label>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {(Object.keys(THEMES) as ThemeId[]).map((id) => (
                  <button
                    key={id}
                    onClick={() => setTheme(id)}
                    className="paper p-3 text-left"
                    style={{ outline: theme === id ? '2px solid var(--ink)' : undefined }}
                  >
                    <div className="mb-2 flex gap-1">
                      {THEMES[id].swatches.map((c) => (
                        <span key={c} className="h-6 flex-1 rounded-full" style={{ background: c }} />
                      ))}
                    </div>
                    <div className="font-medium">
                      {THEMES[id].label} · {THEMES[id].name}
                    </div>
                    <div className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
                      {THEMES[id].blurb}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        <div className="mt-6 flex justify-between">
          <button className="btn btn-ghost" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
            上一步
          </button>
          {step < 3 ? (
            <button className="btn" onClick={() => setStep((s) => s + 1)}>
              下一步
            </button>
          ) : (
            <button className="btn btn-accent" onClick={submit}>
              进入工作台
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
