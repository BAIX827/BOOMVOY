/** Returns Boomi speech. zh/default: ends in exactly one closing 喵; en: no 喵 tic. Idempotent. */
export function boomiSay(value: string, locale?: 'zh' | 'en'): string
