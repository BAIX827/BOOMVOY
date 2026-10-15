/**
 * Format Boomi's own speech consistently in both the browser and server.
 * Chinese UI: exactly one closing 喵. English UI (locale 'en'): no Chinese tic;
 * a stray trailing 喵 is removed so English stays monolingual.
 * Without a locale, Han text gets "，喵" and other text gets " 喵" (legacy behaviour).
 */
export function boomiSay(value, locale) {
  let text = String(value ?? '').trim()
  const english = locale === 'en'
  if (!text) return english ? '' : ''

  // Only remove a closing verbal tic. Mentions of 喵 inside the message stay intact.
  text = text.replace(/喵[喵。.!！?？~～…，,、\s]*$/u, '').replace(/[，,、\s]+$/u, '')
  if (english) return text || 'Meow!'
  if (!text) return '喵'

  if (/\p{Script=Han}/u.test(text)) {
    text = text.replace(/[。，,！!？?；;：:～~…、.\s]+$/u, '')
    return text ? `${text}，喵` : '喵'
  }

  // English sentence punctuation remains readable; emojis and inner newlines survive.
  text = text.replace(/[，,\s]+$/u, '')
  return text ? `${text} 喵` : '喵'
}
