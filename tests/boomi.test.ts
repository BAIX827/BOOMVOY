import assert from 'node:assert/strict'
import { matchBoomi } from '../src/boomiChat'
import { boomiSay } from '../src/boomiVoice.mjs'
import { guideChips, guideSteps, guideTripId } from '../src/boomiGuide'

const tripCases = [
  { key: 'checkin', page: 'plan', queries: ['怎么打卡', 'check in', 'Where is my journal?'] },
  { key: 'suggest', page: 'plan', queries: ['推荐行程', '帮我排一天', 'Recommend a day', 'suggest a day'] },
  { key: 'map', page: 'map', queries: ['地图怎么用', '这条路线绕路吗', 'How do I use the map?', 'routes'] },
  { key: 'pack', page: 'pack', queries: ['打包行李', '带什么', 'packing', 'What to bring?', 'flight packing list'] },
  { key: 'weather', page: 'weather', queries: ['天气和雨天备选', '下雨怎么办', 'Weather / Plan B', 'rainy day'] },
  { key: 'booking', page: 'bookings', queries: ['预订酒店', '机票怎么比价', 'How to book?', 'flight tickets'] },
  { key: 'budget', page: 'budget', queries: ['花费怎么记账', 'AA怎么分', 'split expenses', 'budget'] },
  { key: 'saved', page: 'saved', queries: ['收藏在哪', 'save a place', 'My favorites', 'wishlist'] },
  { key: 'compare', page: 'compare', queries: ['怎么对比酒店', '投票选一个', 'compare hotels', 'vote'] },
]

for (const { key, page, queries } of tripCases) {
  for (const query of queries) {
    const hit = matchBoomi(query, 'my-trip')
    assert.equal(hit?.sayKey, `chat.${key}`, query)
    assert.equal(hit?.route, `/trip/my-trip/${page}`, query)
    for (const missingTrip of [undefined, '', '  ']) {
      assert.deepEqual(matchBoomi(query, missingTrip), { sayKey: 'chat.needTrip', route: '/new' }, query)
    }
  }
}

const globalCases = [
  { key: 'sample', queries: ['japan2026是干什么的？有必要吗？', 'JAPAN 2026', 'Japan-2026', '示例旅行', 'Can I delete the demo?', 'sample trip'], route: undefined },
  { key: 'theme', queries: ['怎么换主题', '海盐配色', 'change my theme'], route: '/profile' },
  { key: 'create', queries: ['创建旅行', '新建旅行', 'new trip', 'Create a trip'], route: '/new' },
  { key: 'backend', queries: ['后端 API 密钥怎么设置？', 'How do I sync?', 'API key', 'token'], route: '/profile' },
  { key: 'lang', queries: ['语言在哪里换', '怎么切英文', 'English', 'change language'], route: '/profile' },
  { key: 'tour', queries: ['引导怎么用', '新手教程', 'tour', 'walk me through', 'getting started'], route: undefined },
  { key: 'greeting', queries: ['你好', '嗨，Boomi！', 'Hello Boomi!', 'Boomi, hi!', 'hey'], route: undefined },
  { key: 'thanks', queries: ['谢谢', '谢谢你，Boomi！', 'Thanks!', 'Thank you Boomi.'], route: undefined },
]

for (const { key, queries, route } of globalCases) {
  for (const query of queries) {
    for (const tripId of ['my-trip', undefined]) {
      const hit = matchBoomi(query, tripId)
      assert.equal(hit?.sayKey, `chat.${key}`, query)
      assert.equal(hit?.route, route, query)
    }
  }
}

for (const query of ['', '  ', 'notebook', 'roadmap', 'SaaS', 'aaaa', 'bookworm', 'train', 'detourism', 'tourism', 'demographics', 'highlight', 'skyscape']) {
  assert.equal(matchBoomi(query, 'my-trip'), null, `Do not match a substring: ${query}`)
}
assert.equal(matchBoomi('Hello, how do I pack?', 'my-trip')?.sayKey, 'chat.pack')
assert.equal(matchBoomi('Thanks, where is the map?', 'my-trip')?.sayKey, 'chat.map')

const voiceCases = [
  ['', ''],
  [' \n\t ', ''],
  ['你好', '你好，喵'],
  ['你好。 \n', '你好，喵'],
  ['你好，喵', '你好，喵'],
  ['你好喵喵。', '你好，喵'],
  ['你好，喵！ 喵喵。', '你好，喵'],
  ['喵！喵。', '喵'],
  ['Hello.', 'Hello. 喵'],
  ['Hello. 喵! 喵喵。', 'Hello. 喵'],
  ['第一步：选日期。\n第二步：排路线！', '第一步：选日期。\n第二步：排路线，喵'],
  ['我会说“喵”，先选日期。', '我会说“喵”，先选日期，喵'],
  ['收拾好行李 🐾', '收拾好行李 🐾，喵'],
  ['Ready 🐱', 'Ready 🐱 喵'],
] as const

for (const [input, expected] of voiceCases) {
  const formatted = boomiSay(input)
  assert.equal(formatted, expected, input)
  assert.equal(boomiSay(formatted), formatted, `Formatting is idempotent: ${input}`)
  if (formatted) assert.match(formatted, /(?<!喵)喵$/u)
}

const trips = [{ id: 'template', template: true }, { id: 'first' }, { id: 'current' }]
assert.equal(guideTripId(trips, '/trip/current/pack'), 'current', 'Guide follows the open trip')
assert.equal(guideTripId(trips, '/'), 'first', 'Guide works without a hardcoded sample trip')
assert.equal(guideTripId(trips, '/trip/missing/plan'), 'first', 'Unknown routes use an existing trip')
assert.equal(guideTripId([{ id: 'template', template: true }], '/'), undefined)
assert.equal(guideTripId([], '/trip/deleted/plan'), undefined)
const emptySteps = guideSteps((key) => key)
assert.equal(emptySteps.length, 4)
assert.ok(emptySteps.every((step) => !step.route.includes('/trip/')), 'Empty accounts never tour nonexistent trip pages')
const activeSteps = guideSteps((key) => key, 'current')
assert.equal(activeSteps.length, 6)
assert.ok(activeSteps.every((step) => step.route === '/trip/current' || step.route.startsWith('/trip/current/')), 'Tour stays in the chosen trip')
assert.deepEqual(guideChips('/'), ['create', 'sample', 'theme'])
assert.deepEqual(guideChips('/trip/current/pack'), ['packing', 'weather'])
assert.deepEqual(guideChips('/trip/current/plan'), ['suggest', 'checkin', 'weather'])

console.log('Boomi intent, guide context, no-trip routing, and voice tests passed')
