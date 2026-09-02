import { useParams } from 'react-router-dom'
import { useApp, useTrip } from '../store'
import { STATUS } from '../catalog'
import { money } from '../lib'
import { Tone } from '../ui'

export default function Compare() {
  const { id } = useParams()
  const trip = useTrip(id)
  const toggleVote = useApp((s) => s.toggleVote)
  const updateSaved = useApp((s) => s.updateSaved)
  if (!trip) return null

  return (
    <div className="space-y-8">
      <div>
        <h1 className="display text-4xl">决策板</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
          收藏只是起点。这里帮你做决定——包括为什么排除某家酒店，避免以后又纠结一遍。
        </p>
      </div>
      {trip.compares.map((board) => {
        const items = board.itemIds.map((i) => trip.saved.find((s) => s.id === i)).filter(Boolean)
        return (
          <section key={board.id} className="paper overflow-x-auto p-5">
            <h2 className="display text-2xl">{board.title}</h2>
            <table className="mt-4 w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr style={{ color: 'var(--muted)' }}>
                  <th className="pb-3 font-medium">比较</th>
                  {items.map((it) => (
                    <th key={it!.id} className="pb-3 font-medium">
                      {it!.name}
                      <div className="mt-1">
                        <Tone tone={STATUS[it!.status].tone}>{STATUS[it!.status].label}</Tone>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <Row label="价格" items={items.map((it) => (it!.price ? money(it!.price.amount, it!.price.currency) : '—'))} />
                <Row label="评分" items={items.map((it) => (it!.rating ? String(it!.rating) : '—'))} />
                <Row label="👍" items={items.map((it) => it!.pros?.join('、') || '—')} />
                <Row label="👎" items={items.map((it) => it!.cons?.join('、') || '—')} />
                {board.kind === 'hotel' && (
                  <>
                    <Row label="早餐" items={items.map((it) => it!.meta?.breakfast || '—')} />
                    <Row label="停车" items={items.map((it) => it!.meta?.parking || '—')} />
                    <Row label="取消" items={items.map((it) => it!.meta?.cancel || '—')} />
                    <Row label="房间" items={items.map((it) => it!.meta?.size || '—')} />
                  </>
                )}
                {board.kind === 'flight' && (
                  <>
                    <Row label="航空公司" items={items.map((it) => it!.meta?.airline || '—')} />
                    <Row label="行李" items={items.map((it) => it!.meta?.bags || '—')} />
                    <Row label="退改" items={items.map((it) => it!.meta?.refund || '—')} />
                  </>
                )}
                <Row label="备注" items={items.map((it) => it!.notes || it!.rejectReason || '—')} />
                <tr>
                  <td className="py-3">投票</td>
                  {items.map((it) => {
                    const votes = Object.values(it!.votes).filter(Boolean).length
                    return (
                      <td key={it!.id} className="py-3">
                        <div className="flex flex-wrap gap-1">
                          {trip.members.map((m) => (
                            <button
                              key={m.id}
                              className="rounded-full px-2 py-0.5 text-xs"
                              style={{
                                background: it!.votes[m.id] ? m.color : 'var(--bg-2)',
                                color: it!.votes[m.id] ? 'white' : 'var(--ink)',
                              }}
                              onClick={() => toggleVote(trip.id, it!.id, m.id)}
                            >
                              {m.name}
                            </button>
                          ))}
                        </div>
                        <div className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
                          {votes} votes
                        </div>
                      </td>
                    )
                  })}
                </tr>
                <tr>
                  <td className="py-3">决定</td>
                  {items.map((it) => (
                    <td key={it!.id} className="py-3">
                      <div className="flex flex-wrap gap-1">
                        <button className="btn px-2 py-1 text-xs" onClick={() => updateSaved(trip.id, it!.id, { status: 'chosen' })}>
                          选定
                        </button>
                        <button
                          className="btn btn-ghost px-2 py-1 text-xs"
                          onClick={() =>
                            updateSaved(trip.id, it!.id, {
                              status: 'rejected',
                              rejectReason: it!.rejectReason || '先排除，避免再纠结',
                            })
                          }
                        >
                          排除
                        </button>
                      </div>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </section>
        )
      })}
      {trip.compares.length === 0 && (
        <div className="paper p-8 text-sm" style={{ color: 'var(--muted)' }}>
          把至少两个收藏标成「比较中」，就会出现在这里。示例旅行已经有东京酒店和去程机票。
        </div>
      )}
    </div>
  )
}

function Row({ label, items }: { label: string; items: string[] }) {
  return (
    <tr className="border-t" style={{ borderColor: 'var(--line)' }}>
      <td className="py-3" style={{ color: 'var(--muted)' }}>
        {label}
      </td>
      {items.map((v, i) => (
        <td key={i} className="py-3">
          {v}
        </td>
      ))}
    </tr>
  )
}
