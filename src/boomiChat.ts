export type BoomiHit = {
  sayKey: string
  route?: string
  selector?: string
}

function compact(q: string) {
  return q.trim().toLowerCase().replace(/\s+/g, '')
}

export function matchBoomi(q: string, tripId?: string): BoomiHit | null {
  const s = compact(q)
  if (!s) return null
  const trip = tripId ? `/trip/${tripId}` : undefined

  if (/打卡|check.?in|stamp|journal|怎么打|盖章|感受|拍照/.test(s)) {
    return {
      sayKey: 'chat.checkin',
      route: trip ? `${trip}/plan` : undefined,
      selector: '[data-guide="check-in"]',
    }
  }
  if (/推荐行程|recommend|生成行程|suggestaday|怎么排|帮我排|一天行程|排一天/.test(s)) {
    return {
      sayKey: 'chat.suggest',
      route: trip ? `${trip}/plan` : undefined,
      selector: '[data-guide="recommend"]',
    }
  }
  if (/地图|路线|绕路|map|route|detour/.test(s)) {
    return {
      sayKey: 'chat.map',
      route: trip ? `${trip}/map` : undefined,
      selector: '[data-guide="nav-map"]',
    }
  }
  if (/创建|新旅行|create|newtrip/.test(s)) {
    return {
      sayKey: 'chat.create',
      route: '/new',
      selector: '[data-guide="create-trip"]',
    }
  }
  if (/行李|打包|托运|packing|suitcase|随身包|行李清单|带什么/.test(s)) {
    return {
      sayKey: 'chat.pack',
      route: trip ? `${trip}/pack` : undefined,
      selector: '[data-guide="pack-list"]',
    }
  }
  if (/预订|机票|酒店|门票|比价|book|flight|hotel|ticket/.test(s)) {
    return {
      sayKey: 'chat.booking',
      route: trip ? `${trip}/bookings` : undefined,
      selector: '[data-guide="booking-links"]',
    }
  }
  if (/天气|下雨|planb|plan.?b|weather|rain/.test(s)) {
    return {
      sayKey: 'chat.weather',
      route: trip ? `${trip}/weather` : undefined,
      selector: '[data-guide="nav-weather"]',
    }
  }
  if (/预算|花费|aa|分账|budget|expense|split/.test(s)) {
    return { sayKey: 'chat.budget', route: trip ? `${trip}/budget` : undefined }
  }
  if (/语言|中文|english|language|locale/.test(s)) {
    return { sayKey: 'chat.lang', route: '/profile' }
  }
  if (/引导|教程|tour|怎么用这|新手/.test(s)) {
    return { sayKey: 'chat.tour' }
  }
  return null
}
