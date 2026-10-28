const DIGITS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九']

/** 0–99 as Mandarin hanzi (12 → 十二, 20 → 二十), for speaking math answers */
export function numberToChinese(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 99) return String(n)
  if (n < 10) return DIGITS[n]
  const tens = Math.floor(n / 10)
  const ones = n % 10
  return `${tens === 1 ? '' : DIGITS[tens]}十${ones === 0 ? '' : DIGITS[ones]}`
}
