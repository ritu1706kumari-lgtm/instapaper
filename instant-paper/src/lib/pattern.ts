import type { BookSettings, PatternRow, PatternType, Section } from '../types'
import { uid } from './id'

export const TYPE_INFO: Record<PatternType, { label: string; short: string; marks: number; en: string; hi: string; section: Section['type'] }> = {
  mcq: { label: 'Multiple choice (MCQ)', short: 'MCQ', marks: 1, en: 'Choose the correct option:', hi: 'सही विकल्प चुनिए:', section: 'mcq' },
  fill: { label: 'Fill in the blanks', short: 'Fill-ups', marks: 1, en: 'Fill in the blanks:', hi: 'रिक्त स्थान भरिए:', section: 'fill' },
  truefalse: { label: 'True / False', short: 'True/False', marks: 1, en: 'Write True or False:', hi: 'सही या गलत लिखिए:', section: 'truefalse' },
  match: { label: 'Match the following', short: 'Match', marks: 1, en: 'Match the following:', hi: 'सही मिलान कीजिए:', section: 'match' },
  oneword: { label: 'One word / very short answer', short: 'One word', marks: 1, en: 'Answer in one word or one line:', hi: 'एक शब्द में उत्तर दीजिए:', section: 'list' },
  short: { label: 'Short answer', short: 'Short', marks: 2, en: 'Answer the following questions in brief:', hi: 'संक्षेप में उत्तर दीजिए:', section: 'list' },
  long: { label: 'Long answer', short: 'Long', marks: 5, en: 'Answer the following questions in detail:', hi: 'विस्तार से उत्तर दीजिए:', section: 'long' },
}

const row = (type: PatternType, count: number, marks: number): PatternRow => ({ id: uid(), type, count, marks })

export const PRESETS: { name: string; rows: () => PatternRow[] }[] = [
  { name: 'Class test · 20', rows: () => [row('mcq', 5, 1), row('fill', 5, 1), row('short', 5, 2)] },
  { name: 'Unit test · 25', rows: () => [row('mcq', 5, 1), row('fill', 5, 1), row('truefalse', 5, 1), row('short', 5, 2)] },
  { name: 'Primary · 50', rows: () => [row('mcq', 5, 1), row('fill', 10, 1), row('oneword', 8, 2.5), row('match', 5, 1), row('short', 5, 2)] },
  { name: 'Half-yearly · 80', rows: () => [row('mcq', 20, 1), row('short', 5, 2), row('short', 6, 3), row('long', 4, 5), row('long', 3, 4)] },
]

export const defaultBook = (): BookSettings => ({ pattern: PRESETS[0].rows(), difficulty: 'mixed', source: 'mixed', language: 'same', chapters: '' })

export const patternTotal = (p: PatternRow[]) => p.reduce((n, r) => n + (r.count || 0) * (r.marks || 0), 0)

export const fmtMark = (n: number) => (Number.isInteger(n) ? String(n) : Math.abs((n % 1) - 0.5) < 1e-9 ? `${Math.floor(n) || ''}½` : String(+n.toFixed(2)))
export const rowMarks = (r: PatternRow) => `${fmtMark(r.marks)} × ${r.count} = ${fmtMark(r.marks * r.count)}`

/** Make the AI's sections match the chosen pattern exactly (order, type, count, marks). */
export function enforcePattern(sections: Section[], pattern: PatternRow[], hindi: boolean): { sections: Section[]; short: string[] } {
  const short: string[] = []
  const used = new Set<number>()
  const out = pattern.map((r, i) => {
    const info = TYPE_INFO[r.type]
    // Prefer the first unused AI section of the same type; otherwise the one at the same position.
    let k = sections.findIndex((x, j) => !used.has(j) && x.type === info.section)
    if (k === -1 && i < sections.length && !used.has(i)) k = i
    if (k !== -1) used.add(k)
    const ai = k !== -1 ? sections[k] : ({ id: uid(), title: '', marks: '', type: info.section, questions: [] } as Section)
    const base: Section = { ...ai, id: ai.id || uid(), type: info.section, marks: rowMarks(r), title: ai.title || (hindi ? info.hi : info.en) }
    if (r.type === 'match') {
      const pairs = (ai.pairs?.length ? ai.pairs : ai.questions.map((q) => ({ id: uid(), left: q.text, right: '' }))).slice(0, r.count)
      if (pairs.length < r.count) short.push(`${info.short}: ${pairs.length} of ${r.count}`)
      return { ...base, questions: [], pairs }
    }
    let questions = ai.questions.slice(0, r.count)
    if (r.type === 'mcq') questions = questions.map((q) => ({ ...q, options: q.options?.length ? q.options : ['', '', '', ''] }))
    else questions = questions.map((q) => ({ ...q, options: undefined }))
    if (questions.length < r.count) short.push(`${info.short}: ${questions.length} of ${r.count}`)
    return { ...base, questions, pairs: undefined }
  })
  return { sections: out, short }
}
