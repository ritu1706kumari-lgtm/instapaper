/**
 * AI core shared by the browser and the server function (api/extract.ts).
 * No DOM APIs here — only fetch.
 */

/* ------------------------------------------------------------------ */
/*  Prompt + schema                                                    */
/* ------------------------------------------------------------------ */

const PROMPT = `You are an expert exam-paper typist for an Indian school.
The images are photos of ONE handwritten (or printed) question paper written by a teacher.
The photos may be in the WRONG order: use the heading (first page) and the question numbers to output everything in the correct order.
Transcribe it EXACTLY into JSON. Rules:

1. Do NOT translate, paraphrase, correct facts or add questions. Keep Hindi in Devanagari, English in English, mixed lines mixed.
   Fix only obvious spelling slips in English. Keep the teacher's wording.
2. header: school, exam (e.g. "Second Terminal Examination"), className (e.g. "1st", "VIII"), subject, time (e.g. "2 Hours"),
   maxMarks (number only, e.g. "50"), instructions (general instructions list, [] if none). Use "" when not written.
3. sections: one per main question / section, in order ("Que 1", "Q.2", "Section A", "प्रश्न 1" ...).
   - number: the main question / section number exactly as written, e.g. "6", "Q.6", "VI", "प्रश्न 6", "Section B". "" if none.
   - title: the instruction without the number, e.g. "Fill in the blanks:", "Tick (✓) the correct answer:", "रिक्त स्थान भरो:".
   - If a main question is ONE task with no sub-parts (e.g. "Write an essay on cow", "गाय पर निबंध लिखिए", "Write a letter to your
     friend"), put the whole text in title, type "long", and questions []. NEVER repeat the title as a sub-question.
     If it lists choices (e.g. "Write an essay on any one: (a) Cow (b) Diwali"), title = the instruction, questions = the choices.
   - marks: exactly as written, without brackets, e.g. "5", "2½ × 8 = 20", "1×5=5". "" if not written.
   - type: "mcq" when each question has options (a)(b)(c)(d); "match" for match the following; "fill" for blanks;
     "truefalse" for true/false or right/wrong; "long" for long-answer questions; otherwise "list".
   - questions: each sub-question WITHOUT its number. For blanks write ____ (4 underscores) where the line is.
     options: for MCQ only, the option texts without (a)/(b) labels.
     orText: if the question has an "OR" alternative, put the alternative here.
     marks: only if marks are written next to that single question, else "".
     needsDiagram: true if the question has a drawn figure, map, table image or picture.
   - pairs: for "match" sections, the left and right column items in the SAME order they are written (do not solve them).
   - passage: if the section has a reading passage, poem extract, case study or source text, put that text here; else "".
4. Mathematics: write maths in LaTeX between single dollar signs, e.g. $\\frac{3}{4}$, $x^2 + 5x$, $\\sqrt{49}$, $25^\\circ$, $\\times$, $\\div$.
   Chemistry formulas/equations: $\\ce{H2SO4}$, $\\ce{2H2 + O2 -> 2H2O}$. Plain words stay outside dollars.
5. Choices written inline like "bathing / sleeping" stay as they are.
Return ONLY the JSON.`

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    header: {
      type: 'OBJECT',
      properties: {
        school: { type: 'STRING' }, exam: { type: 'STRING' }, className: { type: 'STRING' }, subject: { type: 'STRING' },
        time: { type: 'STRING' }, maxMarks: { type: 'STRING' }, instructions: { type: 'ARRAY', items: { type: 'STRING' } },
      },
      required: ['school', 'exam', 'className', 'subject', 'time', 'maxMarks', 'instructions'],
    },
    sections: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          number: { type: 'STRING' },
          title: { type: 'STRING' },
          passage: { type: 'STRING' },
          marks: { type: 'STRING' },
          type: { type: 'STRING', enum: ['list', 'mcq', 'match', 'truefalse', 'fill', 'long'] },
          questions: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                text: { type: 'STRING' },
                options: { type: 'ARRAY', items: { type: 'STRING' } },
                orText: { type: 'STRING' },
                marks: { type: 'STRING' },
                needsDiagram: { type: 'BOOLEAN' },
              },
              required: ['text'],
            },
          },
          pairs: {
            type: 'ARRAY',
            items: { type: 'OBJECT', properties: { left: { type: 'STRING' }, right: { type: 'STRING' } }, required: ['left', 'right'] },
          },
        },
        required: ['title', 'marks', 'type', 'questions'],
      },
    },
  },
  required: ['header', 'sections'],
}

const JSON_SHAPE_HINT = `JSON shape:
{"header":{"school":"","exam":"","className":"","subject":"","time":"","maxMarks":"","instructions":[]},
 "sections":[{"number":"","title":"","passage":"","marks":"","type":"list|mcq|match|truefalse|fill|long",
   "questions":[{"text":"","options":[],"orText":"","marks":"","needsDiagram":false}],
   "pairs":[{"left":"","right":""}]}]}`

/* ------------------------------------------------------------------ */
/*  Errors                                                             */
/* ------------------------------------------------------------------ */

export type AIErrorKind = 'key' | 'quota' | 'model' | 'network' | 'parse' | 'request' | 'timeout' | 'other'
export class AIError extends Error {
  kind: AIErrorKind
  /** Model Google suggests instead, when it retires one. */
  suggested?: string
  constructor(message: string, kind: AIErrorKind, suggested?: string) {
    super(message)
    this.kind = kind
    this.suggested = suggested
  }
}


export type Progress = (msg: string) => void

/* ------------------------------------------------------------------ */
/*  Gemini                                                             */
/* ------------------------------------------------------------------ */

const GEMINI = 'https://generativelanguage.googleapis.com/v1beta'
/**
 * Fastest first: Flash-Lite models are built for low-latency data extraction (~350 tokens/s),
 * which is exactly "type out this paper". Full Flash models are the accuracy fallback.
 */
const FAST_GEMINI_MODELS = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-flash-lite-latest']
const FALLBACK_GEMINI_MODELS = ['gemini-3.8-flash', 'gemini-flash-latest']

let cachedModels: { key: string; list: string[] } | null = null

/** Ask Google which models this key can use and rank the Flash vision models (free-tier friendly) first. */
export async function listGeminiModels(key: string): Promise<string[]> {
  if (cachedModels?.key === key) return cachedModels.list
  const res = await fetch(`${GEMINI}/models?pageSize=200`, { headers: { 'x-goog-api-key': key } })
  if (!res.ok) throw await geminiError(res)
  const data = await res.json()
  const names: string[] = (data.models ?? [])
    .filter((m: { supportedGenerationMethods?: string[] }) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m: { name: string }) => m.name.replace(/^models\//, ''))
    .filter((n: string) => /gemini/.test(n) && !/(image|tts|live|audio|embedding|transcribe|omni|robotics|computer|aqa|veo|imagen)/.test(n))
  const ver = (n: string) => parseFloat(n.match(/gemini-(\d+(?:\.\d+)?)/)?.[1] ?? '0')
  const rank = (n: string) => {
    let r = 0
    if (/flash/.test(n)) r += 100
    if (/lite/.test(n)) r += 40 // fastest
    if (/pro/.test(n)) r -= 60 // Pro models have tiny or no free quota
    if (/preview|exp/.test(n)) r -= 20
    if (/latest/.test(n)) r += 5
    if (/-\d{3}$|-\d{2}-\d{4}$/.test(n)) r -= 10 // dated snapshots
    return r + ver(n)
  }
  const list = [...new Set(names)].sort((a, b) => rank(b) - rank(a))
  cachedModels = { key, list }
  return list
}

async function geminiError(res: Response): Promise<AIError> {
  let msg = ''
  try { msg = (await res.json())?.error?.message ?? '' } catch { /* ignore */ }
  const suggested = msg.match(/use (?:models\/)?(gemini-[\w.-]+)/i)?.[1]
  if (res.status === 400 && /api key/i.test(msg)) return new AIError('The Gemini API key is not valid.', 'key')
  if (res.status === 403) return new AIError('This Gemini API key is not allowed to use the API. Create a new key in Google AI Studio.', 'key')
  if (res.status === 429) return new AIError('Free daily/minute limit reached for this model.', 'quota')
  if (res.status === 404 || /no longer available|deprecated|retired|shut ?down/i.test(msg) || (res.status !== 400 && /not found|not supported/i.test(msg))) return new AIError(`Model unavailable: ${msg}`, 'model', suggested)
  if (res.status === 400) return new AIError(`Request format not accepted: ${msg}`, 'request')
  if (res.status >= 500) return new AIError('Google AI is busy right now.', 'quota')
  return new AIError(msg || `Gemini error ${res.status}`, 'other')
}

/** Same schema in standard (lowercase) JSON-Schema form, as newer models expect. */
function toJsonSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(toJsonSchema)
  if (node && typeof node === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(node)) out[k] = k === 'type' && typeof v === 'string' ? v.toLowerCase() : toJsonSchema(v)
    return out
  }
  return node
}
const JSON_SCHEMA = toJsonSchema(SCHEMA)

/**
 * Request styles, newest first. If a model rejects one (400), we try the next:
 *  0 = JSON-Schema structured output, 1 = classic responseSchema, 2 = JSON mode only, 3 = plain prompt.
 */
function generationConfig(style: number) {
  switch (style) {
    case 0: return { responseMimeType: 'application/json', responseJsonSchema: JSON_SCHEMA }
    case 1: return { responseMimeType: 'application/json', responseSchema: SCHEMA }
    case 2: return { responseMimeType: 'application/json' }
    default: return undefined
  }
}

async function withTimeout<T>(ms: number, fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fn(ctrl.signal)
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw new AIError('The AI took too long to answer.', 'timeout')
    throw e
  } finally {
    clearTimeout(t)
  }
}

/** A model + request style that is known to work, remembered to skip trial-and-error next time. */
export interface GeminiSetup { model: string; style: number; thinking: string | null }
const THINKING = ['minimal', 'low', null] as const

export async function geminiCall(key: string, setup: GeminiSetup, images: string[], timeoutMs = 100_000, note = '', prompt = PROMPT, texts: string[] = []): Promise<unknown> {
  const parts: object[] = [{ text: (setup.style >= 2 ? `${prompt}\n\n${JSON_SHAPE_HINT}` : prompt) + (note ? `\n\n${note}` : '') }]
  images.forEach((d, i) => {
    const [meta, data] = d.split(',')
    if (images.length > 1) parts.push({ text: `Page ${i + 1}:` })
    parts.push({ inline_data: { mime_type: meta.match(/data:(.*?);/)?.[1] ?? 'image/jpeg', data } })
  })
  texts.forEach((t, i) => parts.push({ text: `Word document ${i + 1} (text):\n-----\n${t}\n-----` }))
  // Copy-typing needs no deep reasoning: keep "thinking" minimal for speed.
  const gc = { ...(generationConfig(setup.style) ?? {}), ...(setup.thinking ? { thinkingConfig: { thinkingLevel: setup.thinking } } : {}) }
  return withTimeout(timeoutMs, async (signal) => {
    const res = await fetch(`${GEMINI}/models/${setup.model}:generateContent`, {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ contents: [{ role: 'user', parts }], ...(Object.keys(gc).length ? { generationConfig: gc } : {}) }),
    })
    if (!res.ok) throw await geminiError(res)
    const data = await res.json()
    const text: string = (data.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string; thought?: boolean }) => (p.thought ? '' : p.text ?? '')).join('')
    if (!text) {
      const reason = data.promptFeedback?.blockReason || data.candidates?.[0]?.finishReason
      throw new AIError(`The AI returned no text${reason ? ` (${reason})` : ''}. Try clearer photos.`, 'parse')
    }
    return parseJson(text)
  })
}

/* ------------------------------------------------------------------ */
/*  Groq (OpenAI-compatible) fallback                                  */
/* ------------------------------------------------------------------ */

export async function groqCall(key: string, model: string, images: string[], prompt = PROMPT, texts: string[] = []): Promise<unknown> {
  if (images.length > 5) throw new AIError('Groq can read at most 5 photos per paper.', 'other')
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    signal: AbortSignal.timeout(90_000),
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [{
        role: 'user',
        content: [{ type: 'text', text: `${prompt}\n\n${JSON_SHAPE_HINT}${texts.map((t, i) => `\n\nWord document ${i + 1} (text):\n${t}`).join('')}` }, ...images.map((url) => ({ type: 'image_url', image_url: { url } }))],
      }],
    }),
  })
  if (!res.ok) {
    let msg = ''
    try { msg = (await res.json())?.error?.message ?? '' } catch { /* ignore */ }
    if (res.status === 401) throw new AIError('Your Groq API key is not valid. Please check it in Settings.', 'key')
    if (res.status === 429) throw new AIError('Groq free limit reached. Try again in a minute.', 'quota')
    if (res.status === 404) throw new AIError(`Groq model unavailable: ${msg}`, 'model')
    throw new AIError(msg || `Groq error ${res.status}`, 'other')
  }
  const data = await res.json()
  return parseJson(data.choices?.[0]?.message?.content ?? '')
}

/* ------------------------------------------------------------------ */
/*  Paper from book chapters                                           */
/* ------------------------------------------------------------------ */

export type PatternType =
  | 'mcq' | 'fill' | 'truefalse' | 'match' | 'oneword' | 'short' | 'long'
  | 'solve' | 'wordproblem' | 'construct' | 'prove'
  | 'reason' | 'diagram' | 'numerical' | 'assertion' | 'casebased'
  | 'comprehension' | 'grammar' | 'letter' | 'essay' | 'story'
  | 'map' | 'source'
export interface PatternRow { type: PatternType; count: number; marks: number }
export interface BookRequest {
  pattern: PatternRow[]
  difficulty: 'easy' | 'mixed' | 'hard'
  source: 'book' | 'mixed' | 'new'
  language: 'same' | 'en' | 'hi'
  className: string
  subject: string
  chapters: string
  /** Random number so "New questions" gives a different selection. */
  variation: number
}

const AR_OPTIONS = '["Both A and R are true and R is the correct explanation of A", "Both A and R are true but R is not the correct explanation of A", "A is true but R is false", "A is false but R is true"]'

/** What each question type means for the AI (the server only accepts these). */
export const PATTERN_TYPES: Record<PatternType, { ai: string }> = {
  mcq: { ai: 'multiple-choice questions, each with exactly 4 options and one correct answer (type "mcq")' },
  fill: { ai: 'fill-in-the-blank sentences, each with one blank written as ____ (type "fill")' },
  truefalse: { ai: 'true-or-false statements, a mix of true and false ones (type "truefalse")' },
  match: { ai: 'match-the-following pairs; give exactly that many pairs in "pairs", with the right column jumbled so it does NOT line up with the left (type "match", questions [])' },
  oneword: { ai: 'very-short-answer questions answerable in one word or one line (type "list")' },
  short: { ai: 'short-answer questions needing 2–4 lines (type "list")' },
  long: { ai: 'long-answer questions needing a detailed answer (type "long")' },
  solve: { ai: 'calculation sums to solve (numbers, fractions, equations, expressions — whatever these pages teach), maths in LaTeX (type "list")' },
  wordproblem: { ai: 'word problems (short real-life story sums) that need working, based on these pages (type "list")' },
  construct: { ai: 'construction / drawing questions, e.g. "Construct a triangle…", "Draw a line segment of 6 cm…" (type "list")' },
  prove: { ai: '"Prove that / Show that" questions (type "list")' },
  reason: { ai: '"Give reasons" questions, each a statement asking why (type "list")' },
  diagram: { ai: 'questions asking the student to draw and/or label a diagram from the chapter (type "list")' },
  numerical: { ai: 'numerical problems with given values and units to calculate (type "list")' },
  assertion: { ai: `Assertion–Reason questions: text = "Assertion (A): … Reason (R): …" and options exactly ${AR_OPTIONS} (type "mcq")` },
  casebased: { ai: 'ONE case-study passage (4–8 sentences, based on the chapter) written in the section\'s "passage" field, followed by exactly that many questions about it (type "list")' },
  comprehension: { ai: 'ONE unseen reading passage (120–200 words, age-appropriate, theme related to the chapter) written in the section\'s "passage" field, followed by exactly that many questions about it (type "list")' },
  grammar: { ai: 'grammar items on the grammar taught in these pages (e.g. tenses, parts of speech, articles; for Hindi संधि, समास, मुहावरे, पर्यायवाची) — one item each with a clear instruction (type "list")' },
  letter: { ai: 'letter / application writing tasks, each giving the situation and who to write to (type "long")' },
  essay: { ai: 'essay / paragraph writing tasks; each gives a topic (related to the chapter or the student\'s life) and a word limit (type "long")' },
  story: { ai: 'story-writing tasks, each with an outline, hints or a beginning (type "long")' },
  map: { ai: 'map-work questions, e.g. "On an outline map of India, locate and label…" (type "list")' },
  source: { ai: 'ONE source passage (from or based on the chapter) written in the section\'s "passage" field, followed by exactly that many questions about it (type "list")' },
}

export const fmtMark = (n: number) => (Number.isInteger(n) ? String(n) : n % 1 === 0.5 ? `${Math.floor(n) || ''}½` : String(n))
export const rowMarks = (r: PatternRow) => `${fmtMark(r.marks)} × ${r.count} = ${fmtMark(r.marks * r.count)}`

export function validBook(x: unknown): BookRequest | null {
  const b = x as BookRequest
  if (!b || !Array.isArray(b.pattern) || !b.pattern.length || b.pattern.length > 15) return null
  const pattern = b.pattern.map((r) => ({ type: r?.type, count: Math.round(Number(r?.count)), marks: Number(r?.marks) }))
  if (pattern.some((r) => !(r.type in PATTERN_TYPES) || !(r.count >= 1 && r.count <= 40) || !(r.marks > 0 && r.marks <= 20))) return null
  const str = (v: unknown, n = 120) => String(v ?? '').slice(0, n)
  return {
    pattern: pattern as PatternRow[],
    difficulty: ['easy', 'mixed', 'hard'].includes(b.difficulty) ? b.difficulty : 'mixed',
    source: ['book', 'mixed', 'new'].includes(b.source) ? b.source : 'mixed',
    language: ['same', 'en', 'hi'].includes(b.language) ? b.language : 'same',
    className: str(b.className, 30), subject: str(b.subject, 60), chapters: str(b.chapters, 300),
    variation: Math.abs(Math.round(Number(b.variation) || 0)) % 1_000_000,
  }
}

export function bookPrompt(b: BookRequest): string {
  const total = b.pattern.reduce((n, r) => n + r.count * r.marks, 0)
  const PASSAGE = ['casebased', 'comprehension', 'source']
  const sections = b.pattern.map((r, i) => PASSAGE.includes(r.type)
    ? `  Section ${i + 1}: ${PATTERN_TYPES[r.type].ai.replace('exactly that many', `exactly ${r.count}`)}. marks = "${rowMarks(r)}".`
    : `  Section ${i + 1}: exactly ${r.count} ${PATTERN_TYPES[r.type].ai}. marks = "${rowMarks(r)}".`).join('\n')
  const source = {
    book: 'Use ONLY questions printed in the exercises / questions of these pages. You may convert a book question into the requested type (e.g. turn a fact into a fill-in-the-blank) but do not invent new topics.',
    mixed: 'Prefer questions printed in the book exercises. If there are not enough of a type, write new ones based ONLY on the content of these pages.',
    new: 'Write fresh questions based ONLY on the content of these pages (do not just copy the book exercises).',
  }[b.source]
  const lang = { same: 'Write in the same language as the book pages (Hindi books → Hindi in Devanagari, English books → English).', en: 'Write the whole paper in English.', hi: 'Write the whole paper in Hindi (Devanagari script).' }[b.language]
  const diff = { easy: 'Keep questions easy and direct.', mixed: 'Mix difficulty: about 40% easy, 40% moderate, 20% challenging.', hard: 'Make questions moderately difficult to challenging, testing understanding, not just recall.' }[b.difficulty]
  return `You are an experienced Indian school teacher setting an exam question paper.
The images are pages from a school textbook (chapter content and/or exercises)${b.className ? ` for Class ${b.className}` : ''}${b.subject ? `, subject ${b.subject}` : ''}${b.chapters ? `, chapter(s): ${b.chapters}` : ''}.

Create a question paper that follows EXACTLY this pattern, in this order (one section per line, nothing else):
${sections}
Total marks = ${fmtMark(total)}.

Rules:
1. ${source}
2. Every question must be answerable from these pages. Spread questions across all the pages/topics; never repeat a question or ask the same fact twice.
3. ${diff}
4. ${lang} Section titles are short instructions in the same language, e.g. "Choose the correct option:", "Fill in the blanks:", "सही विकल्प चुनिए:".
5. Write questions WITHOUT numbers. MCQ options without (a)/(b) labels. Do not include answers anywhere.
6. Mathematics in LaTeX between single dollar signs, e.g. $\\frac{3}{4}$, $x^2$, $\\sqrt{49}$; chemistry like $\\ce{H2SO4}$.
7. Set needsDiagram true only if a question depends on a figure from the book.
8. header: school "", exam "", className "${b.className}", subject "${b.subject}", time "", maxMarks "${fmtMark(total)}", instructions [].
9. Variation #${b.variation}: pick a different, well-spread selection of questions — not simply the first ones in the book.
Return ONLY the JSON.`
}

/* ------------------------------------------------------------------ */
/*  New paper from a previous year paper                               */
/* ------------------------------------------------------------------ */

export function previousPrompt(action: 'new' | 'mix'): string {
  const what = action === 'new'
    ? 'Replace EVERY question with a NEW question of the same type, same topic area and same difficulty. Do not reuse any old question. In maths, change the numbers and situations. In match-the-following, make new pairs.'
    : 'In each section keep about HALF of the questions exactly as they are, and replace the other half with NEW questions of the same type, topic area and difficulty (in maths, change the numbers). Mix the order of the questions within each section.'
  return `You are an experienced Indian school teacher.
The photos and/or Word document text are a PREVIOUS exam question paper (photos may be in any order — use the heading and question numbers to understand the order).
Create a NEW question paper for the same class and subject with EXACTLY the same structure:
same sections in the same order, same section instructions, same number of questions in every section, same marks, and the same header
(school, exam, className, subject, time, maxMarks, instructions — copy them from the old paper).

${what}

Rules:
1. Keep the language of the old paper (Hindi stays in Devanagari, English in English, mixed stays mixed).
2. Output one section per main question / section: number (as in the old paper), title (the instruction), passage (reading passage /
   case study text if the section has one — write a NEW passage when replacing that section's questions), marks (exactly as in the old paper,
   without brackets), type ("mcq" | "match" | "fill" | "truefalse" | "long" | "list"), questions (each WITHOUT its number; blanks as ____;
   MCQ options without (a)/(b) labels; orText for an "OR" alternative), pairs for match sections (right column jumbled).
3. A main question that is one task with no sub-parts (e.g. "Write an essay on…") goes in title with questions [].
4. Mathematics in LaTeX between single dollar signs, e.g. $\\frac{3}{4}$, $x^2$, $\\sqrt{49}$; chemistry like $\\ce{H2SO4}$.
5. Do not include answers. needsDiagram true only if a question needs a figure.
Return ONLY the JSON.`
}

/* ------------------------------------------------------------------ */
/*  Orchestration                                                      */
/* ------------------------------------------------------------------ */

export interface AIConfig {
  geminiKey?: string; groqKey?: string; geminiModel?: string; groqModel?: string; timeBudgetMs?: number
  /** Setup that worked last time (sent back by the browser) so we can go straight to it. */
  hint?: GeminiSetup | null
}

export interface ExtractRawResult { raw: unknown; provider: string; setup?: GeminiSetup; ms?: number }

let remembered: GeminiSetup | null = null

export function validSetup(h: unknown): GeminiSetup | null {
  const x = h as GeminiSetup
  if (!x || typeof x.model !== 'string' || !/^gemini-[\w.-]{1,60}$/.test(x.model)) return null
  if (![0, 1, 2, 3].includes(x.style)) return null
  if (!(THINKING as readonly (string | null)[]).includes(x.thinking)) return null
  return { model: x.model, style: x.style, thinking: x.thinking }
}

type ErrLog = { model: string; kind: string; msg: string }[]

/** Find a model + request style that works (starting from the remembered one) and run it. */
async function runGemini(key: string, images: string[], s: AIConfig, note: string, timeLeft: () => number, errors: ErrLog, onProgress: Progress, prompt = PROMPT, texts: string[] = []) {
  const start = remembered ?? s.hint ?? null
  const forced = s.geminiModel && s.geminiModel !== 'auto' ? s.geminiModel : null
  const queue: string[] = [...new Set([...(forced ? [forced] : []), ...(start ? [start.model] : []), ...FAST_GEMINI_MODELS, ...FALLBACK_GEMINI_MODELS])]
  const tried = new Set<string>()
  let listed = false
  let attempts = 0
  while (attempts < 10 && timeLeft() > 15_000) {
    if (!queue.length) {
      if (listed) break
      listed = true
      try { queue.push(...(await listGeminiModels(key)).slice(0, 4)) } catch (e) { if (e instanceof AIError && e.kind === 'key') throw e }
      continue
    }
    const model = queue.shift()!
    if (tried.has(model)) continue
    tried.add(model)
    const same = start && start.model === model
    let style = same ? start.style : 0
    let ti = same ? THINKING.indexOf(start.thinking as never) : 0
    while (style < 4 && ti < THINKING.length && timeLeft() > 15_000) {
      attempts++
      const setup: GeminiSetup = { model, style, thinking: THINKING[ti] }
      const t0 = Date.now()
      // A one-page paper takes ~5–20 s on a fast model; don't let one slow model hold everyone up.
      const limit = Math.min(prompt === PROMPT ? (attempts === 1 ? 60_000 : 45_000) : 110_000, timeLeft() - 5_000)
      try {
        const raw = await geminiCall(key, setup, images, limit, note, prompt, texts)
        console.log(`[ai] ${model} think=${setup.thinking} style=${style} ok in ${Date.now() - t0}ms`)
        remembered = setup
        return { raw, setup }
      } catch (e) {
        console.log(`[ai] ${model} think=${setup.thinking} style=${style} failed in ${Date.now() - t0}ms: ${(e as Error).message.slice(0, 160)}`)
        if (e instanceof AIError && e.kind === 'key') throw e
        if (e instanceof TypeError) throw new AIError('No internet connection. Check your network and try again.', 'network')
        const err = e as AIError
        errors.push({ model, kind: err.kind ?? 'other', msg: err.message })
        if (err.kind === 'request' && /think/i.test(err.message)) { ti++; continue } // drop/lower the thinking setting
        if (err.kind === 'request' || err.kind === 'parse') { style++; continue } // try a simpler request style
        if (err.kind === 'model' && err.suggested && !tried.has(err.suggested)) {
          // Keep trying the fast Lite models first; slot Google's suggestion in right after them.
          const at = /lite/.test(err.suggested) ? 0 : Math.max(0, queue.findIndex((m) => !/lite/.test(m)))
          queue.splice(at === -1 ? queue.length : at, 0, err.suggested)
        }
        if (remembered?.model === model) remembered = null
        break
      }
    }
    onProgress('Trying another AI model…')
  }
  throw new AIError('gemini failed', 'other')
}

const ROMAN: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10, xi: 11, xii: 12, xiii: 13, xiv: 14, xv: 15, xvi: 16, xvii: 17, xviii: 18, xix: 19, xx: 20 }

/** "Q.6" → 6, "प्रश्न ६" → 6, "VI" → 6, "Section B" → 2. */
export function questionNumber(raw: unknown): number | null {
  const t = String(raw ?? '').trim()
  if (!t) return null
  const latin = t.replace(/[०-९]/g, (d) => String('०१२३४५६७८९'.indexOf(d)))
  const dig = latin.match(/\d+/)
  if (dig) return parseInt(dig[0], 10)
  const rom = latin.toLowerCase().match(/\b([ivx]{1,5})\b/)
  if (rom && ROMAN[rom[1]]) return ROMAN[rom[1]]
  const sec = latin.match(/(?:section|sec|खंड|खण्ड)\s*[-–:]?\s*([A-Za-z])\b/i)
  if (sec) return sec[1].toUpperCase().charCodeAt(0) - 64
  return null
}

/** Put pages read separately back in order: the page with the heading first, then by question numbers. */
/* eslint-disable @typescript-eslint/no-explicit-any */
export function orderPages(raws: any[]): any[] {
  const hasHeading = (r: any) => ['school', 'exam', 'className', 'subject', 'maxMarks'].some((k) => String(r?.header?.[k] ?? '').trim())
  const keys: number[] = []
  raws.forEach((r, i) => {
    const nums = (Array.isArray(r?.sections) ? r.sections : []).map((x: any) => questionNumber(x?.number)).filter((n: number | null): n is number => n != null)
    if (hasHeading(r) && (!nums.length || Math.min(...nums) <= 1)) keys[i] = -1
    else if (nums.length) keys[i] = Math.min(...nums)
    else keys[i] = (i > 0 ? keys[i - 1] : -1) + 0.001 // no numbers: keep it after the page it came after
  })
  return raws.map((r, i) => ({ r, k: keys[i], i })).sort((a, b) => a.k - b.k || a.i - b.i).map((x) => x.r)
}

/** Join pages that were read separately; a page that starts mid-section continues the previous section. */
/* eslint-disable @typescript-eslint/no-explicit-any */
export function mergePages(input: any[]): any {
  const raws = orderPages(input)
  const header: Record<string, unknown> = { ...(raws[0]?.header ?? {}) }
  for (const r of raws.slice(1)) {
    for (const [k, v] of Object.entries(r?.header ?? {})) {
      const empty = !header[k] || (Array.isArray(header[k]) && !(header[k] as unknown[]).length)
      if (empty && v && (!Array.isArray(v) || v.length)) header[k] = v
    }
  }
  const sections: any[] = []
  raws.forEach((r, i) => (Array.isArray(r?.sections) ? r.sections : []).forEach((sec: any, j: number) => {
    const prev = sections[sections.length - 1]
    if (i > 0 && j === 0 && prev && !String(sec?.title ?? '').trim() && !String(sec?.marks ?? '').trim()) {
      prev.questions = [...(prev.questions ?? []), ...(sec.questions ?? [])]
      if (sec.pairs?.length) prev.pairs = [...(prev.pairs ?? []), ...sec.pairs]
    } else sections.push({ ...sec })
  }))
  return { header, sections }
}

/** Try Gemini (fast path: remembered setup, all pages in parallel), then Groq. */
export interface TaskOptions { texts?: string[]; extra?: string; previous?: 'new' | 'mix' | null }

export async function extractRaw(images: string[], s: AIConfig, onProgress: Progress = () => {}, book?: BookRequest | null, opts: TaskOptions = {}): Promise<ExtractRawResult> {
  const texts = opts.texts ?? []
  const base = book ? bookPrompt(book) : opts.previous ? previousPrompt(opts.previous) : PROMPT
  const prompt = opts.extra?.trim()
    ? `${base}\n\nThe teacher's extra instructions (follow them, as long as the output stays in the JSON format above):\n«${opts.extra.trim().slice(0, 600)}»`
    : base
  const oneCall = !!book || !!opts.previous || texts.length > 0 || images.length <= 1
  if (!images.length && !texts.length) throw new AIError('Add at least one photo or file first.', 'other')
  if (!s.geminiKey && !s.groqKey) throw new AIError('No AI key is configured.', 'key')
  const errors: ErrLog = []
  const started = Date.now()
  const budget = s.timeBudgetMs ?? 230_000
  const timeLeft = () => budget - (Date.now() - started)

  if (s.geminiKey) {
    const key = s.geminiKey
    try {
      if (oneCall) {
        onProgress(book ? 'Writing your paper from the chapter…' : opts.previous ? 'Making a new paper from the old one…' : 'Reading the paper…')
        const { raw, setup } = await runGemini(key, images, s, '', timeLeft, errors, onProgress, prompt, texts)
        return { raw, provider: prettyModel(setup.model), setup, ms: Date.now() - started }
      }
      // Several pages: read them all at the same time, then join.
      const n = images.length
      let done = 0
      onProgress(`Reading ${n} pages at once…`)
      const results = await Promise.all(images.map(async (img, k) => {
        const note = k === 0
          ? `This is one of ${n} photos of the paper (the photos may be out of order). Transcribe ONLY this photo. Fill header fields only if the paper heading is on this photo, otherwise leave them "". Always fill "number" for each main question exactly as written. If this photo starts with sub-questions that continue a main question from another page (no main question number/heading at the top), put them in a FIRST section with number "", title "" and marks "".`
          : `This is one of ${n} photos of the paper (the photos may be out of order). Transcribe ONLY this photo. Fill header fields only if the paper heading is on this photo, otherwise leave them "". Always fill "number" for each main question exactly as written. If this photo starts with sub-questions that continue a main question from another page (no main question number/heading at the top), put them in a FIRST section with number "", title "" and marks "".`
        const r = await runGemini(key, [img], s, note, timeLeft, errors, onProgress, prompt)
        done++
        onProgress(`Read ${done} of ${n} pages…`)
        return r
      }))
      return { raw: mergePages(results.map((r) => r.raw)), provider: prettyModel(results[0].setup.model), setup: results[0].setup, ms: Date.now() - started }
    } catch (e) {
      if (e instanceof AIError && (e.kind === 'key' || e.kind === 'network')) throw e
    }
  }

  if (s.groqKey) {
    try {
      onProgress('Trying the backup AI (Groq)…')
      return { raw: await groqCall(s.groqKey, s.groqModel || 'meta-llama/llama-4-scout-17b-16e-instruct', images.slice(0, 5), prompt, texts), provider: 'Groq' }
    } catch (e) {
      if (e instanceof TypeError) throw new AIError('No internet connection. Check your network and try again.', 'network')
      errors.push({ model: 'groq', kind: (e as AIError).kind ?? 'other', msg: (e as Error).message })
    }
  }

  console.warn('AI attempts failed', errors)
  // Report the most useful failure, not just the last one.
  const pick = (k: string) => errors.find((x) => x.kind === k)
  const best = pick('quota') ?? pick('timeout') ?? pick('parse') ?? pick('request') ?? pick('other') ?? errors[errors.length - 1]
  if (best?.kind === 'quota') throw new AIError('The free AI limit is used up for now. Please wait a minute (or until tomorrow) and try again.', 'quota')
  if (best?.kind === 'timeout') throw new AIError('The AI is taking too long right now. Please try again in a minute, or with fewer pages.', 'timeout')
  throw new AIError(`The AI could not read this paper. ${best ? `(${best.model}) ${best.msg}` : ''}`.trim(), (best?.kind as AIErrorKind) ?? 'other')
}

export function prettyModel(m: string) {
  return m.replace(/^gemini-/, 'Gemini ').replace(/-/g, ' ').replace(/\b(flash|lite|pro|latest|preview)\b/g, (w) => w[0].toUpperCase() + w.slice(1))
}

/* ------------------------------------------------------------------ */
/*  Parsing / normalising                                             */
/* ------------------------------------------------------------------ */

export function parseJson(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  try { return JSON.parse(cleaned) } catch { /* try to find the object */ }
  const start = cleaned.indexOf('{'); const end = cleaned.lastIndexOf('}')
  if (start >= 0 && end > start) {
    try { return JSON.parse(cleaned.slice(start, end + 1)) } catch { /* fallthrough */ }
  }
  throw new AIError('The AI reply was not in the expected format. Please try again.', 'parse')
}

