import type { PaperHeader, Section, SectionType, Settings } from '../types'
import { uid } from './id'
import { AIError, extractRaw, validSetup, type BookRequest, type GeminiSetup, type Progress } from './aiCore'

export { AIError, listGeminiModels, prettyModel } from './aiCore'

export interface ExtractResult {
  header: PaperHeader
  sections: Section[]
  provider: string
  seconds: number
}

/* ------------------------------------------------------------------ */
/*  School AI (server function holding the key)                        */
/* ------------------------------------------------------------------ */

export interface ServerAIStatus { available: boolean; needsCode: boolean; reason?: string }

/** Ask the deployment whether a shared school AI key is configured (api/extract). */
export async function checkServerAI(): Promise<ServerAIStatus> {
  try {
    const res = await fetch('/api/extract', { method: 'GET', headers: { Accept: 'application/json' }, cache: 'no-store' })
    const isJson = (res.headers.get('content-type') ?? '').includes('json')
    if (res.status === 404 || (res.ok && !isJson)) return { available: false, needsCode: false, reason: 'The server function (api/extract) is not deployed. Check that the “api” folder is in the GitHub repo next to package.json.' }
    if (!res.ok) return { available: false, needsCode: false, reason: `The server function crashed (error ${res.status}). Open Vercel → Deployments → Logs to see why.` }
    const d = await res.json()
    if (!d.ai) return { available: false, needsCode: false, reason: 'The server is running but GEMINI_API_KEY is missing. Add it in Vercel → Settings → Environment Variables (tick “Production”), then Redeploy.' }
    return { available: true, needsCode: !!d.needsCode }
  } catch {
    return { available: false, needsCode: false, reason: 'Could not reach the server function.' }
  }
}

const HINT_KEY = 'instant-paper:ai-setup-v2'
const loadHint = (): GeminiSetup | null => { try { return validSetup(JSON.parse(localStorage.getItem(HINT_KEY) ?? 'null')) } catch { return null } }
const saveHint = (h?: GeminiSetup) => { try { if (h) localStorage.setItem(HINT_KEY, JSON.stringify(h)) } catch { /* private mode */ } }

const MAX_BODY = 4_000_000 // Vercel allows 4.5 MB per request; keep a margin.

/** Shrink photos until the whole request fits the hosting limit. */
async function fitImages(images: string[]): Promise<string[]> {
  const { compressDataUrl } = await import('./image')
  const size = (arr: string[]) => arr.reduce((n, d) => n + d.length, 0)
  let out = images
  for (const [side, q] of [[1400, 0.75], [1250, 0.7], [1000, 0.65]] as const) {
    if (size(out) < MAX_BODY) break
    out = await Promise.all(images.map((d) => compressDataUrl(d, side, q)))
  }
  if (size(out) >= MAX_BODY) throw new AIError('Too many pages for one paper. Split it into two papers (max ~10 pages each).', 'other')
  return out
}

async function extractViaServer(images: string[], code: string, onProgress: Progress, signal?: AbortSignal, book?: BookRequest | null) {
  onProgress('Uploading photos…')
  const body = JSON.stringify({ images: await fitImages(images), code, hint: loadHint(), ...(book ? { book } : {}) })
  onProgress(book ? 'Writing your paper from the chapter…' : 'Reading handwriting with the school AI…')
  let res: Response
  try {
    const timeout = AbortSignal.timeout(295_000)
    res = await fetch('/api/extract', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal: signal ? AbortSignal.any([signal, timeout]) : timeout })
  } catch (e) {
    if (signal?.aborted) throw new AIError('Cancelled.', 'other')
    if ((e as Error).name === 'TimeoutError' || (e as Error).name === 'AbortError') throw new AIError('The AI is taking too long right now. Please try again in a minute.', 'timeout')
    throw new AIError('No internet connection. Check your network and try again.', 'network')
  }
  let data: { raw?: unknown; provider?: string; setup?: GeminiSetup; ms?: number; error?: string; kind?: string } = {}
  try { data = await res.json() } catch { /* non-JSON error page */ }
  if (!res.ok) {
    if (res.status === 413) throw new AIError('The photos are too large. Try fewer pages per paper.', 'other')
    if (res.status === 504) throw new AIError('The AI took too long. Please try again.', 'quota')
    throw new AIError(data.error || `Server error ${res.status}`, (data.kind as AIError['kind']) || 'other')
  }
  saveHint(data.setup)
  return { raw: data.raw, provider: data.provider ?? 'School AI', ms: data.ms }
}

/* ------------------------------------------------------------------ */
/*  Main entry                                                         */
/* ------------------------------------------------------------------ */

export async function extractPaper(images: string[], s: Settings, server: ServerAIStatus, onProgress: Progress = () => {}, signal?: AbortSignal, book?: BookRequest | null): Promise<ExtractResult> {
  if (!images.length) throw new AIError('Add at least one photo of the paper first.', 'other')
  // A personal key (Settings → Advanced) always wins; otherwise use the school's shared AI.
  const personal = !!(s.geminiKey || s.groqKey)
  // 1600px is plenty for handwriting and uploads/reads much faster.
  const { compressDataUrl } = await import('./image')
  images = await Promise.all(images.map((d) => compressDataUrl(d, 1600, 0.82)))
  const t0 = Date.now()
  let res: { raw: unknown; provider: string; ms?: number }
  if (personal) {
    const cancelled = new Promise<never>((_, rej) => signal?.addEventListener('abort', () => rej(new AIError('Cancelled.', 'other'))))
    const r = await Promise.race([extractRaw(images, { ...s, hint: loadHint() }, onProgress, book), cancelled])
    saveHint(r.setup)
    res = r
  } else if (server.available) res = await extractViaServer(images, s.accessCode ?? '', onProgress, signal, book)
  else throw new AIError('AI is not set up yet. Ask the administrator to add the school AI key, or add your own key in Settings.', 'key')
  return { ...normalize(res.raw), provider: res.provider, seconds: Math.max(1, Math.round((Date.now() - t0) / 1000)) }
}

/* ------------------------------------------------------------------ */
/*  Normalising                                                        */
/* ------------------------------------------------------------------ */

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '')
const TYPES: SectionType[] = ['list', 'mcq', 'match', 'truefalse', 'fill', 'long']

/* eslint-disable @typescript-eslint/no-explicit-any */
export function normalize(raw: any): { header: PaperHeader; sections: Section[] } {
  const h = raw?.header ?? {}
  const header: PaperHeader = {
    school: str(h.school), exam: str(h.exam), className: str(h.className), subject: str(h.subject),
    time: str(h.time), maxMarks: str(h.maxMarks).replace(/[^\d½.]/g, '') || str(h.maxMarks),
    instructions: Array.isArray(h.instructions) ? h.instructions.map(str).filter(Boolean) : [],
  }
  const sections: Section[] = (Array.isArray(raw?.sections) ? raw.sections : []).map((s: any) => {
    const type: SectionType = TYPES.includes(s?.type) ? s.type : 'list'
    const questions = (Array.isArray(s?.questions) ? s.questions : [])
      .map((q: any) => ({
        id: uid(),
        text: cleanBlanks(str(typeof q === 'string' ? q : q?.text).replace(/^\(?([ivx]+|\d+|[a-z])[.)]\s+/i, '')),
        options: Array.isArray(q?.options) && q.options.length ? q.options.map((o: unknown) => str(o).replace(/^\(?[a-dA-D][.)]\s*/, '')) : undefined,
        orText: str(q?.orText) || undefined,
        marks: str(q?.marks).replace(/[()]/g, '') || undefined,
        needsDiagram: q?.needsDiagram === true || undefined,
      }))
      .filter((q: any) => q.text || q.options)
    const pairs = Array.isArray(s?.pairs) && s.pairs.length ? s.pairs.map((p: any) => ({ id: uid(), left: str(p?.left), right: str(p?.right) })) : undefined
    const title = str(s?.title).replace(/^(que|q|question|प्रश्न)\.?\s*\d+[.:)]?\s*/i, '')
    // A one-line task ("Write an essay on cow") must not also appear as its own sub-question.
    const key = (x: string) => x.toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, '')
    const tk = key(title)
    const dupes = (q: any) => {
      const qk = key(q.text)
      return !!qk && !!tk && !q.options && (qk === tk || (qk.length > 6 && tk.includes(qk) && questions.length === 1) || (tk.length > 6 && qk.includes(tk)))
    }
    if (questions.length && dupes(questions[0])) questions.shift()
    let finalTitle = title
    // Only one plain question and no instruction: that question IS the main question.
    if (!finalTitle && questions.length === 1 && !questions[0].options && !pairs && str(s?.number)) { finalTitle = questions[0].text; questions.length = 0 }
    return {
      id: uid(),
      title: finalTitle,
      marks: str(s?.marks).replace(/^\(|\)$/g, ''),
      type: pairs && type !== 'match' && !questions.length ? 'match' : type,
      questions,
      pairs,
    } as Section
  })
  return { header, sections }
}

function cleanBlanks(t: string) {
  return t.replace(/_{2,}|\.{5,}|-{5,}/g, '____')
}
