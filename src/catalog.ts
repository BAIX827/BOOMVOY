import type { ThemeId, TransportMode, WeatherCondition, DecisionStatus, BookingStatus, PlaceSetting, SavedKind, Priority } from './types'

export const THEMES: Record<
  ThemeId,
  { name: string; label: string; blurb: string; swatches: string[] }
> = {
  cream: {
    name: 'Cream',
    label: '奶油',
    blurb: '柔和、可爱，像一本旅行手帐。',
    swatches: ['#F7F0E6', '#F6E3EA', '#E8C36A', '#D989A0'],
  },
  ocean: {
    name: 'Ocean',
    label: '海盐',
    blurb: '清爽、干净，适合海岛与城市。',
    swatches: ['#EEF4F8', '#DCEEF5', '#7EC8D4', '#3E8EBE'],
  },
  forest: {
    name: 'Forest',
    label: '森林',
    blurb: '鼠尾草与林地，适合自驾与山野。',
    swatches: ['#F3EFE4', '#E4EAD8', '#A3B18A', '#4F6F52'],
  },
}

export const TRANSPORT: Record<TransportMode, { icon: string; label: string }> = {
  'self-drive': { icon: '🚗', label: '自驾' },
  public: { icon: '🚆', label: '公共交通' },
  walking: { icon: '🚶', label: '步行' },
  taxi: { icon: '🚕', label: '打车' },
  cycling: { icon: '🚲', label: '骑行' },
  mixed: { icon: '🔀', label: '混合' },
  flight: { icon: '✈️', label: '飞机' },
}

export const WEATHER: Record<WeatherCondition, { icon: string; label: string }> = {
  sunny: { icon: '☀️', label: '晴' },
  cloudy: { icon: '⛅', label: '多云' },
  rain: { icon: '🌧️', label: '雨' },
  storm: { icon: '⛈️', label: '暴雨' },
  snow: { icon: '❄️', label: '雪' },
  wind: { icon: '🌬️', label: '大风' },
}

export const SETTING: Record<PlaceSetting, { label: string; hint: string }> = {
  outdoor: { label: '户外', hint: '下雨时容易受影响' },
  indoor: { label: '室内', hint: '雨天备选' },
  mixed: { label: '室内外', hint: '部分可遮雨' },
}

export const STATUS: Record<DecisionStatus, { label: string; tone: string }> = {
  interested: { label: '感兴趣', tone: 'neutral' },
  comparing: { label: '比较中', tone: 'info' },
  shortlisted: { label: '入围', tone: 'good' },
  chosen: { label: '已选定', tone: 'accent' },
  booked: { label: '已预订', tone: 'good' },
  rejected: { label: '已排除', tone: 'muted' },
}

export const BOOKING_STATUS: Record<BookingStatus, { label: string; tone: string }> = {
  need: { label: '待预订', tone: 'warn' },
  booked: { label: '已预订', tone: 'info' },
  paid: { label: '已付款', tone: 'good' },
  cancelled: { label: '已取消', tone: 'muted' },
  refunded: { label: '已退款', tone: 'muted' },
}

export const KINDS: Record<SavedKind, { label: string; icon: string }> = {
  flight: { label: '机票', icon: '✈️' },
  hotel: { label: '酒店', icon: '🏨' },
  restaurant: { label: '餐厅', icon: '🍜' },
  place: { label: '地点', icon: '📍' },
  activity: { label: '活动', icon: '🎟️' },
  'rental-car': { label: '租车', icon: '🚗' },
  souvenir: { label: '伴手礼', icon: '🎁' },
  route: { label: '路线', icon: '🗺️' },
}

export const PRIORITY: Record<Priority, string> = {
  must: '必去',
  want: '想去',
  optional: '有空再去',
}

export const BUDGET_CATS = [
  '机票',
  '住宿',
  '餐饮',
  '交通',
  '活动',
  '购物',
  '伴手礼',
  '其他',
  '应急',
]

export const DAY_COLORS = ['#E8C36A', '#3E8EBE', '#6B8F71', '#8B6BB8', '#D989A0', '#C47A3A', '#4F6F52', '#7EC8D4']

export const MEMBER_COLORS = ['#D989A0', '#3E8EBE', '#6B8F71', '#E8C36A', '#8B6BB8', '#C47A3A']
