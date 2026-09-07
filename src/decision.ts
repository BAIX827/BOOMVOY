import type { Cuisine, DecisionCandidate, DecisionCriterion, DecisionPreferences, MealChoice, RankedDecision } from './decisionTypes'

export const CUISINES: Cuisine[] = ['any', 'mexican', 'japanese', 'italian', 'thai', 'chinese', 'indian', 'korean', 'vietnamese', 'local']

const cuisineTerms: Record<Exclude<Cuisine, 'any'>, string> = {
  mexican: '墨西哥(?:菜|餐)?|\\bmexican\\b|\\btacos?\\b',
  japanese: '日料|日式|日本(?:菜|料理)|寿司|\\bjapanese\\b|\\bsushi\\b',
  italian: '意大利(?:菜|餐)?|意式|披萨|\\bitalian\\b|\\bpizza\\b',
  thai: '泰国(?:菜|餐)?|泰餐|泰式|\\bthai\\b',
  chinese: '中餐|中国菜|中式|\\bchinese\\b',
  indian: '印度(?:菜|餐)?|\\bindian\\b',
  korean: '韩餐|韩式|韩国(?:菜|料理)|\\bkorean\\b',
  vietnamese: '越南(?:菜|餐)?|越式|\\bvietnamese\\b',
  local: '当地(?:菜|美食)|本地(?:菜|美食)|\\blocal (?:food|cuisine)\\b',
}

const cityAliases: Record<string, string[]> = {
  melbourne: ['melbourne', '墨尔本', '墨爾本'], sydney: ['sydney', '悉尼', '雪梨'],
  brisbane: ['brisbane', '布里斯班'], goldcoast: ['gold coast', '黄金海岸', '黃金海岸'],
  cairns: ['cairns', '凯恩斯', '凱恩斯'], perth: ['perth', '珀斯'], adelaide: ['adelaide', '阿德莱德'],
  tokyo: ['tokyo', '东京', '東京'], osaka: ['osaka', '大阪'], kyoto: ['kyoto', '京都'],
  seoul: ['seoul', '首尔', '首爾'], singapore: ['singapore', '新加坡'], hongkong: ['hong kong', '香港'],
  bangkok: ['bangkok', '曼谷'], paris: ['paris', '巴黎'], london: ['london', '伦敦', '倫敦'],
  newyork: ['new york', '纽约', '紐約'], auckland: ['auckland', '奥克兰', '奧克蘭'],
  wellington: ['wellington', '惠灵顿'], queenstown: ['queenstown', '皇后镇'],
  canggu: ['canggu', '仓古', '倉古', '坎古'], ubud: ['ubud', '乌布', '烏布'], bali: ['bali', '巴厘岛', '巴厘島'],
}

function normalizedCity(value: string): string {
  const text = value.normalize('NFKC').toLowerCase().trim()
  for (const [key, aliases] of Object.entries(cityAliases)) {
    if (aliases.some((alias) => /^[a-z ]+$/.test(alias)
      ? new RegExp(`(?:^|[^a-z])${alias}(?:$|[^a-z])`).test(text)
      : text.includes(alias))) return key
  }
  return text.split(/[,，]/)[0].replace(/[\s\p{P}]/gu, '')
}

function matchesCity(candidateCity: string, targetCity: string): boolean {
  const city = normalizedCity(candidateCity)
  return city === targetCity || (targetCity === 'bali' && ['canggu', 'ubud'].includes(city))
}

/** Negation belongs to the current short clause, ending at a contrast or punctuation. */
function isNegated(text: string, index: number, length = 0): boolean {
  const before = text.slice(0, index).split(/[,，。;；!！?？\n]|\bbut\b|但是|但|改成|换成|而是/i).at(-1) || ''
  const after = text.slice(index + length, index + length + 18)
  if (/(?:不要|不想要|排除|避免)(?:[\s的]{0,3})(?:没有|沒有|无|無|不带|不帶)(?:[\s的]{0,3})$/u.test(before)
    || /\b(?:don['’]?t want|do not want|no|not)\b[^,.]{0,30}\bwithout\s*$/i.test(before)) return false
  const positiveRestart = /(?<![不无])(?:想要|需要|想|要|必须)(?:[\s的有带含住吃]{0,3})$/u.test(before)
    && !/(?:不需要|不想要|不想|不要|无需|无须)(?:[\s的有带含住吃]{0,3})$/u.test(before)
  return (!positiveRestart && /(?:不(?:要|想|用|需要|喜欢|吃|住|考虑|要求)?|没有|沒有|无需|无须|无|無|排除|别|避免|拒绝)(?:[\s\p{L}]{0,8})$/u.test(before))
    || /\b(?:no|not|without|avoid|exclude|excluding|don['’]?t(?:\s+want)?|do not(?:\s+want)?)\b(?:[\s\w-]{0,22})$/i.test(before)
    || /^(?:\s*(?:都)?(?:不需要|不用|不要|无所谓|可有可无))/.test(after)
    || /^\s*(?:is\s+)?(?:not needed|optional|doesn['’]?t matter)\b/i.test(after)
}

function readBoolean(text: string, terms: string): boolean | undefined {
  let value: boolean | undefined
  for (const match of text.matchAll(new RegExp(terms, 'gi'))) value = !isNegated(text, match.index, match[0].length)
  return value
}

const currencyTerms = [
  ['AUD', '(?:AUD|AU\\$|A\\$|澳元|澳币|澳幣|澳刀)'],
  ['CNY', '(?:CNY|RMB|人民币|人民幣|元人民币|元人民幣|￥|¥)'],
  ['USD', '(?:USD|US\\$|美元|美金|美刀)'],
  ['JPY', '(?:JPY|日元|日币|日幣|円)'],
  ['EUR', '(?:EUR|欧元|歐元|€)'],
] as const
const currencyPattern = currencyTerms.map(([, pattern]) => pattern).join('|')
const amountPattern = '(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d{1,2})?'

function parseBudget(text: string, prefs: DecisionPreferences): Pick<DecisionPreferences, 'budgetMax' | 'currency'> | undefined {
  // A currency or explicit money context is required; dates, star ratings and party sizes are not budgets.
  const money = new RegExp(`(?:(${currencyPattern})\\s*)?(${amountPattern})(?:\\s*(?:-|–|—|~|～|至|到|to)\\s*(?:${currencyPattern})?\\s*(${amountPattern}))?\\s*(${currencyPattern}|元|\\$)?`, 'gi')
  let result: Pick<DecisionPreferences, 'budgetMax' | 'currency'> | undefined
  for (const match of text.matchAll(money)) {
    const index = match.index
    const before = text.slice(Math.max(0, index - 28), index)
    const after = text.slice(index + match[0].length, index + match[0].length + 28)
    const context = `${before}${match[0]}${after}`
    if (/(?:\b(?:CAD|NZD|SGD|HKD|GBP|CHF|THB|KRW)\b|加元|纽币|纽元|港币|港元|新币|英镑|£|韩元|泰铢)/i.test(context)) continue
    if (/[\d.eE/+-]$/.test(before) || /(?:^|\s)-\s*$/.test(before) || /^(?:\d|[.,]\d|(?:-|\/)\d|[eE][+-]?\d)/.test(after)) continue
    const mentionedCurrencies = currencyTerms.filter(([, terms]) => new RegExp(terms, 'i').test(match[0]))
    if (mentionedCurrencies.length > 1) continue
    const unit = /(?:人均|每人|per\s+(?:person|head)|\/\s*(?:person|head|人))/i.test(context) ? 'person'
      : /(?:每晚|一晚|per\s+night|\/\s*(?:night|晚))/i.test(context) ? 'night' : undefined
    if (unit && unit !== (prefs.kind === 'hotel' ? 'night' : 'person')) continue
    const currencyToken = match[1] || match[4]
    const hasContext = Boolean(currencyToken)
      || /(?:预算|人均|每人|每晚|budget|under|below|up to|at most|no more than)(?:[^\d,，。;；]{0,14})$/i.test(before)
      || /^\s*(?:以内|以下|每晚|人均|per\s+(?:night|person)|\/\s*(?:night|person|人|晚))/i.test(after)
    if (!hasContext || /(?:评分|评价|rating|reviews?)\s*$/i.test(before) || /^\s*(?:星|分|人(?:\s|$)|晚(?:\s|$)|天|条|people\b|persons?\b|reviews?\b|stars?\b)/i.test(after)) continue
    // "不要超过 300" sets an upper bound, while "不要 300 的" and minimum-only prices do not.
    if (isNegated(text, index) && !/(?:不超过|不要超过|不能超过|不高于|no more than|not (?:more than|over))\s*(?:[A-Z]{3}\s*)?$/i.test(before)) continue
    if (/(?:至少|最低|高于|超过|above|over|at least|more than)\s*(?:[A-Z]{3}\s*)?$/i.test(before)
      && !/(?:不超过|不要超过|不能超过|不高于|no more than|not (?:more than|over))\s*(?:[A-Z]{3}\s*)?$/i.test(before)) continue
    const min = Number(match[2].replace(/,/g, ''))
    const max = Number((match[3] || match[2]).replace(/,/g, ''))
    if (!Number.isFinite(max) || max <= 0 || max > 1e9 || min > max) continue
    const detected = currencyTerms.find(([, terms]) => currencyToken && new RegExp(`^(?:${terms})$`, 'i').test(currencyToken))?.[0]
    result = { budgetMax: max, currency: currencyToken === '¥' && prefs.currency === 'JPY' ? 'JPY' : detected || (currencyToken === '元' ? 'CNY' : prefs.currency) }
  }
  return result
}

/** Small, deterministic intent parser. Unrecognized requests keep the user's explicit controls. */
export function parseDecisionIntent(text: string, base: DecisionPreferences): DecisionPreferences {
  const input = text.normalize('NFKC').slice(0, 2000)
  const next = { ...base, excludedCuisines: [...(base.excludedCuisines || [])] }
  let kind: DecisionPreferences['kind'] | undefined
  const kindPattern = /酒店|旅馆|旅館|住宿|民宿|房间|房間|海景房|住(?:在|一|几|幾|个|個)?|\bhotels?\b|\baccommodation\b|\bstay\b|餐厅|餐廳|餐馆|餐館|人均|吃|\brestaurants?\b|\bdining\b|\beat\b/gi
  for (const match of input.matchAll(kindPattern)) {
    if (!isNegated(input, match.index, match[0].length)) kind = /餐|人均|吃|restaurant|dining|eat/i.test(match[0]) ? 'restaurant' : 'hotel'
  }
  if (!kind) {
    const accommodationPattern = /\b(?:sea|ocean)[ -]?view\s+rooms?\b|\b(?:a|an)\s+room\s+(?:with|under)\b|\bper\s+night\b/gi
    for (const match of input.matchAll(accommodationPattern)) {
      if (!isNegated(input, match.index, match[0].length)) kind = 'hotel'
    }
  }
  let selectedCuisine: Cuisine | undefined
  let cuisineIndex = -1
  for (const [cuisine, terms] of Object.entries(cuisineTerms) as [Exclude<Cuisine, 'any'>, string][]) {
    for (const match of input.matchAll(new RegExp(terms, 'gi'))) {
      if (isNegated(input, match.index, match[0].length)) {
        if (!next.excludedCuisines.includes(cuisine)) next.excludedCuisines.push(cuisine)
        if (next.cuisine === cuisine) next.cuisine = 'any'
      } else {
        next.excludedCuisines = next.excludedCuisines.filter((item) => item !== cuisine)
        if (match.index > cuisineIndex) { selectedCuisine = cuisine; cuisineIndex = match.index }
      }
    }
  }
  if (selectedCuisine && !next.excludedCuisines.includes(selectedCuisine)) {
    next.cuisine = selectedCuisine
    if (!kind) kind = 'restaurant'
  }
  if (kind && kind !== base.kind) {
    if (kind === 'restaurant') { next.seaView = false; next.parking = false; next.freeParking = false }
    else { next.cuisine = 'any'; next.excludedCuisines = []; next.variety = false }
  }
  if (kind) next.kind = kind
  const seaView = readBoolean(input, '海景(?:房)?|看(?:得)?到海|能看到海|面(?:向)?海|\\b(?:sea|ocean)[ -]?view(?: room)?\\b')
  let parking: boolean | undefined
  for (const match of input.matchAll(/停车(?:场|位)?|停車(?:場|位)?|\bparking\b|\bcar park\b/gi)) {
    const before = input.slice(Math.max(0, match.index - 12), match.index)
    const after = input.slice(match.index + match[0].length, match.index + match[0].length + 6)
    if (/(?:免费(?:的)?|免費(?:的)?|free\s+)$/i.test(before) || /^\s*免费/.test(after)) continue
    parking = !isNegated(input, match.index, match[0].length)
  }
  const freeParking = readBoolean(input, '免费(?:的)?停车(?:场|位)?|免費(?:的)?停車(?:場|位)?|停车(?:场|位)?免费|\\bfree parking\\b')
  if (seaView !== undefined) next.seaView = seaView
  if (parking !== undefined) { next.parking = parking; if (!parking) next.freeParking = false }
  if (freeParking !== undefined) { next.freeParking = freeParking; if (freeParking) next.parking = true }
  const variety = readBoolean(input, '每天(?:都)?(?:吃)?(?:不一样|不同)|天天(?:吃)?(?:不一样|不同)|换着吃|每天换|\\b(?:different|varied) (?:food|cuisine|cuisines)(?: every day)?\\b|\\bvariety\\b')
  if (variety !== undefined) next.variety = variety
  if (/(?:每天|天天)(?:都)?(?:想|要)?吃(?:一样|相同)|\bsame (?:food|cuisine) every day\b/i.test(input)) next.variety = false
  Object.assign(next, parseBudget(input, next))
  return next
}

function positiveNumber(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value) && value > 0 }
function validRating(candidate: DecisionCandidate): boolean { return positiveNumber(candidate.rating?.value) && candidate.rating!.value <= 5 }
function validCount(candidate: DecisionCandidate): boolean { return Number.isInteger(candidate.rating?.count) && candidate.rating!.count! >= 0 }

/** Match confidence uses only evidenced fields. A 5-point review score is never a hotel star class. */
export function rankDecisions(candidates: DecisionCandidate[], prefs: DecisionPreferences): RankedDecision[] {
  const targetCity = normalizedCity(prefs.city)
  if (!targetCity) return []
  const ranked: RankedDecision[] = []
  const seen = new Map<string, string[]>()
  const sourcePriority = { google: 3, saved: 2, curated: 1 }
  const ordered = [...candidates].sort((a, b) => (sourcePriority[b?.source] || 0) - (sourcePriority[a?.source] || 0))
  for (const candidate of ordered) {
    if (!candidate || candidate.kind !== prefs.kind || typeof candidate.name !== 'string' || !candidate.name.trim() || typeof candidate.city !== 'string' || !matchesCity(candidate.city, targetCity)) continue
    const identity = `${normalizedCity(candidate.city)}:${candidate.name.normalize('NFKC').toLowerCase().replace(/[\s\p{P}]/gu, '')}`
    const address = typeof candidate.address === 'string' ? candidate.address.normalize('NFKC').toLowerCase().replace(/[\s\p{P}]/gu, '') : ''
    const addresses = seen.get(identity) || []
    if (addresses.some((previous) => !address || !previous || previous === address)) continue
    seen.set(identity, [...addresses, address])
    const criteria: DecisionCriterion[] = []
    const add = (key: DecisionCriterion['key'], state: DecisionCriterion['state']) => criteria.push({ key, state })
    if (positiveNumber(prefs.budgetMax)) {
      const price = candidate.price
      const valid = price && typeof price.currency === 'string' && positiveNumber(price.max) && (price.min === undefined || (typeof price.min === 'number' && Number.isFinite(price.min) && price.min >= 0 && price.min <= price.max))
      add('budget', !valid || price.currency.toUpperCase() !== prefs.currency.toUpperCase() || price.basis !== (prefs.kind === 'hotel' ? 'night' : 'person')
        ? 'unknown' : price.max <= prefs.budgetMax ? 'match' : 'fail')
    }
    if (prefs.kind === 'hotel' && prefs.seaView) add('seaView', candidate.seaView === 'room' ? 'match' : candidate.seaView === 'none' ? 'fail' : 'unknown')
    if (prefs.parking) add('parking', ['free', 'paid', 'available'].includes(candidate.parking || '') ? 'match' : candidate.parking === 'none' ? 'fail' : 'unknown')
    if (prefs.freeParking) add('freeParking', candidate.parking === 'free' ? 'match' : ['paid', 'none'].includes(candidate.parking || '') ? 'fail' : 'unknown')
    if (prefs.kind === 'restaurant') {
      const cuisines = Array.isArray(candidate.cuisines) ? candidate.cuisines.filter((item) => item !== 'any' && CUISINES.includes(item)) : []
      if (cuisines.some((item) => prefs.excludedCuisines?.includes(item))) add('cuisine', 'fail')
      else if (prefs.cuisine !== 'any') add('cuisine', !cuisines.length ? 'unknown' : cuisines.includes(prefs.cuisine) ? 'match' : 'fail')
      else if (prefs.excludedCuisines?.length) add('cuisine', cuisines.length ? 'match' : 'unknown')
    }
    if (positiveNumber(prefs.minRating)) add('rating', !validRating(candidate) ? 'unknown' : candidate.rating!.value >= prefs.minRating ? 'match' : 'fail')
    if (positiveNumber(prefs.minReviews)) add('reviews', !validCount(candidate) ? 'unknown' : candidate.rating!.count! >= prefs.minReviews ? 'match' : 'fail')
    const failed = criteria.some((criterion) => criterion.state === 'fail')
    const unknown = !criteria.length || criteria.some((criterion) => criterion.state === 'unknown')
    const confidence = failed ? 'excluded' : unknown ? 'check' : 'confirmed'
    const ratio = criteria.length ? Math.round(100 * criteria.filter((criterion) => criterion.state === 'match').length / criteria.length) : 0
    // Missing requirements cap the recommendation band; uncertainty cannot be presented as a high match.
    const matchScore = Math.min(ratio, failed ? 49 : unknown ? 69 : 100)
    // Bayesian shrinkage: one 5/5 review should not outrank hundreds of consistently strong reviews.
    const count = validCount(candidate) ? candidate.rating!.count! : 0
    const qualityScore = validRating(candidate) && count > 0 ? Number(((candidate.rating!.value * count + 3.5 * 100) / (count + 100)).toFixed(3)) : 0
    ranked.push({ candidate, criteria, matchScore, confidence, qualityScore })
  }
  const band = { confirmed: 2, check: 1, excluded: 0 }
  return ranked.sort((a, b) => band[b.confidence] - band[a.confidence] || b.matchScore - a.matchScore || b.qualityScore - a.qualityScore || a.candidate.name.localeCompare(b.candidate.name))
}

export function safeDecisionUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > 4096 || /[\u0000-\u001f\u007f]/.test(value)) return undefined
  try {
    const url = new URL(value)
    return (url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password && Boolean(url.hostname) ? url.href : undefined
  } catch { return undefined }
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T12:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export type DecisionLink = { label: string; url: string; kind: 'detail' | 'booking' | 'search' }

/** Search links carry preferences as keywords, never unverified amenity/price filter IDs. */
export function buildDecisionLinks(prefs: DecisionPreferences, candidate?: DecisionCandidate): DecisionLink[] {
  const links: DecisionLink[] = []
  const add = (label: string, raw: unknown, kind: DecisionLink['kind']) => {
    const url = safeDecisionUrl(raw)
    if (!url) return
    const existing = links.findIndex((link) => link.url === url)
    if (existing < 0) links.push({ label, url, kind })
    else if (kind === 'booking') links[existing] = { label, url, kind }
  }
  const name = candidate?.name?.slice(0, 200)
  const city = (candidate?.city || prefs.city).slice(0, 200)
  const keywords = [city, prefs.kind === 'hotel' ? 'hotels' : (prefs.cuisine === 'any' ? 'restaurants' : `${prefs.cuisine} restaurants`)]
  if (prefs.kind === 'restaurant' && prefs.excludedCuisines?.length) keywords.push(`excluding ${prefs.excludedCuisines.filter((item) => item !== 'any').join(', ')}`)
  if (prefs.kind === 'hotel' && prefs.seaView) keywords.push('sea view room')
  if (prefs.freeParking) keywords.push('free parking')
  else if (prefs.parking) keywords.push('parking')
  if (positiveNumber(prefs.budgetMax)) keywords.push(`under ${prefs.currency} ${prefs.budgetMax} per ${prefs.kind === 'hotel' ? 'night' : 'person'}`)
  const query = name ? [name, candidate?.address || city].join(', ') : keywords.join(' ')
  const maps = new URL('https://www.google.com/maps/search/')
  maps.searchParams.set('api', '1')
  maps.searchParams.set('query', query)
  add(candidate ? '地图与评价 / Maps & reviews' : '地图搜索 / Search Maps', safeDecisionUrl(candidate?.mapsUrl) || maps.href, candidate ? 'detail' : 'search')
  if (candidate) {
    add('官网 / Official website', candidate.websiteUrl, 'detail')
    add('预订入口 / Booking page', candidate.bookingUrl, 'booking')
    add('信息来源 / Source', candidate.sourceUrl, 'detail')
  }
  if (prefs.kind === 'hotel') {
    const booking = new URL('https://www.booking.com/searchresults.html')
    booking.searchParams.set('ss', name ? `${name} ${city}` : city)
    if (validDate(prefs.checkin) && validDate(prefs.checkout) && prefs.checkout > prefs.checkin) {
      booking.searchParams.set('checkin', prefs.checkin)
      booking.searchParams.set('checkout', prefs.checkout)
    }
    if (Number.isInteger(prefs.travellers) && prefs.travellers > 0 && prefs.travellers <= 30) booking.searchParams.set('group_adults', String(prefs.travellers))
    if (currencyTerms.some(([currency]) => currency === prefs.currency.toUpperCase())) booking.searchParams.set('selected_currency', prefs.currency.toUpperCase())
    add('Booking 搜索 / Booking search', booking.href, 'search')
    // Prices and amenities remain explicit keywords until a provider exposes verified structured filters.
    if (prefs.seaView || prefs.parking || prefs.freeParking || positiveNumber(prefs.budgetMax)) {
      const search = new URL('https://www.google.com/search')
      search.searchParams.set('q', `site:booking.com ${name ? `${name} ` : ''}${keywords.join(' ')}`)
      add('条件搜索 / Search requirements', search.href, 'search')
    }
  } else {
    const search = new URL('https://www.google.com/search')
    search.searchParams.set('q', `${query} reservations booking${prefs.checkin && validDate(prefs.checkin) ? ` ${prefs.checkin}` : ''}${Number.isInteger(prefs.travellers) && prefs.travellers > 0 ? ` ${prefs.travellers} people` : ''}`)
    add('订位搜索 / Search reservations', search.href, 'search')
  }
  return links
}

function mealIdentity(candidate: DecisionCandidate): string {
  return `${normalizedCity(candidate.city)}:${candidate.name.normalize('NFKC').toLowerCase().replace(/[\s\p{P}]/gu, '')}`
}

/** One dining suggestion per date; gaps become cuisine searches instead of invented restaurants. */
export function planMeals(days: { date: string; city: string }[], prefs: DecisionPreferences, candidates: DecisionCandidate[], alreadySelected: MealChoice[] = []): MealChoice[] {
  const rotation = CUISINES.filter((cuisine) => cuisine !== 'any' && !prefs.excludedCuisines?.includes(cuisine))
  const selectedByDate = new Map(alreadySelected.filter((meal) => validDate(meal.date)).map((meal) => [meal.date, meal]))
  // Reserve future selections too, while calculating actual repetition separately in date order.
  const allocatedCuisines = new Set([...selectedByDate.values()].map((meal) => meal.cuisine))
  const usedRestaurants = new Set([...selectedByDate.values()].flatMap((meal) => meal.candidate ? [mealIdentity(meal.candidate)] : []))
  const inputDays = [...new Map(days.filter((day) => validDate(day.date)).map((day) => [day.date, day])).values()]
  const result = new Map<string, MealChoice>()
  for (const day of [...inputDays].sort((a, b) => a.date.localeCompare(b.date))) {
    const selected = selectedByDate.get(day.date)
    if (selected) {
      result.set(day.date, { ...selected })
      continue
    }
    const allowedPreferred = prefs.cuisine !== 'any' && rotation.includes(prefs.cuisine) ? prefs.cuisine : undefined
    let cuisine: Cuisine = allowedPreferred || 'any'
    if (prefs.variety) {
      const available = rankDecisions(candidates, { ...prefs, kind: 'restaurant', city: day.city, cuisine: 'any' })
        .filter((ranked) => ranked.confidence !== 'excluded' && !usedRestaurants.has(mealIdentity(ranked.candidate)))
      const unusedAvailable = available.flatMap((ranked) => ranked.candidate.cuisines || [])
        .find((item) => rotation.includes(item) && !allocatedCuisines.has(item))
      cuisine = result.size === 0 && allowedPreferred && !allocatedCuisines.has(allowedPreferred) ? allowedPreferred
        : unusedAvailable || rotation.find((item) => !allocatedCuisines.has(item)) || rotation[result.size % Math.max(1, rotation.length)] || 'any'
    }
    const options = rankDecisions(candidates, { ...prefs, kind: 'restaurant', city: day.city, cuisine })
      .filter((ranked) => ranked.confidence !== 'excluded' && !usedRestaurants.has(mealIdentity(ranked.candidate))
        && (cuisine === 'any' || ranked.candidate.cuisines?.includes(cuisine)))
    // If every explicit cuisine is excluded, retain an empty search slot for the user to revise.
    const candidate = rotation.length ? options[0]?.candidate : undefined
    result.set(day.date, { date: day.date, city: day.city, cuisine, candidate, repeated: false })
    if (cuisine !== 'any') allocatedCuisines.add(cuisine)
    if (candidate) usedRestaurants.add(mealIdentity(candidate))
  }
  const previousCuisines = new Set<Cuisine>()
  const timeline = new Map([...selectedByDate, ...result])
  for (const meal of [...timeline.values()].sort((a, b) => a.date.localeCompare(b.date))) {
    const current = result.get(meal.date)
    if (current) current.repeated = prefs.variety && meal.cuisine !== 'any' && previousCuisines.has(meal.cuisine)
    if (meal.cuisine !== 'any') previousCuisines.add(meal.cuisine)
  }
  return inputDays.map((day) => result.get(day.date)!)
}
