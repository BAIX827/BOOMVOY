import type { ThemeId } from './types'
import { LANDMARK_ILLUSTRATIONS } from './illustrationLandmarks'

export const CITY_ILLUSTRATIONS = [
  { id: 'sydney', aliases: ['Sydney', '悉尼', '雪梨', 'シドニー', '시드니', 'سيدني'] },
  { id: 'tokyo', aliases: ['Tokyo', '东京', '東京', '東京都', '도쿄', 'طوكيو'] },
  { id: 'fuji', aliases: ['Fuji', 'Mount Fuji', '富士', '富士山', '河口湖', 'Kawaguchiko'] },
  { id: 'kyoto', aliases: ['Kyoto', '京都', '京都市', '교토'] },
  { id: 'osaka', aliases: ['Osaka', '大阪', '大阪市', '오사카'] },
  { id: 'paris', aliases: ['Paris', '巴黎', 'パリ', '파리', 'باريس'] },
  { id: 'new-york', aliases: ['New York', 'New York City', 'NYC', '纽约', '紐約', 'ニューヨーク', '뉴욕', 'نيويورك'] },
  { id: 'cairo', aliases: ['Cairo', 'Giza', '开罗', '開羅', '吉萨', 'カイロ', 'القاهرة', 'الجيزة'] },
  { id: 'rio', aliases: ['Rio de Janeiro', 'Rio', '里约热内卢', '里約熱內盧', '里约', 'リオデジャネイロ'] },
  { id: 'london', aliases: ['London', '伦敦', '倫敦', 'ロンドン', 'لندن'] },
  { id: 'rome', aliases: ['Rome', 'Roma', '罗马', '羅馬', 'ローマ'] },
  { id: 'beijing', aliases: ['Beijing', 'Peking', '北京', '北京市', 'ペキン', '베이징'] },
  { id: 'singapore', aliases: ['Singapore', '新加坡', 'シンガポール', 'Singapura'] },
  { id: 'melbourne', aliases: ['Melbourne', '墨尔本', '墨爾本', 'メルボルン'] },
  { id: 'istanbul', aliases: ['Istanbul', 'İstanbul', '伊斯坦布尔', '伊斯坦堡', 'イスタンブール', 'إسطنبول'] },
  { id: 'vancouver', aliases: ['Vancouver', '温哥华', '溫哥華', 'バンクーバー'] },
  { id: 'san-francisco', aliases: ['San Francisco', '旧金山', '舊金山', '三藩市', 'サンフランシスコ'] },
  { id: 'mexico-city', aliases: ['Mexico City', 'Ciudad de México', 'CDMX', '墨西哥城', 'メキシコシティ'] },
  { id: 'buenos-aires', aliases: ['Buenos Aires', '布宜诺斯艾利斯', '布宜諾斯艾利斯'] },
  { id: 'cape-town', aliases: ['Cape Town', 'Kaapstad', '开普敦', '開普敦'] },
  { id: 'marrakech', aliases: ['Marrakech', 'Marrakesh', '马拉喀什', '馬拉喀什', 'مراكش'] },
  { id: 'dubai', aliases: ['Dubai', '迪拜', 'دبي'] },
  { id: 'bangkok', aliases: ['Bangkok', '曼谷', 'กรุงเทพมหานคร', 'バンコク'] },
  { id: 'seoul', aliases: ['Seoul', '首尔', '首爾', '서울', 'ソウル'] },
  { id: 'shanghai', aliases: ['Shanghai', '上海', '上海市', 'シャンハイ'] },
  { id: 'barcelona', aliases: ['Barcelona', '巴塞罗那', '巴塞羅那', 'バルセロナ'] },
  { id: 'auckland', aliases: ['Auckland', '奥克兰', '奧克蘭', 'オークランド'] },
  { id: 'amsterdam', aliases: ['Amsterdam', '阿姆斯特丹'] },
  { id: 'prague', aliases: ['Prague', 'Praha', '布拉格'] },
  { id: 'lisbon', aliases: ['Lisbon', 'Lisboa', '里斯本'] },
  { id: 'copenhagen', aliases: ['Copenhagen', 'København', '哥本哈根'] },
  { id: 'reykjavik', aliases: ['Reykjavik', 'Reykjavík', '雷克雅未克'] },
  { id: 'nairobi', aliases: ['Nairobi', '内罗毕', '內羅畢'] },
  { id: 'havana', aliases: ['Havana', 'La Habana', '哈瓦那'] },
  { id: 'cusco', aliases: ['Cusco', 'Cuzco', '库斯科', '庫斯科'] },
  { id: 'mumbai', aliases: ['Mumbai', 'Bombay', '孟买', '孟買'] },
  { id: 'kuala-lumpur', aliases: ['Kuala Lumpur', 'KL', '吉隆坡'] },
  { id: 'vienna', aliases: ['Vienna', 'Wien', '维也纳', '維也納'] },
  { id: 'edinburgh', aliases: ['Edinburgh', '爱丁堡', '愛丁堡'] },
  { id: 'stockholm', aliases: ['Stockholm', '斯德哥尔摩', '斯德哥爾摩'] },
  { id: 'los-angeles', aliases: ['Los Angeles', 'LA', '洛杉矶', '洛杉磯'] },
  { id: 'toronto', aliases: ['Toronto', '多伦多', '多倫多'] },
  { id: 'cartagena', aliases: ['Cartagena', 'Cartagena de Indias', '卡塔赫纳', '卡塔赫納'] },
  { id: 'muscat', aliases: ['Muscat', 'مسقط', '马斯喀特', '馬斯喀特'] },
  { id: 'kathmandu', aliases: ['Kathmandu', '加德满都', '加德滿都'] },
  { id: 'hanoi', aliases: ['Hanoi', 'Hà Nội', '河内', '河內'] },
  { id: 'casablanca', aliases: ['Casablanca', '卡萨布兰卡', '卡薩布蘭卡'] },
  { id: 'madrid', aliases: ['Madrid', '马德里', '馬德里'] },
  { id: 'budapest', aliases: ['Budapest', '布达佩斯', '布達佩斯'] },
  { id: 'berlin', aliases: ['Berlin', '柏林'] },
  { id: 'quebec-city', aliases: ['Quebec City', 'Québec City', '魁北克城'] },
  { id: 'new-orleans', aliases: ['New Orleans', '新奥尔良', '新奧爾良'] },
  { id: 'lima', aliases: ['Lima', '利马', '利馬'] },
  { id: 'accra', aliases: ['Accra', '阿克拉'] },
  { id: 'doha', aliases: ['Doha', 'الدوحة', '多哈'] },
  { id: 'ho-chi-minh-city', aliases: ['Ho Chi Minh City', 'Ho Chi Minh', 'Hồ Chí Minh City', 'Saigon', '胡志明市', '西贡', '西貢'] },
  { id: 'wellington', aliases: ['Wellington', '惠灵顿', '惠靈頓'] },
  { id: 'florence', aliases: ['Florence', 'Firenze', '佛罗伦萨', '佛羅倫薩'] },
  { id: 'athens', aliases: ['Athens', 'Αθήνα', '雅典'] },
  { id: 'porto', aliases: ['Porto', 'Oporto', '波尔图', '波爾圖'] },
  { id: 'chicago', aliases: ['Chicago', '芝加哥'] },
  { id: 'washington-dc', aliases: ['Washington DC', 'Washington, D.C.', 'Washington D.C.', '华盛顿特区', '華盛頓特區'] },
  { id: 'santiago-de-chile', aliases: ['Santiago de Chile', 'Santiago, Chile', '智利圣地亚哥', '圣地亚哥（智利）', '聖地亞哥（智利）'] },
  { id: 'hong-kong', aliases: ['Hong Kong', '香港', '香港特别行政区'] },
  { id: 'xi-an', aliases: ["Xi'an", 'Xian', '西安', '西安市'] },
  { id: 'chengdu', aliases: ['Chengdu', '成都', '成都市'] },
  { id: 'dakar', aliases: ['Dakar', '达喀尔', '達喀爾'] },
  { id: 'brussels', aliases: ['布鲁塞尔', 'Brussels', 'Bruxelles', 'Brussel', '布魯塞爾'] },
  { id: 'zurich', aliases: ['苏黎世', 'Zurich', 'Zürich', '蘇黎世'] },
  { id: 'dubrovnik', aliases: ['杜布罗夫尼克', 'Dubrovnik', '杜布羅夫尼克'] },
  { id: 'boston', aliases: ['波士顿', 'Boston', '波士頓'] },
  { id: 'seattle', aliases: ['西雅图', 'Seattle', '西雅圖'] },
  { id: 'panama-city', aliases: ['巴拿马城', 'Panama City', 'Ciudad de Panamá', '巴拿馬城'] },
  { id: 'la-paz', aliases: ['拉巴斯', 'La Paz', 'La Paz Bolivia'] },
  { id: 'johannesburg', aliases: ['约翰内斯堡', 'Johannesburg', 'Joburg', 'Jozi', '約翰內斯堡'] },
  { id: 'jakarta', aliases: ['雅加达', 'Jakarta', '雅加達'] },
  { id: 'taipei', aliases: ['台北', 'Taipei', '臺北', '台北市'] },
] as const

export type Landscape = 'city' | 'mountain' | 'coast' | 'countryside'
export function normalizeDestination(value: string) {
  return value.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase().replace(/[·・]/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Exact aliases only: a place such as Paris, Texas must not acquire French landmarks. */
export function destinationIllustration(city: string, landscape: Landscape = 'city') {
  const name = normalizeDestination(city)
  const match = CITY_ILLUSTRATIONS.find((entry) => entry.aliases.some((alias) => normalizeDestination(alias) === name))
  if (match) return `cities/${match.id}-v1`
  const landmark = LANDMARK_ILLUSTRATIONS.find((entry) => entry.aliases.some((alias) => normalizeDestination(alias) === name))
  return landmark ? `landmarks/${landmark.id}-v1` : `generic/${landscape}-v1`
}

export function themeLandscape(theme: ThemeId): Landscape {
  return theme === 'ocean' ? 'coast' : theme === 'forest' ? 'mountain' : 'city'
}
