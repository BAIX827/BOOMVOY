import { useNavigate } from 'react-router-dom'
import { useApp } from '../store'
import { CoverArt } from '../ui'
import { formatRange } from '../lib'
import { THEMES } from '../catalog'

export default function Explore() {
  const templates = useApp((s) => s.trips).filter((t) => t.template)
  const cloneTrip = useApp((s) => s.cloneTrip)
  const nav = useNavigate()

  return (
    <div>
      <p className="text-sm" style={{ color: 'var(--muted)' }}>
        不是信息流。把别人规划好的一天、一条路线，复制进自己的旅行。
      </p>
      <h1 className="display mt-1 mb-8 text-4xl">发现行程</h1>
      <div className="grid gap-5 lg:grid-cols-2">
        {templates.map((t) => (
          <article key={t.id} className="paper overflow-hidden">
            <CoverArt kind={t.cover} title={t.name} />
            <div className="p-5">
              <div className="text-sm" style={{ color: 'var(--muted)' }}>
                {formatRange(t.startDate, t.endDate)} · {t.origin} → {t.destinations.join(' → ')}
              </div>
              <p className="mt-3 text-sm leading-6">{t.notes}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="chip">{THEMES[t.theme].label} {THEMES[t.theme].name}</span>
                <span className="chip">{t.days.length} 天</span>
                <span className="chip">可整本复制</span>
              </div>
              <div className="mt-5 flex gap-2">
                <button
                  className="btn"
                  onClick={() => {
                    const id = cloneTrip(t.id)
                    nav(`/trip/${id}`)
                  }}
                >
                  复制整趟旅行
                </button>
                <button className="btn btn-ghost" onClick={() => nav(`/share/${t.id}`)}>
                  先看看
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
