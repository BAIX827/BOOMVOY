import { useApp } from '../store'
import { THEMES } from '../catalog'
import { Label } from '../ui'
import type { ThemeId } from '../types'
import { resolveLlm } from '../llm'

export default function Profile() {
  const profile = useApp((s) => s.profile)
  const setProfile = useApp((s) => s.setProfile)
  const resetDemo = useApp((s) => s.resetDemo)
  const llm = resolveLlm(profile)

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="display mb-6 text-4xl">我</h1>
      <div className="paper space-y-4 p-6">
        <div>
          <Label>名字</Label>
          <input className="field" value={profile.name} onChange={(e) => setProfile({ name: e.target.value })} />
        </div>
        <div>
          <Label>出发城市</Label>
          <input className="field" value={profile.homeCity} onChange={(e) => setProfile({ homeCity: e.target.value })} />
        </div>
        <div>
          <Label>本币</Label>
          <select className="field" value={profile.homeCurrency} onChange={(e) => setProfile({ homeCurrency: e.target.value })}>
            {['AUD', 'CNY', 'USD', 'JPY', 'EUR'].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <Label>默认 Theme</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {(['auto', ...(Object.keys(THEMES) as ThemeId[])] as const).map((id) => (
              <button
                key={id}
                className={profile.themePref === id ? 'btn' : 'btn btn-ghost'}
                onClick={() => setProfile({ themePref: id })}
              >
                {id === 'auto' ? '跟随旅行' : THEMES[id].label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="paper mt-6 space-y-4 p-6">
        <h2 className="display text-2xl">建议行程 API</h2>
        <p className="text-sm leading-6" style={{ color: 'var(--muted)' }}>
          {llm.fromEnv
            ? '本地环境已经接好 OpenAI，行程页会直接生成建议。Key 只存在这台电脑的 .env.local，不会进 Git。'
            : '不填就用 Boom 自带的东京 / 京都 / 大阪等地建议。填了之后按 OpenAI Chat Completions 格式请求。DeepSeek、Groq 等同格式接口也能用。'}
        </p>
        <div>
          <Label>接口地址</Label>
          <input
            className="field"
            placeholder={llm.llmUrl}
            value={profile.llmUrl || ''}
            onChange={(e) => setProfile({ llmUrl: e.target.value })}
          />
        </div>
        <div>
          <Label>API Key</Label>
          <input
            className="field"
            type="password"
            autoComplete="off"
            placeholder={llm.fromEnv ? '已从本地环境读取' : 'sk-…'}
            value={profile.llmKey || ''}
            onChange={(e) => setProfile({ llmKey: e.target.value })}
          />
        </div>
        <div>
          <Label>模型名</Label>
          <input
            className="field"
            placeholder={llm.llmModel}
            value={profile.llmModel || ''}
            onChange={(e) => setProfile({ llmModel: e.target.value })}
          />
        </div>
      </div>
      <p className="mt-6 text-sm leading-6" style={{ color: 'var(--muted)' }}>
        第一版账号存在这台浏览器里。以后做 App 时，同一套旅行数据可以同步上去。
      </p>
      <button className="btn btn-ghost mt-4" onClick={resetDemo}>
        恢复示例数据（Japan 2026）
      </button>
      <button className="btn mt-3" onClick={() => window.dispatchEvent(new Event('boomvoy-start-guide'))}>
        再看一遍新手引导
      </button>
    </div>
  )
}
