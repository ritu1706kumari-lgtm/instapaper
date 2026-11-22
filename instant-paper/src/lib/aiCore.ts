/**
 * AI core shared by the browser and the server function (api/extract.ts).
 * No DOM APIs here — only fetch.
 */

/* ------------------------------------------------------------------ */
/*  Prompt + schema                                                    */
/* ------------------------------------------------------------------ */

const PROMPT = `You are an expert exam-paper typist for an Indian school.
The images are photos of ONE handwritten (or printed) question paper written by a teacher, in page order.
Transcribe it EXACTLY into JSON. Rules:

1. Do NOT translate, paraphrase, correct facts or add questions. Keep Hindi in Devanagari, English in English, mixed lines mixed.
   Fix only obvious spelling slips in English. Keep the teacher's wording.
2. header: school, exam (e.g. "Second Terminal Examination"), className (e.g. "1st", "VIII"), subject, time (e.g. "2 Hours"),
   maxMarks (number only, e.g. "50"), instructions (general instructions list, [] if none). Use "" when not written.
3. sections: one per main question / section, in order ("Que 1", "Q.2", "Section A", "प्रश्न 1" ...).
   - title: the instruction without the number, e.g. "Fill in the blanks:", "Tick (✓) the correct answer:", "रिक्त स्थान भरो:".
   - marks: exactly as written, without brackets, e.g. "5", "2½ × 8 = 20", "1×5=5". "" if not written.
   - type: "mcq" when each question has options (a)(b)(c)(d); "match" for match the following; "fill" for blanks;
     "truefalse" for true/false or right/wrong; "long" for long-answer questions; otherwise "list".
   - questions: each sub-question WITHOUT its number. For blanks write ____ (4 underscores) where the line is.
     options: for MCQ only, the option texts without (a)/(b) labels.
     orText: if the question has an "OR" alternative, put the alternative here.
     marks: only if marks are written next to that single question, else "".
     needsDiagram: true if the question has a drawn figure, map, table image or picture.
   - pairs: for "match" sections, the left and right column items in the SAME order they are written (do not solve them).
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
          title: { type: 'STRING' },
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
 "sections":[{"title":"","marks":"","type":"list|mcq|match|truefalse|fill|long",
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
/** Aliases Google keeps pointing at its current Flash models, so they never go stale. */
const FALLBACK_GEMINI_MODELS = ['gemini-flash-latest', 'gemini-flash-lite-latest']

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
    if (/lite/.test(n)) r -= 40
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
  if (res.status === 404 || /not found|not supported|no longer available|deprecated|retired/i.test(msg)) return new AIError(`Model unavailable: ${msg}`, 'model', suggested)
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

export async function geminiCall(key: string, model: string, images: string[], style = 0, timeoutMs = 100_000): Promise<unknown> {
  const parts: object[] = [{ text: style >= 2 ? `${PROMPT}\n\n${JSON_SHAPE_HINT}` : PROMPT }]
  images.forEach((d, i) => {
    const [meta, data] = d.split(',')
    parts.push({ text: `Page ${i + 1}:` })
    parts.push({ inline_data: { mime_type: meta.match(/data:(.*?);/)?.[1] ?? 'image/jpeg', data } })
  })
  const gc = generationConfig(style)
  return withTimeout(timeoutMs, async (signal) => {
    const res = await fetch(`${GEMINI}/models/${model}:generateContent`, {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ contents: [{ role: 'user', parts }], ...(gc ? { generationConfig: gc } : {}) }),
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

export async function groqCall(key: string, model: string, images: string[]): Promise<unknown> {
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
        content: [{ type: 'text', text: `${PROMPT}\n\n${JSON_SHAPE_HINT}` }, ...images.map((url) => ({ type: 'image_url', image_url: { url } }))],
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
/*  Orchestration                                                      */
/* ------------------------------------------------------------------ */

export interface AIConfig { geminiKey?: string; groqKey?: string; geminiModel?: string; groqModel?: string; timeBudgetMs?: number }

/** Try Gemini models (best free first), then Groq. Returns the raw JSON the model produced. */
export async function extractRaw(images: string[], s: AIConfig, onProgress: Progress = () => {}): Promise<{ raw: unknown; provider: string }> {
  if (!images.length) throw new AIError('Add at least one photo of the paper first.', 'other')
  if (!s.geminiKey && !s.groqKey) throw new AIError('No AI key is configured.', 'key')
  const errors: { model: string; kind: string; msg: string }[] = []

  const started = Date.now()
  const budget = s.timeBudgetMs ?? 230_000
  const timeLeft = () => budget - (Date.now() - started)

  if (s.geminiKey) {
    let models: string[] = []
    try {
      onProgress('Finding the best free model…')
      models = await listGeminiModels(s.geminiKey)
    } catch (e) {
      if (e instanceof AIError && e.kind === 'key') throw e
    }
    const queue = [...new Set([...(s.geminiModel && s.geminiModel !== 'auto' ? [s.geminiModel] : []), ...models.slice(0, 4), ...FALLBACK_GEMINI_MODELS])]
    const tried = new Set<string>()
    let attempts = 0
    while (queue.length && attempts < 8 && timeLeft() > 20_000) {
      const model = queue.shift()!
      if (tried.has(model)) continue
      tried.add(model)
      // Try request styles from newest to simplest until this model accepts one.
      for (let style = 0; style < 4 && timeLeft() > 20_000; style++) {
        attempts++
        try {
          onProgress(`Reading handwriting with ${prettyModel(model)}…`)
          const raw = await geminiCall(s.geminiKey, model, images, style, Math.min(100_000, timeLeft() - 5_000))
          return { raw, provider: prettyModel(model) }
        } catch (e) {
          if (e instanceof AIError && e.kind === 'key') throw e
          if (e instanceof TypeError) throw new AIError('No internet connection. Check your network and try again.', 'network')
          const err = e as AIError
          errors.push({ model, kind: err.kind ?? 'other', msg: err.message })
          if (err.kind === 'request' || err.kind === 'parse') continue // try a simpler request style
          if (err.kind === 'model' && err.suggested && !tried.has(err.suggested)) queue.unshift(err.suggested)
          break // move on to the next model
        }
      }
    }
  }

  if (s.groqKey) {
    try {
      onProgress('Trying the backup AI (Groq)…')
      return { raw: await groqCall(s.groqKey, s.groqModel || 'meta-llama/llama-4-scout-17b-16e-instruct', images), provider: 'Groq' }
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
