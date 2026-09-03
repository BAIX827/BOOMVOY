import type { PlaceSetting, PlaceStop, TransportMode, WeatherSnap } from './types'
import { enrichStops } from './geo'

export type DaySuggestion = {
  title: string
  vibe: string
  rainFriendly: boolean
  places: Omit<PlaceStop, 'id'>[]
}

function p(partial: Omit<PlaceStop, 'id'>): Omit<PlaceStop, 'id'> {
  return { transportToNext: 'public', priority: 'want', ...partial }
}

const PACKS: Record<string, DaySuggestion[]> = {
  tokyo: [
    {
      title: '东京晴天经典',
      vibe: '神社 → 原宿 → 涩谷日落',
      rainFriendly: false,
      places: [
        p({ name: '明治神宫', category: '景点', setting: 'outdoor', time: '10:00', durationMin: 90, socialBuzz: '小红书/Instagram 常晒的东京必去神社', coords: { lat: 35.6764, lng: 139.6993 } }),
        p({ name: '原宿 Takeshita', category: '购物', setting: 'mixed', time: '12:00', durationMin: 80, socialBuzz: '竹下通排队小吃出镜率很高', coords: { lat: 35.6702, lng: 139.7026 } }),
        p({ name: '涩谷十字路口', category: '景点', setting: 'outdoor', time: '14:00', durationMin: 40, coords: { lat: 35.6595, lng: 139.7004 } }),
        p({ name: 'Shibuya Sky', category: '景点', setting: 'mixed', time: '16:00', durationMin: 80, ticketNeeded: true, ticketUrl: 'https://www.klook.com/en-AU/search/?query=Shibuya%20Sky', socialBuzz: '观景台日落是社媒高频打卡', coords: { lat: 35.658, lng: 139.7026 } }),
        p({ name: '涩谷晚饭', category: '餐饮', setting: 'indoor', time: '19:00', durationMin: 90 }),
      ],
    },
    {
      title: '东京雨天室内',
      vibe: 'TeamLab + 百货 + 博物馆',
      rainFriendly: true,
      places: [
        p({ name: 'TeamLab Planets', category: '活动', setting: 'indoor', time: '10:00', durationMin: 150, ticketNeeded: true, ticketUrl: 'https://www.klook.com/en-AU/search/?query=TeamLab%20Planets', coords: { lat: 35.649, lng: 139.79 } }),
        p({ name: '涩谷 PARCO', category: '购物', setting: 'indoor', time: '14:00', durationMin: 90, coords: { lat: 35.6618, lng: 139.6983 } }),
        p({ name: '东京国立博物馆', category: '景点', setting: 'indoor', time: '16:30', durationMin: 100, coords: { lat: 35.7188, lng: 139.7765 } }),
      ],
    },
    {
      title: '下町吃走',
      vibe: '浅草 + 上野，节奏慢一点',
      rainFriendly: false,
      places: [
        p({ name: '浅草寺', category: '景点', setting: 'outdoor', time: '09:30', durationMin: 80, priority: 'must', coords: { lat: 35.7148, lng: 139.7967 } }),
        p({ name: '仲见世通', category: '购物', setting: 'outdoor', time: '11:00', durationMin: 50, coords: { lat: 35.7117, lng: 139.7963 } }),
        p({ name: '上野公园', category: '景点', setting: 'outdoor', time: '14:00', durationMin: 60, coords: { lat: 35.7148, lng: 139.7714 } }),
        p({ name: 'Ameyoko 吃喝', category: '餐饮', setting: 'mixed', time: '16:00', coords: { lat: 35.7107, lng: 139.7745 } }),
      ],
    },
  ],
  kyoto: [
    {
      title: '东山一日',
      vibe: '伏见稻荷 → 清水寺 → 祇园',
      rainFriendly: false,
      places: [
        p({ name: '伏见稻荷大社', category: '景点', setting: 'outdoor', time: '09:00', durationMin: 120, priority: 'must', socialBuzz: '千本鸟居几乎每条京都攻略都会提', coords: { lat: 34.9671, lng: 135.7727 } }),
        p({ name: '清水寺', category: '景点', setting: 'outdoor', time: '12:30', durationMin: 90, ticketNeeded: true, ticketUrl: 'https://www.klook.com/en-AU/search/?query=Kiyomizu-dera', coords: { lat: 34.9949, lng: 135.785 } }),
        p({ name: '二年坂 / 三年坂', category: '景点', setting: 'outdoor', time: '14:30', durationMin: 60, coords: { lat: 34.9965, lng: 135.7825 } }),
        p({ name: '祇园', category: '景点', setting: 'outdoor', time: '16:30', durationMin: 70, coords: { lat: 35.0036, lng: 135.7784 } }),
      ],
    },
    {
      title: '京都躲雨',
      vibe: '铁道博物馆 + 锦市场 + 室内展',
      rainFriendly: true,
      places: [
        p({ name: '京都铁道博物馆', category: '景点', setting: 'indoor', time: '09:30', durationMin: 120, ticketNeeded: true, ticketUrl: 'https://www.klook.com/en-AU/search/?query=Kyoto%20Railway%20Museum', coords: { lat: 34.9873, lng: 135.7441 } }),
        p({ name: '锦市场', category: '餐饮', setting: 'mixed', time: '12:30', durationMin: 70, coords: { lat: 35.005, lng: 135.7647 } }),
        p({ name: '京都国立博物馆', category: '景点', setting: 'indoor', time: '14:30', durationMin: 100, coords: { lat: 34.9901, lng: 135.773 } }),
      ],
    },
    {
      title: '岚山半日',
      vibe: '竹林、寺庙、豆腐料理',
      rainFriendly: false,
      places: [
        p({ name: '岚山竹林', category: '景点', setting: 'outdoor', time: '09:00', durationMin: 50, priority: 'must', coords: { lat: 35.017, lng: 135.672 } }),
        p({ name: '天龙寺', category: '景点', setting: 'outdoor', time: '10:00', durationMin: 70, coords: { lat: 35.0159, lng: 135.6736 } }),
        p({ name: '渡月桥', category: '景点', setting: 'outdoor', time: '12:00', coords: { lat: 35.0126, lng: 135.6778 } }),
        p({ name: '金阁寺', category: '景点', setting: 'outdoor', time: '15:00', durationMin: 60, ticketNeeded: true, ticketUrl: 'https://www.klook.com/en-AU/search/?query=Kinkakuji', coords: { lat: 35.0394, lng: 135.7292 } }),
      ],
    },
  ],
  osaka: [
    {
      title: '大阪城 + 道顿堀',
      vibe: '经典城景和夜市',
      rainFriendly: false,
      places: [
        p({ name: '大阪城', category: '景点', setting: 'mixed', time: '11:00', durationMin: 90, ticketNeeded: true, ticketUrl: 'https://www.klook.com/en-AU/search/?query=Osaka%20Castle', coords: { lat: 34.6873, lng: 135.5262 } }),
        p({ name: '心斋桥 / 道顿堀', category: '购物', setting: 'outdoor', time: '15:00', durationMin: 150, socialBuzz: '道顿堀夜景和固力果招牌是 Ins 常客', coords: { lat: 34.6687, lng: 135.5013 } }),
        p({ name: '章鱼烧晚饭', category: '餐饮', setting: 'outdoor', time: '18:30' }),
      ],
    },
    {
      title: '大阪室内',
      vibe: '海游馆 + 梅田',
      rainFriendly: true,
      places: [
        p({ name: '海游馆', category: '景点', setting: 'indoor', time: '10:30', ticketNeeded: true, ticketUrl: 'https://www.klook.com/en-AU/search/?query=Osaka%20Aquarium', coords: { lat: 34.6545, lng: 135.4289 } }),
        p({ name: '梅田空中庭园', category: '景点', setting: 'indoor', time: '15:00', coords: { lat: 34.7053, lng: 135.4904 } }),
      ],
    },
  ],
  fuji: [
    {
      title: '河口湖晴天',
      vibe: '湖景 + 缆车，适合自驾',
      rainFriendly: false,
      places: [
        p({ name: '忍野八海', category: '景点', setting: 'outdoor', time: '11:00', durationMin: 70, coords: { lat: 35.4606, lng: 138.8278 } }),
        p({ name: '河口湖观景', category: '景点', setting: 'outdoor', time: '14:00', durationMin: 90, priority: 'must', coords: { lat: 35.517, lng: 138.755 } }),
        p({ name: '富士山全景缆车', category: '活动', setting: 'mixed', time: '16:00', durationMin: 60, ticketNeeded: true, ticketUrl: 'https://www.klook.com/en-AU/search/?query=Mt%20Fuji%20Panoramic%20Ropeway', coords: { lat: 35.5015, lng: 138.766 } }),
      ],
    },
    {
      title: '富士室内备选',
      vibe: '世界遗产中心躲雨',
      rainFriendly: true,
      places: [
        p({ name: '富士山世界遗产中心', category: '景点', setting: 'indoor', time: '13:00', coords: { lat: 35.459, lng: 138.801 } }),
      ],
    },
  ],
  bali: [
    {
      title: 'Canggu 慢一天',
      vibe: '海滩、咖啡、日落',
      rainFriendly: false,
      places: [
        p({ name: 'Echo Beach 日落', category: '景点', setting: 'outdoor', time: '17:30', coords: { lat: -8.655, lng: 115.135 } }),
      ],
    },
    {
      title: '雷阵雨备选',
      vibe: '咖啡馆躲雨',
      rainFriendly: true,
      places: [
        p({ name: '咖啡馆躲雷阵雨', category: '餐饮', setting: 'indoor', time: '16:00' }),
      ],
    },
  ],
}

function keyOf(city: string) {
  const c = city.toLowerCase()
  if (c.includes('tokyo') || c.includes('东京')) return 'tokyo'
  if (c.includes('kyoto') || c.includes('京都')) return 'kyoto'
  if (c.includes('osaka') || c.includes('大阪')) return 'osaka'
  if (c.includes('fuji') || c.includes('河口')) return 'fuji'
  if (c.includes('bali') || c.includes('canggu') || c.includes('ubud')) return 'bali'
  return ''
}

function localSuggestions(city: string, weather?: WeatherSnap, existing: string[] = []): DaySuggestion[] {
  const pack = PACKS[keyOf(city)]
  const base =
    pack ||
    ([
      {
        title: `${city} 轻松一天`,
        vibe: '先定一个地标，再留空白吃饭',
        rainFriendly: false,
        places: [
          p({ name: `${city} 早餐`, category: '餐饮', setting: 'indoor', time: '09:00' }),
          p({ name: `${city} 主景点`, category: '景点', setting: 'outdoor', time: '10:30', priority: 'must' }),
          p({ name: `${city} 午饭`, category: '餐饮', setting: 'indoor', time: '13:00' }),
          p({ name: `${city} 散步 / 商店`, category: '购物', setting: 'mixed', time: '15:30' }),
        ],
      },
      {
        title: `${city} 室内备选`,
        vibe: '下雨时用',
        rainFriendly: true,
        places: [
          p({ name: `${city} 博物馆或商场`, category: '景点', setting: 'indoor', time: '10:00' }),
          p({ name: `${city} 咖啡馆`, category: '餐饮', setting: 'indoor', time: '13:00' }),
        ],
      },
    ] satisfies DaySuggestion[])

  const rain = (weather?.rainProb ?? 0) >= 50
  const named = existing.map((n) => n.toLowerCase())
  return [...base]
    .sort((a, b) => Number(b.rainFriendly === rain) - Number(a.rainFriendly === rain))
    .map((s) => ({
      ...s,
      places: s.places.filter((p) => !named.includes(p.name.toLowerCase())),
    }))
    .filter((s) => s.places.length > 0)
}

export async function suggestDays(input: {
  city: string
  date?: string
  weather?: WeatherSnap
  existing?: string[]
  planned?: { name: string; date: string }[]
  llmUrl?: string
  llmKey?: string
  llmModel?: string
}): Promise<{ items: DaySuggestion[]; source: 'local' | 'api'; error?: 'offline' | 'failed' | 'empty' }> {
  const already = input.planned?.map((p) => p.name) || input.existing || []
  const packed = localSuggestions(input.city, input.weather, already)
  const localItems: DaySuggestion[] = []
  for (const s of packed) {
    localItems.push({ ...s, places: await enrichStops(input.city, s.places) })
  }
  if (!input.llmUrl || !input.llmKey) return { items: localItems, source: 'local' }
  try {
    const api = await fromLlm({
      city: input.city,
      date: input.date,
      weather: input.weather,
      existing: already,
      planned: input.planned,
      llmUrl: input.llmUrl,
      llmKey: input.llmKey,
      llmModel: input.llmModel,
    })
    if (api.length) {
      const items: DaySuggestion[] = []
      for (const s of api) {
        items.push({ ...s, places: await enrichStops(input.city, s.places) })
      }
      return { items, source: 'api' }
    }
  } catch (err) {
    return { items: localItems, source: 'local', error: err instanceof Error && err.message === 'Failed to fetch' ? 'offline' : 'failed' }
  }
  return { items: localItems, source: 'local', error: 'empty' }
}

async function fromLlm(input: {
  city: string
  date?: string
  weather?: WeatherSnap
  existing?: string[]
  planned?: { name: string; date: string }[]
  llmUrl: string
  llmKey: string
  llmModel?: string
}): Promise<DaySuggestion[]> {
  const openai = /openai\.com/.test(input.llmUrl) || input.llmUrl.startsWith('/openai')
  const body: Record<string, unknown> = {
    model: input.llmModel || 'gpt-4o-mini',
    temperature: 0.4,
    messages: [
      {
        role: 'system',
        content:
          'You suggest walkable day itineraries. Prefer restaurants, cafes, and sights that are frequently recommended on Xiaohongshu (小红书), Instagram, and Google Maps reviews — well-known local favorites, not obscure inventions. Put a short socialBuzz like "小红书常排队" or "Instagram sunset spot" when that is why you picked it. Skip anything in alreadyHave (already on this trip). Reply JSON only: {"suggestions":[{"title":"","vibe":"","rainFriendly":false,"places":[{"name":"","category":"景点|餐饮|活动|购物","setting":"outdoor|indoor|mixed","time":"10:00","durationMin":60,"notes":"","socialBuzz":"","ticketNeeded":false,"ticketUrl":"","transportToNext":"walking|public|taxi"}]}]} 2 or 3 suggestions. Chinese titles ok. ticketNeeded true only if advance tickets are usually required; then ticketUrl should be a Klook/GetYourGuide search or official ticket page. If tickets are not needed, omit ticketUrl. Do not invent coordinates. No markdown.',
      },
      {
        role: 'user',
        content: JSON.stringify({
          city: input.city,
          date: input.date,
          weather: input.weather,
          alreadyHave: input.planned || input.existing,
        }),
      },
    ],
  }
  if (openai) body.response_format = { type: 'json_object' }
  const res = await fetch(input.llmUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${input.llmKey}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`API ${res.status}${detail.slice(0, 160) ? `: ${detail.slice(0, 160)}` : ''}`)
  }
  const data = await res.json()
  const text = data.choices?.[0]?.message?.content || data.output_text || ''
  const json = JSON.parse(text.replace(/```json|```/g, '').trim())
  const list = json.suggestions || json
  if (!Array.isArray(list)) return []
  return list.map((s: DaySuggestion) => ({
    title: s.title,
    vibe: s.vibe,
    rainFriendly: !!s.rainFriendly,
    places: (s.places || []).map((pl) =>
      p({
        name: pl.name,
        category: pl.category || '景点',
        setting: (pl.setting as PlaceSetting) || 'outdoor',
        time: pl.time,
        durationMin: pl.durationMin,
        notes: pl.notes,
        socialBuzz: pl.socialBuzz,
        ticketNeeded: !!pl.ticketNeeded,
        ticketUrl: pl.ticketNeeded ? pl.ticketUrl : undefined,
        transportToNext: (['walking', 'public', 'taxi', 'self-drive'].includes(String(pl.transportToNext))
          ? pl.transportToNext
          : 'public') as TransportMode,
      }),
    ),
  }))
}
