import type { BookSettings, PatternRow, PatternType, Section, SubjectKind } from '../types'
import { uid } from './id'

interface TypeInfo { label: string; hi: string; short: string; marks: number; titleEn: string; titleHi: string; section: Section['type']; passage?: boolean }

export const TYPE_INFO: Record<PatternType, TypeInfo> = {
  mcq: { label: 'Multiple choice (MCQ)', hi: 'बहुविकल्पीय', short: 'MCQ', marks: 1, titleEn: 'Choose the correct option:', titleHi: 'सही विकल्प चुनिए:', section: 'mcq' },
  fill: { label: 'Fill in the blanks', hi: 'रिक्त स्थान', short: 'Fill-ups', marks: 1, titleEn: 'Fill in the blanks:', titleHi: 'रिक्त स्थान भरिए:', section: 'fill' },
  truefalse: { label: 'True / False', hi: 'सही / गलत', short: 'True/False', marks: 1, titleEn: 'Write True or False:', titleHi: 'सही या गलत लिखिए:', section: 'truefalse' },
  match: { label: 'Match the following', hi: 'मिलान कीजिए', short: 'Match', marks: 1, titleEn: 'Match the following:', titleHi: 'सही मिलान कीजिए:', section: 'match' },
  oneword: { label: 'One word / very short', hi: 'एक शब्द में उत्तर', short: 'One word', marks: 1, titleEn: 'Answer in one word or one line:', titleHi: 'एक शब्द में उत्तर दीजिए:', section: 'list' },
  short: { label: 'Short answer', hi: 'लघु उत्तरीय', short: 'Short', marks: 2, titleEn: 'Answer the following questions in brief:', titleHi: 'संक्षेप में उत्तर दीजिए:', section: 'list' },
  long: { label: 'Long answer', hi: 'दीर्घ उत्तरीय', short: 'Long', marks: 5, titleEn: 'Answer the following questions in detail:', titleHi: 'विस्तार से उत्तर दीजिए:', section: 'long' },
  solve: { label: 'Solve / calculate (sums)', hi: 'हल कीजिए', short: 'Sums', marks: 2, titleEn: 'Solve the following:', titleHi: 'हल कीजिए:', section: 'list' },
  wordproblem: { label: 'Word problems', hi: 'शाब्दिक प्रश्न', short: 'Word problems', marks: 3, titleEn: 'Solve the following word problems:', titleHi: 'निम्नलिखित प्रश्नों को हल कीजिए:', section: 'list' },
  construct: { label: 'Construction / drawing', hi: 'रचना कीजिए', short: 'Construction', marks: 4, titleEn: 'Do as directed:', titleHi: 'निर्देशानुसार रचना कीजिए:', section: 'list' },
  prove: { label: 'Prove that', hi: 'सिद्ध कीजिए', short: 'Prove', marks: 3, titleEn: 'Prove the following:', titleHi: 'सिद्ध कीजिए:', section: 'list' },
  reason: { label: 'Give reasons', hi: 'कारण बताइए', short: 'Reasons', marks: 2, titleEn: 'Give reasons:', titleHi: 'कारण बताइए:', section: 'list' },
  diagram: { label: 'Draw & label diagram', hi: 'चित्र बनाइए', short: 'Diagrams', marks: 3, titleEn: 'Draw neat, labelled diagrams:', titleHi: 'स्वच्छ एवं नामांकित चित्र बनाइए:', section: 'list' },
  numerical: { label: 'Numericals', hi: 'आंकिक प्रश्न', short: 'Numericals', marks: 3, titleEn: 'Solve the following numericals:', titleHi: 'निम्नलिखित आंकिक प्रश्न हल कीजिए:', section: 'list' },
  assertion: { label: 'Assertion – Reason', hi: 'अभिकथन – कारण', short: 'A–R', marks: 1, titleEn: 'Read the Assertion (A) and Reason (R) and choose the correct option:', titleHi: 'अभिकथन और कारण पढ़कर सही विकल्प चुनिए:', section: 'mcq' },
  casebased: { label: 'Case-based (passage + questions)', hi: 'केस आधारित', short: 'Case study', marks: 1, titleEn: 'Read the case below and answer the questions:', titleHi: 'निम्नलिखित अनुच्छेद पढ़कर प्रश्नों के उत्तर दीजिए:', section: 'list', passage: true },
  comprehension: { label: 'Unseen passage (reading)', hi: 'अपठित गद्यांश', short: 'Passage', marks: 1, titleEn: 'Read the passage and answer the questions:', titleHi: 'गद्यांश पढ़कर प्रश्नों के उत्तर दीजिए:', section: 'list', passage: true },
  grammar: { label: 'Grammar', hi: 'व्याकरण', short: 'Grammar', marks: 1, titleEn: 'Do as directed:', titleHi: 'निर्देशानुसार उत्तर दीजिए:', section: 'list' },
  letter: { label: 'Letter / application', hi: 'पत्र लेखन', short: 'Letter', marks: 5, titleEn: 'Write a letter:', titleHi: 'पत्र लिखिए:', section: 'long' },
  essay: { label: 'Essay / paragraph', hi: 'निबंध / अनुच्छेद', short: 'Essay', marks: 5, titleEn: 'Write an essay / paragraph:', titleHi: 'निबंध / अनुच्छेद लिखिए:', section: 'long' },
  story: { label: 'Story writing', hi: 'कहानी लेखन', short: 'Story', marks: 5, titleEn: 'Write a story:', titleHi: 'कहानी लिखिए:', section: 'long' },
  map: { label: 'Map work', hi: 'मानचित्र कार्य', short: 'Map', marks: 1, titleEn: 'Map work:', titleHi: 'मानचित्र कार्य:', section: 'list' },
  source: { label: 'Source-based (passage + questions)', hi: 'स्रोत आधारित', short: 'Source', marks: 1, titleEn: 'Read the source and answer the questions:', titleHi: 'स्रोत पढ़कर प्रश्नों के उत्तर दीजिए:', section: 'list', passage: true },
}

const row = (type: PatternType, count: number, marks: number): PatternRow => ({ id: uid(), type, count, marks })
type Preset = { name: string; rows: () => PatternRow[] }

const GENERAL: Preset[] = [
  { name: 'Class test · 20', rows: () => [row('mcq', 5, 1), row('fill', 5, 1), row('short', 5, 2)] },
  { name: 'Unit test · 25', rows: () => [row('mcq', 5, 1), row('fill', 5, 1), row('truefalse', 5, 1), row('short', 5, 2)] },
  { name: 'Primary · 50', rows: () => [row('mcq', 5, 1), row('fill', 10, 1), row('oneword', 8, 2.5), row('match', 5, 1), row('short', 5, 2)] },
  { name: 'Half-yearly · 80', rows: () => [row('mcq', 20, 1), row('short', 5, 2), row('short', 6, 3), row('long', 4, 5), row('long', 3, 4)] },
]

export const SUBJECTS: Record<SubjectKind, { label: string; hi: string; emoji: string; types: PatternType[]; presets: Preset[]; language?: 'hi' }> = {
  maths: {
    label: 'Maths', hi: 'गणित', emoji: '➗',
    types: ['mcq', 'fill', 'truefalse', 'oneword', 'solve', 'wordproblem', 'construct', 'prove', 'short', 'long', 'casebased', 'assertion', 'match'],
    presets: [
      { name: 'Class test · 20', rows: () => [row('mcq', 5, 1), row('fill', 5, 1), row('solve', 5, 2)] },
      { name: 'Unit test · 40', rows: () => [row('mcq', 10, 1), row('solve', 5, 2), row('wordproblem', 4, 3), row('long', 2, 4)] },
      { name: 'Primary · 50', rows: () => [row('fill', 10, 1), row('truefalse', 5, 1), row('solve', 10, 2), row('wordproblem', 5, 3)] },
      { name: 'Half-yearly · 80', rows: () => [row('mcq', 20, 1), row('short', 6, 2), row('solve', 7, 3), row('wordproblem', 3, 5), row('casebased', 3, 4)] },
    ],
  },
  science: {
    label: 'Science', hi: 'विज्ञान', emoji: '🔬',
    types: ['mcq', 'fill', 'truefalse', 'match', 'oneword', 'reason', 'diagram', 'numerical', 'assertion', 'short', 'long', 'casebased'],
    presets: [
      { name: 'Class test · 20', rows: () => [row('mcq', 5, 1), row('fill', 5, 1), row('short', 5, 2)] },
      { name: 'Unit test · 40', rows: () => [row('mcq', 10, 1), row('reason', 5, 2), row('diagram', 2, 3), row('short', 4, 2), row('long', 2, 3)] },
      { name: 'Primary · 50', rows: () => [row('mcq', 5, 1), row('fill', 10, 1), row('truefalse', 5, 1), row('match', 5, 1), row('short', 5, 2), row('diagram', 1, 5), row('long', 2, 5)] },
      { name: 'Half-yearly · 80', rows: () => [row('mcq', 16, 1), row('assertion', 4, 1), row('short', 6, 2), row('short', 7, 3), row('long', 3, 5), row('casebased', 3, 4)] },
    ],
  },
  english: {
    label: 'English', hi: 'अंग्रेज़ी', emoji: '📖',
    types: ['comprehension', 'grammar', 'mcq', 'fill', 'match', 'oneword', 'short', 'long', 'letter', 'essay', 'story', 'truefalse'],
    presets: [
      { name: 'Class test · 20', rows: () => [row('comprehension', 5, 1), row('grammar', 5, 1), row('oneword', 5, 1), row('letter', 1, 5)] },
      { name: 'Unit test · 40', rows: () => [row('comprehension', 5, 1), row('grammar', 10, 1), row('short', 5, 2), row('long', 1, 5), row('essay', 1, 10)] },
      { name: 'Primary · 50', rows: () => [row('comprehension', 5, 1), row('grammar', 10, 1), row('fill', 5, 1), row('match', 5, 1), row('short', 5, 2), row('essay', 1, 5), row('story', 1, 10)] },
      { name: 'Half-yearly · 80', rows: () => [row('comprehension', 10, 1), row('grammar', 10, 1), row('letter', 1, 5), row('essay', 1, 10), row('short', 10, 2), row('long', 5, 5)] },
    ],
  },
  hindi: {
    label: 'Hindi', hi: 'हिंदी', emoji: 'अ', language: 'hi',
    types: ['comprehension', 'grammar', 'mcq', 'fill', 'match', 'oneword', 'short', 'long', 'letter', 'essay', 'story', 'truefalse'],
    presets: [
      { name: 'Class test · 20', rows: () => [row('comprehension', 5, 1), row('grammar', 5, 1), row('oneword', 5, 1), row('letter', 1, 5)] },
      { name: 'Unit test · 40', rows: () => [row('comprehension', 5, 1), row('grammar', 10, 1), row('short', 5, 2), row('letter', 1, 5), row('essay', 1, 10)] },
      { name: 'Primary · 50', rows: () => [row('comprehension', 5, 1), row('grammar', 10, 1), row('fill', 5, 1), row('match', 5, 1), row('short', 5, 2), row('essay', 1, 5), row('story', 1, 10)] },
      { name: 'Half-yearly · 80', rows: () => [row('comprehension', 10, 1), row('grammar', 10, 1), row('letter', 1, 5), row('essay', 1, 10), row('short', 10, 2), row('long', 5, 5)] },
    ],
  },
  sst: {
    label: 'Social Studies', hi: 'सामाजिक विज्ञान', emoji: '🌍',
    types: ['mcq', 'fill', 'truefalse', 'match', 'oneword', 'short', 'long', 'map', 'source', 'assertion', 'reason'],
    presets: [
      { name: 'Class test · 20', rows: () => [row('mcq', 5, 1), row('fill', 5, 1), row('short', 5, 2)] },
      { name: 'Unit test · 40', rows: () => [row('mcq', 10, 1), row('short', 5, 2), row('long', 2, 5), row('source', 3, 2), row('map', 4, 1)] },
      { name: 'Primary · 50', rows: () => [row('mcq', 5, 1), row('fill', 10, 1), row('truefalse', 5, 1), row('match', 5, 1), row('short', 5, 2), row('long', 2, 5), row('map', 5, 1)] },
      { name: 'Half-yearly · 80', rows: () => [row('mcq', 20, 1), row('short', 4, 2), row('short', 5, 3), row('long', 5, 5), row('source', 3, 4)] },
    ],
  },
  evs: {
    label: 'EVS', hi: 'पर्यावरण', emoji: '🌱',
    types: ['mcq', 'fill', 'truefalse', 'match', 'oneword', 'short', 'diagram', 'long'],
    presets: GENERAL,
  },
  computer: {
    label: 'Computer', hi: 'कंप्यूटर', emoji: '💻',
    types: ['mcq', 'fill', 'truefalse', 'match', 'oneword', 'short', 'long', 'diagram'],
    presets: GENERAL,
  },
  general: {
    label: 'Other', hi: 'अन्य', emoji: '📚',
    types: ['mcq', 'fill', 'truefalse', 'match', 'oneword', 'short', 'long'],
    presets: GENERAL,
  },
}

/** Guess the subject type from what the teacher typed in "Subject". */
export function detectSubject(text: string): SubjectKind | null {
  const t = text.toLowerCase()
  if (!t.trim()) return null
  if (/math|गणित|arith|algebra|geometry/.test(t)) return 'maths'
  if (/hindi|हिंदी|हिन्दी/.test(t)) return 'hindi'
  if (/eng|अंग्रेज/.test(t)) return 'english'
  if (/evs|environment|पर्यावरण/.test(t)) return 'evs'
  if (/s\.?s\.?t|social|history|geograph|civics|political|economics|सामाजिक|इतिहास|भूगोल/.test(t)) return 'sst'
  if (/sci|physics|chemistry|biology|विज्ञान/.test(t)) return 'science'
  if (/comput|ict|it\b|कंप्यूटर/.test(t)) return 'computer'
  return 'general'
}

export const PRESETS = GENERAL

export const defaultBook = (subject: SubjectKind = 'general'): BookSettings => ({
  subject, pattern: SUBJECTS[subject].presets[0].rows(), difficulty: 'mixed', source: 'mixed', language: SUBJECTS[subject].language ?? 'same', chapters: '',
})

export const patternTotal = (p: PatternRow[]) => p.reduce((n, r) => n + (r.count || 0) * (r.marks || 0), 0)

export const fmtMark = (n: number) => (Number.isInteger(n) ? String(n) : Math.abs((n % 1) - 0.5) < 1e-9 ? `${Math.floor(n) || ''}½` : String(+n.toFixed(2)))
export const rowMarks = (r: PatternRow) => `${fmtMark(r.marks)} × ${r.count} = ${fmtMark(r.marks * r.count)}`

const AR_OPTIONS = ['Both A and R are true and R is the correct explanation of A', 'Both A and R are true but R is not the correct explanation of A', 'A is true but R is false', 'A is false but R is true']

/** Make the AI's sections match the chosen pattern exactly (order, type, count, marks). */
export function enforcePattern(sections: Section[], pattern: PatternRow[], hindi: boolean): { sections: Section[]; short: string[] } {
  const short: string[] = []
  const used = new Set<number>()
  const out = pattern.map((r, i) => {
    const info = TYPE_INFO[r.type]
    // Prefer the AI section at the same position if its type fits; else the first unused one of that type.
    let k = i < sections.length && !used.has(i) && sections[i].type === info.section ? i : sections.findIndex((x, j) => !used.has(j) && x.type === info.section)
    if (k === -1 && i < sections.length && !used.has(i)) k = i
    if (k !== -1) used.add(k)
    const ai = k !== -1 ? sections[k] : ({ id: uid(), title: '', marks: '', type: info.section, questions: [] } as Section)
    const base: Section = {
      ...ai, id: ai.id || uid(), type: info.section, marks: rowMarks(r),
      title: ai.title || (hindi ? info.titleHi : info.titleEn),
      passage: info.passage ? ai.passage || '' : undefined,
    }
    if (r.type === 'match') {
      const pairs = (ai.pairs?.length ? ai.pairs : ai.questions.map((q) => ({ id: uid(), left: q.text, right: '' }))).slice(0, r.count)
      if (pairs.length < r.count) short.push(`${info.short}: ${pairs.length} of ${r.count}`)
      return { ...base, questions: [], pairs }
    }
    let questions = ai.questions.slice(0, r.count)
    if (r.type === 'assertion') questions = questions.map((q) => ({ ...q, options: q.options?.length === 4 ? q.options : AR_OPTIONS }))
    else if (r.type === 'mcq') questions = questions.map((q) => ({ ...q, options: q.options?.length ? q.options : ['', '', '', ''] }))
    else questions = questions.map((q) => ({ ...q, options: undefined }))
    if (questions.length < r.count) short.push(`${info.short}: ${questions.length} of ${r.count}`)
    return { ...base, questions, pairs: undefined }
  })
  return { sections: out, short }
}
