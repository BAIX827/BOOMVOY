/** Format Boomi's own speech consistently in both the browser and server. */
export function boomiSay(value) {
  let text = value.trim()
  if (!text) return ''

  // Only remove a closing verbal tic. Mentions of 喵 inside the message stay intact.
  text = text.replace(/喵[喵。.!！?？~～…，,、\s]*$/u, '').replace(/[，,、\s]+$/u, '')
  if (!text) return '喵'

  if (/\p{Script=Han}/u.test(text)) {
    text = text.replace(/[。，,！!？?；;：:～~…、.\s]+$/u, '')
    return text ? `${text}，喵` : '喵'
  }

  // English sentence punctuation remains readable; emojis and inner newlines survive.
  text = text.replace(/[，,\s]+$/u, '')
  return text ? `${text} 喵` : '喵'
}
