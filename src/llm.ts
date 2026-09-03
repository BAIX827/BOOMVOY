export const DEFAULT_LLM_URL = 'https://api.openai.com/v1/chat/completions'
export const DEFAULT_LLM_MODEL = 'gpt-4o-mini'

export function resolveLlm(profile: { llmUrl?: string; llmKey?: string; llmModel?: string }) {
  const envKey = import.meta.env.DEV ? import.meta.env.VITE_OPENAI_API_KEY || '' : ''
  const llmKey = profile.llmKey || envKey
  return {
    llmUrl: profile.llmUrl || import.meta.env.VITE_OPENAI_API_URL || DEFAULT_LLM_URL,
    llmKey,
    llmModel: profile.llmModel || import.meta.env.VITE_OPENAI_MODEL || DEFAULT_LLM_MODEL,
    fromEnv: Boolean(envKey) && !profile.llmKey,
    ready: Boolean(llmKey),
  }
}

export async function askBoomi(
  llm: ReturnType<typeof resolveLlm>,
  question: string,
  locale: 'zh' | 'en',
  page: string,
) {
  if (!llm.ready) throw new Error('no llm')
  const res = await fetch(llm.llmUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${llm.llmKey}`,
    },
    body: JSON.stringify({
      model: llm.llmModel,
      temperature: 0.3,
      max_tokens: 220,
      messages: [
        {
          role: 'system',
          content:
            locale === 'zh'
              ? '你是 BOOMVOY 的导游猫 Boomi。用 2～4 句中文教用户怎么操作这个旅行手账：行程页点「推荐行程」才会生成当天建议；到站后点「打卡」写感受和照片；路线图看绕不绕；预订中心搜机票酒店。不要编造功能，不要客套。'
              : 'You are Boomi, BOOMVOY’s tour-guide cat. In 2–4 short sentences, teach this travel journal: on Plan, tap “Recommend a day” to generate; at a stop, tap Check in for a note and photos; the map shows detours; Bookings searches flights and hotels. Do not invent features. No filler.',
        },
        { role: 'user', content: `page: ${page}\n${question}` },
      ],
    }),
  })
  if (!res.ok) throw new Error(`API ${res.status}`)
  const data = await res.json()
  const text = String(data.choices?.[0]?.message?.content || '').trim()
  if (!text) throw new Error('empty')
  return text
}
