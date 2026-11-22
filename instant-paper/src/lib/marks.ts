import type { Section } from '../types'

const FRACTIONS: Record<string, number> = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3 }

function parseNum(s: string): number | null {
  const m = s.trim().match(/(\d+(?:\.\d+)?)?\s*([½¼¾⅓⅔])?/)
  if (!m || (!m[1] && !m[2])) return null
  return (m[1] ? parseFloat(m[1]) : 0) + (m[2] ? FRACTIONS[m[2]] : 0)
}

/** Turns "5", "(10)", "2½ × 8 = 20", "1x5=5", "4 marks" into a number. */
export function parseMarks(raw: string | undefined): number | null {
  if (!raw) return null
  const s = raw.replace(/[()]/g, '').replace(/marks?/i, '').trim()
  if (!s) return null
  if (s.includes('=')) return parseNum(s.split('=').pop()!)
  const mult = s.split(/[×xX*]/)
  if (mult.length === 2) {
    const a = parseNum(mult[0]); const b = parseNum(mult[1])
    if (a != null && b != null) return a * b
  }
  return parseNum(s)
}

export function sectionTotal(s: Section): number | null {
  const own = parseMarks(s.marks)
  if (own != null) return own
  const per = s.questions.map((q) => parseMarks(q.marks))
  if (per.length && per.every((x) => x != null)) return per.reduce((a, b) => a! + b!, 0)!
  return null
}

export function paperTotal(sections: Section[]): number {
  return sections.reduce((sum, s) => sum + (sectionTotal(s) ?? 0), 0)
}

export const fmt = (n: number) => {
  const whole = Math.floor(n); const frac = n - whole
  const f = Math.abs(frac - 0.5) < 1e-6 ? '½' : Math.abs(frac - 0.25) < 1e-6 ? '¼' : Math.abs(frac - 0.75) < 1e-6 ? '¾' : frac ? String(+frac.toFixed(2)).slice(1) : ''
  return `${whole || (f ? '' : 0)}${f}`
}
