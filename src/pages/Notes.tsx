import { useNavigate, useParams } from 'react-router-dom'
import { useApp, useTrip } from '../store'
import { THEMES, TRANSPORT } from '../catalog'
import type { ThemeId, TransportMode } from '../types'
import { Label } from '../ui'

const modes: TransportMode[] = ['self-drive', 'public', 'walking', 'taxi', 'cycling', 'mixed', 'flight']

export default function Notes() {
  const { id } = useParams()
  const trip = useTrip(id)
  const updateTrip = useApp((s) => s.updateTrip)
  const deleteTrip = useApp((s) => s.deleteTrip)
  const nav = useNavigate()
  if (!trip) return null
  const current = trip

  function toggleMode(m: TransportMode) {
    const next = current.transportModes.includes(m)
      ? current.transportModes.filter((x) => x !== m)
      : [...current.transportModes, m]
    updateTrip(current.id, { transportModes: next.length ? next : ['mixed'] })
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="display text-4xl">笔记与设置</h1>
      <div className="paper space-y-4 p-5">
        <div>
          <Label>旅行名称</Label>
          <input className="field" value={trip.name} onChange={(e) => updateTrip(trip.id, { name: e.target.value })} />
        </div>
        <div>
          <Label>笔记</Label>
          <textarea
            className="field min-h-[140px]"
            value={trip.notes}
            onChange={(e) => updateTrip(trip.id, { notes: e.target.value })}
          />
        </div>
        <div>
          <Label>分享范围</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {(['private', 'friends', 'public'] as const).map((v) => (
              <button
                key={v}
                className={trip.share.visibility === v ? 'btn' : 'btn btn-ghost'}
                onClick={() => updateTrip(trip.id, { share: { visibility: v } })}
              >
                {v === 'private' ? '仅自己' : v === 'friends' ? '朋友' : '公开'}
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label>Theme</Label>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {(Object.keys(THEMES) as ThemeId[]).map((th) => (
              <button
                key={th}
                className="paper p-3 text-left"
                style={{ outline: trip.theme === th ? '2px solid var(--ink)' : undefined }}
                onClick={() => updateTrip(trip.id, { theme: th, cover: trip.cover === 'cream' || trip.cover === 'ocean' || trip.cover === 'forest' ? th : trip.cover })}
              >
                <div className="mb-2 flex gap-1">
                  {THEMES[th].swatches.map((c) => (
                    <span key={c} className="h-5 flex-1 rounded-full" style={{ background: c }} />
                  ))}
                </div>
                {THEMES[th].label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label>旅行方式</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {modes.map((m) => (
              <button key={m} className={trip.transportModes.includes(m) ? 'btn' : 'btn btn-ghost'} onClick={() => toggleMode(m)}>
                {TRANSPORT[m].icon} {TRANSPORT[m].label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <button
        className="btn btn-ghost"
        onClick={() => {
          if (confirm('删除这趟旅行？')) {
            deleteTrip(current.id)
            nav('/')
          }
        }}
      >
        删除旅行
      </button>
    </div>
  )
}
