import type { DecisionCandidate } from './decisionTypes'

// Manually checked official sources; this catalogue has no live quotes or review scores.
// `seaView: 'room'` means a sea-view room category exists. The selected dates,
// room category, total price, and availability still need confirmation with the property.
export const DECISION_CATALOG: DecisionCandidate[] = [
  {
    id: 'curated-hacienda-tokyo', kind: 'restaurant',
    name: 'Hacienda del cielo MODERN MEXICANO', city: 'Tokyo',
    address: '10-1 Sarugakucho, Mansard Daikanyama 9F, Shibuya, Tokyo',
    source: 'curated', checkedAt: '2026-09-07', cuisines: ['mexican'],
    // Official Concept / Access sections and the venue-specific RESERVATION link.
    sourceUrl: 'https://www.huge.co.jp/service/restaurant/modern_mexicano/hacienda/',
    websiteUrl: 'https://www.huge.co.jp/service/restaurant/modern_mexicano/hacienda/',
    bookingUrl: 'https://thehugeclub.com/restaurant/hacienda-daikanyama/reserve',
    reservable: true,
  },
  {
    id: 'curated-el-caliente-tokyo', kind: 'restaurant',
    name: 'el caliente modern mexicano', city: 'Tokyo',
    address: '2-18-1 Konan, Atre Shinagawa 4F, Minato, Tokyo',
    source: 'curated', checkedAt: '2026-09-07', cuisines: ['mexican'],
    sourceUrl: 'https://www.huge.co.jp/service/restaurant/modern_mexicano/el_caliente/',
    websiteUrl: 'https://www.huge.co.jp/service/restaurant/modern_mexicano/el_caliente/',
    bookingUrl: 'https://thehugeclub.com/restaurant/caliente-shinagawa/reserve',
    reservable: true,
  },
  {
    id: 'curated-nabucco-tokyo', kind: 'restaurant',
    name: 'cucina del NABUCCO', city: 'Tokyo',
    address: '2-4-12 Ginza, MIKIMOTO Ginza2 7F, Chuo, Tokyo',
    source: 'curated', checkedAt: '2026-09-07', cuisines: ['italian'],
    sourceUrl: 'https://www.huge.co.jp/service/restaurant/italian/nabucco/',
    websiteUrl: 'https://www.huge.co.jp/service/restaurant/italian/nabucco/',
    // The Japanese official page links to this venue (the English header linked another venue).
    bookingUrl: 'https://thehugeclub.com/restaurant/nabucco-ginza/reserve',
    reservable: true,
  },
  {
    id: 'curated-sushi-gonpachi-tokyo', kind: 'restaurant',
    name: 'Sushi Gonpachi Nishi-Azabu', city: 'Tokyo',
    address: '1-13-11 Nishi-Azabu 3F, Minato, Tokyo',
    source: 'curated', checkedAt: '2026-09-07', cuisines: ['japanese'],
    // Official MORE INFO states 駐車場 – 有り; no free-parking claim is made.
    parking: 'available',
    sourceUrl: 'https://gonpachi.jp/sushi-nishi-azabu/',
    websiteUrl: 'https://gonpachi.jp/sushi-nishi-azabu/',
    bookingUrl: 'https://yoyaku.toreta.in/sushi-gonpachi-nishiazabu?stamp=HP/',
    reservable: true,
  },
  {
    id: 'curated-mamasita-melbourne', kind: 'restaurant',
    name: 'Mamasita', city: 'Melbourne',
    address: 'Upstairs, 11 Collins Street, Melbourne VIC 3000',
    source: 'curated', checkedAt: '2026-09-07', cuisines: ['mexican'],
    // Official introduction identifies modern Mexican food; Book links to SevenRooms.
    sourceUrl: 'https://www.mamasita.com.au/',
    websiteUrl: 'https://www.mamasita.com.au/',
    bookingUrl: 'https://www.sevenrooms.com/explore/mamasita/reservations/create/search',
    reservable: true,
  },
  {
    id: 'curated-doc-osteria-melbourne', kind: 'restaurant',
    name: 'DOC Osteria & Pasta Bar', city: 'Melbourne',
    address: '326-328 Lygon Street, Carlton, Melbourne',
    source: 'curated', checkedAt: '2026-09-07', cuisines: ['italian'],
    // Official Italian-dining page contains the venue's RESERVE entry point.
    sourceUrl: 'https://docgroup.net/doc-osteria/',
    websiteUrl: 'https://docgroup.net/doc-osteria/',
    bookingUrl: 'https://docgroup.net/doc-osteria/',
    reservable: true,
  },
  {
    id: 'curated-motel-mexicola-canggu', kind: 'restaurant',
    name: 'Motel Mexicola Canggu', city: 'Canggu',
    address: 'Jl. Pantai Batu Bolong No.117X, Canggu, Bali',
    source: 'curated', checkedAt: '2026-09-07', cuisines: ['mexican'],
    // Venue menu identifies Mexican dishes; booking page lets users select Canggu.
    sourceUrl: 'https://motelmexicola.info/canggu/',
    websiteUrl: 'https://motelmexicola.info/canggu/',
    bookingUrl: 'https://motelmexicola.info/book/',
    reservable: true,
  },
  {
    id: 'curated-holiday-inn-canggu', kind: 'hotel',
    name: 'Holiday Inn Resort Bali Canggu', city: 'Canggu',
    address: 'Jalan Pantai Batu Bolong A. No.93XX, Canggu, Bali',
    source: 'curated', checkedAt: '2026-09-07',
    // Official introduction describes ocean-view balcony rooms; parking FAQ states
    // complimentary parking for registered hotel guests. View Prices / Book Now is on this page.
    seaView: 'room', parking: 'free',
    sourceUrl: 'https://www.ihg.com/holidayinnresorts/hotels/us/en/bali/dpsba/hoteldetail',
    websiteUrl: 'https://www.ihg.com/holidayinnresorts/hotels/us/en/bali/dpsba/hoteldetail',
    bookingUrl: 'https://www.ihg.com/holidayinnresorts/hotels/us/en/bali/dpsba/hoteldetail',
    reservable: true,
  },
  {
    id: 'curated-como-uma-canggu', kind: 'hotel',
    name: 'COMO Uma Canggu', city: 'Canggu',
    address: 'Jalan Pantai Batu Mejan, Echo Beach, Canggu, Bali',
    source: 'curated', checkedAt: '2026-09-07',
    // Official One-bedroom Seaview Residence page includes sea-view description
    // and booking form. Official facilities pages did not verify parking; leave it unknown.
    seaView: 'room',
    sourceUrl: 'https://www.comohotels.com/bali/como-uma-canggu/accommodation/one-bedroom-seaview-residence',
    websiteUrl: 'https://www.comohotels.com/bali/como-uma-canggu',
    bookingUrl: 'https://www.comohotels.com/bali/como-uma-canggu/accommodation/one-bedroom-seaview-residence',
    reservable: true,
  },
  {
    id: 'curated-hilton-odaiba-tokyo', kind: 'hotel',
    name: 'Hilton Tokyo Odaiba', city: 'Tokyo',
    address: '1-9-1 Daiba, Minato, Tokyo',
    source: 'curated', checkedAt: '2026-09-07',
    // global.hiltonodaiba.jp/ documents Tokyo Bay view suites/executive rooms.
    // Hilton's official hotel-info page confirms paid on-site parking.
    seaView: 'room', parking: 'paid',
    sourceUrl: 'https://www.hilton.com/en/hotels/tyotohi-hilton-tokyo-odaiba/',
    websiteUrl: 'https://www.hilton.com/en/hotels/tyotohi-hilton-tokyo-odaiba/',
    bookingUrl: 'https://www.hilton.com/en/hotels/tyotohi-hilton-tokyo-odaiba/rooms/',
    reservable: true,
  },
]
