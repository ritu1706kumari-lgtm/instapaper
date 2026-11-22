/**
 * Vercel serverless function: reads exam-paper photos with the school's own AI key.
 * The key lives only in Vercel's Environment Variables, never in the website code.
 *
 *   GEMINI_API_KEY   (required)  free key from https://aistudio.google.com/apikey
 *   GROQ_API_KEY     (optional)  free backup key from https://console.groq.com/keys
 *   ACCESS_CODE      (optional)  a school code users must type once, to keep strangers out
 *   GEMINI_MODEL     (optional)  force a model, e.g. gemini-3.5-flash (default: automatic)
 */
import { AIError, extractRaw, validSetup } from '../src/lib/aiCore.js'

export const maxDuration = 290

const LIMIT_PER_HOUR = Number(process.env.RATE_LIMIT_PER_HOUR || 60)
const hits = new Map<string, number[]>()

function rateLimited(ip: string) {
  const now = Date.now()
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 3_600_000)
  recent.push(now)
  hits.set(ip, recent)
  if (hits.size > 5000) hits.clear()
  return recent.length > LIMIT_PER_HOUR
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })

function sameOrigin(req: Request) {
  const origin = req.headers.get('origin')
  if (!origin) return true
  try {
    const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? new URL(req.url).host
    return new URL(origin).host === host
  } catch {
    return false
  }
}

export function GET() {
  return json({ ai: !!(process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY), needsCode: !!process.env.ACCESS_CODE })
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: 'Not allowed from this website.', kind: 'other' }, 403)
  const ip = (req.headers.get('x-forwarded-for') ?? 'unknown').split(',')[0].trim()
  if (rateLimited(ip)) return json({ error: 'Too many papers from this device in the last hour. Please wait a little.', kind: 'quota' }, 429)

  let body: { images?: unknown; code?: unknown; hint?: unknown }
  try { body = await req.json() } catch { return json({ error: 'Bad request.', kind: 'other' }, 400) }

  const code = process.env.ACCESS_CODE
  if (code && String(body.code ?? '').trim() !== code.trim()) {
    return json({ error: 'Wrong or missing school code. Enter it in Settings.', kind: 'code' }, 401)
  }

  const images = Array.isArray(body.images) ? body.images.filter((x): x is string => typeof x === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(x)) : []
  if (!images.length || images.length > 12) return json({ error: 'Send between 1 and 12 photos.', kind: 'other' }, 400)

  try {
    const res = await extractRaw(images, {
      geminiKey: process.env.GEMINI_API_KEY,
      groqKey: process.env.GROQ_API_KEY,
      geminiModel: process.env.GEMINI_MODEL || 'auto',
      groqModel: process.env.GROQ_MODEL,
      timeBudgetMs: 250_000,
      hint: validSetup(body.hint),
    })
    return json(res)
  } catch (e) {
    const err = e as AIError
    if (err.kind === 'key') {
      console.error('AI key problem:', err.message)
      return json({ error: 'The school AI key is not working. Ask the administrator to check GEMINI_API_KEY in Vercel.', kind: 'server' }, 500)
    }
    return json({ error: err.message || 'AI error', kind: err.kind || 'other' }, err.kind === 'quota' ? 429 : 502)
  }
}
