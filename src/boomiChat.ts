export type BoomiHit = {
  sayKey: string
  route?: string
  selector?: string
}

export function matchBoomi(q: string, tripId?: string): BoomiHit | null {
  // Keep spaces so English words such as "book" do not match "notebook".
  const s = q.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ')
  if (!s) return null
  const trip = tripId?.trim() ? `/trip/${tripId.trim()}` : undefined
  const inTrip = (sayKey: string, page: string, selector?: string): BoomiHit => {
    if (!trip) return { sayKey: 'chat.needTrip', route: '/new' }
    return { sayKey, route: `${trip}/${page}`, ...(selector ? { selector } : {}) }
  }

  if (/\bjapan[\s_-]*2026\b|示例|样例|演示旅行|\b(?:demo|sample|example)(?:\s+trip)?\b/.test(s)) {
    return { sayKey: 'chat.sample' }
  }
  if (/主题|换肤|配色|奶油|海盐|森林|\b(?:theme|themes|appearance)\b/.test(s)) {
    return { sayKey: 'chat.theme', route: '/profile' }
  }
  if (/创建|新旅行|新建旅行|\b(?:create|new\s+trip|newtrip)\b/.test(s)) {
    return { sayKey: 'chat.create', route: '/new', selector: '[data-guide="create-trip"]' }
  }
  if (/后端|接口|密钥|令牌|同步|云端备份|备份到|\b(?:api(?:[ -]?key)?|backend|sync|token)\b/.test(s)) {
    return { sayKey: 'chat.backend', route: '/profile' }
  }
  if (/语言|中文|英文|\b(?:english|chinese|language|locale)\b/.test(s)) {
    return { sayKey: 'chat.lang', route: '/profile' }
  }
  if (/引导|教程|怎么用这|怎么开始|新手|\b(?:tutorial|walkthrough|walk\s+me\s+through|how\s+to\s+use\s+boomvoy|getting\s+started)\b|^(?:start\s+(?:the\s+)?)?tour[!.?！。？]*$/.test(s)) {
    return { sayKey: 'chat.tour' }
  }

  if (/收藏|心愿|种草|\b(?:saved|save|favorites?|favourites?|wishlist|bookmarks?)\b/.test(s)) {
    return inTrip('chat.saved', 'saved')
  }
  if (/比较|对比|投票|纠结|\b(?:compare|comparison|vote|voting)\b/.test(s)) {
    return inTrip('chat.compare', 'compare', '[data-guide="nav-compare"]')
  }
  if (/打卡|盖章|感受|拍照|\b(?:check[ -]?in|stamps?|journal)\b/.test(s)) {
    return inTrip('chat.checkin', 'plan', '[data-guide="check-in"], [data-guide="nav-journal"]')
  }
  if (/推荐行程|推荐路线|生成行程|怎么排|帮我排|一天行程|排一天|\b(?:recommend(?:ations?)?|suggest(?:\s+a\s+day)?|suggestaday|plan\s+(?:a|my)\s+day)\b/.test(s)) {
    return inTrip('chat.suggest', 'plan', '[data-guide="recommend"]')
  }
  if (/地图|路线|绕路|\b(?:maps?|routes?|detours?)\b/.test(s)) {
    return inTrip('chat.map', 'map', '[data-guide="nav-map"]')
  }
  if (/行李|打包|托运|短袖|长袖|衣服|换洗|几件|随身包|带什么|\b(?:pack|packing|suitcase|luggage|what\s+to\s+bring)\b/.test(s)) {
    return inTrip('chat.pack', 'pack', '[data-guide="pack-list"]')
  }
  if (/天气|下雨|\b(?:plan[ -]?b|weather|rain|rainy)\b/.test(s)) {
    return inTrip('chat.weather', 'weather', '[data-guide="nav-weather"]')
  }
  if (/预订|机票|酒店|门票|比价|\b(?:book|bookings?|flights?|hotels?|tickets?)\b/.test(s)) {
    return inTrip('chat.booking', 'bookings', '[data-guide="booking-links"]')
  }
  if (/预算|花费|记账|分账|分摊|\b(?:aa|budget|expenses?|split)\b/.test(s)) {
    return inTrip('chat.budget', 'budget')
  }

  // Social replies are exact phrases, so a greeting does not hide a real question.
  if (/^(?:(?:boomi|boomvoy)[,，!！\s]*)?(?:你好|您好|嗨|哈[喽啰罗]|早上好|晚上好|hello|hi|hey)(?:[,，\s]*(?:boomi|boomvoy|小猫))?[!！。.～~?？]*$/.test(s)) {
    return { sayKey: 'chat.greeting' }
  }
  if (/^(?:谢谢(?:你|啦|了)?|多谢|感谢|thanks(?:\s+a\s+lot)?|thank\s+you)(?:[,，\s]*(?:boomi|boomvoy|小猫))?[!！。.～~]*$/.test(s)) {
    return { sayKey: 'chat.thanks' }
  }
  return null
}
