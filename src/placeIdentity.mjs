function nameKey(name) {
  return name.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
}

// Explicit aliases avoid treating nearby but distinct landmarks as duplicates.
const PLACE_ALIASES = [
  ['明治神宫', '明治神宮', 'Meiji Jingu', 'Meiji Shrine', 'Meiji Jingu Shrine'],
  ['原宿 Takeshita', '竹下通', 'Takeshita Street', 'Takeshita Dori'],
  ['涩谷十字路口', '澀谷十字路口', 'Shibuya Crossing', 'Shibuya Scramble Crossing'],
  ['涩谷 Sky', '涩谷天空', 'Shibuya Sky'],
  ['涩谷 PARCO', 'Shibuya PARCO'],
  ['浅草寺', '淺草寺', 'Sensoji', 'Senso-ji', 'Senso-ji Temple', 'Sensoji Temple'],
  ['仲见世通', '仲見世通', 'Nakamise Street', 'Nakamise Shopping Street', 'Nakamise Dori'],
  ['上野公园', '上野公園', 'Ueno Park'],
  ['Ameyoko 吃喝', '阿美横丁', '阿美橫丁', 'Ameyoko', 'Ameyoko Shopping Street'],
  ['东京国立博物馆', '東京國立博物館', 'Tokyo National Museum'],
  ['国立科学博物馆', '國立科學博物館', 'National Museum of Nature and Science'],
  ['国立西洋美术馆', '國立西洋美術館', 'National Museum of Western Art'],
  ['伏见稻荷大社', '伏見稻荷大社', 'Fushimi Inari', 'Fushimi Inari Taisha', 'Fushimi Inari Shrine'],
  ['清水寺', 'Kiyomizu-dera', 'Kiyomizu-dera Temple', 'Kiyomizu Temple'],
  ['二年坂 / 三年坂', '二年坂三年坂', 'Ninenzaka and Sannenzaka'],
  ['祇园', '祇園', 'Gion'],
  ['京都铁道博物馆', '京都鐵道博物館', 'Kyoto Railway Museum'],
  ['京都水族馆', '京都水族館', 'Kyoto Aquarium'],
  ['龙谷博物馆', '龍谷博物館', 'Ryukoku Museum'],
  ['锦市场', '錦市場', 'Nishiki Market'],
  ['京都国立博物馆', '京都國立博物館', 'Kyoto National Museum'],
  ['岚山竹林', '嵐山竹林', 'Arashiyama Bamboo Grove', 'Arashiyama Bamboo Forest'],
  ['天龙寺', '天龍寺', 'Tenryu-ji', 'Tenryuji Temple'],
  ['渡月桥', '渡月橋', 'Togetsukyo Bridge'],
  ['金阁寺', '金閣寺', 'Kinkaku-ji', 'Kinkakuji', 'Golden Pavilion'],
  ['大阪城', 'Osaka Castle'],
  ['道顿堀', '道頓堀', 'Dotonbori'],
  ['心斋桥', '心齋橋', 'Shinsaibashi', 'Shinsaibashi-suji Shopping Street'],
  ['黑门市场', '黑門市場', 'Kuromon Market', 'Kuromon Ichiba Market'],
  ['海游馆', '海遊館', 'Osaka Aquarium', 'Osaka Aquarium Kaiyukan', 'Kaiyukan'],
  ['大阪市立科学馆', '大阪市立科學館', 'Osaka Science Museum'],
  ['大阪中之岛美术馆', '大阪中之島美術館', 'Nakanoshima Museum of Art, Osaka'],
  ['国立国际美术馆', '國立國際美術館', 'National Museum of Art, Osaka'],
  ['忍野八海', 'Oshino Hakkai'],
  ['大石公园', '大石公園', 'Oishi Park'],
  ['富士山全景缆车', '富士山全景纜車', 'Mt. Fuji Panoramic Ropeway', 'Mt Fuji Panoramic Ropeway'],
  ['久保田一竹美术馆', '久保田一竹美術館', 'Itchiku Kubota Art Museum'],
  ['河口湖音乐森林美术馆', '河口湖音樂森林美術館', 'Kawaguchiko Music Forest Museum'],
  ['Echo Beach 日落', 'Echo Beach'],
]
const aliases = new Map(PLACE_ALIASES.flatMap((names) => names.map((name) => [nameKey(name), nameKey(names[0])])))

export function normalizePlaceName(name) {
  const key = nameKey(name)
  return aliases.get(key) || key
}
