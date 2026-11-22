/** Turn whatever the teacher picks / pastes into photos (data URLs) or plain text. */
import { fileToCompressedDataUrl } from './image'

export type Loaded =
  | { kind: 'image'; name: string; dataUrl: string }
  | { kind: 'text'; name: string; text: string }

const isPdf = (f: File) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name)
const isDocx = (f: File) => /officedocument\.wordprocessingml/.test(f.type) || /\.docx$/i.test(f.name)
export const isSupported = (f: File) => f.type.startsWith('image/') || isPdf(f) || isDocx(f)
export const ACCEPT = 'image/*,application/pdf,.pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document'

export const MAX_PDF_PAGES = 15

/** Render every PDF page to a JPEG (up to 15 pages). */
async function pdfToImages(file: File, onPage?: (n: number, total: number) => void): Promise<Loaded[]> {
  const pdfjs = await import('pdfjs-dist')
  const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = worker
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
  const total = Math.min(doc.numPages, MAX_PDF_PAGES)
  const out: Loaded[] = []
  for (let i = 1; i <= total; i++) {
    onPage?.(i, total)
    const page = await doc.getPage(i)
    const base = page.getViewport({ scale: 1 })
    const viewport = page.getViewport({ scale: Math.min(3, 1700 / base.width) })
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(viewport.width); canvas.height = Math.round(viewport.height)
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvas, canvasContext: ctx, viewport }).promise
    out.push({ kind: 'image', name: `${file.name} · page ${i}`, dataUrl: canvas.toDataURL('image/jpeg', 0.86) })
  }
  await doc.cleanup?.()
  return out
}

async function docxToText(file: File): Promise<Loaded> {
  const mammoth = (await import('mammoth')).default
  const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })
  const text = value.replace(/\n{3,}/g, '\n\n').trim()
  if (!text) throw new Error(`“${file.name}” looks empty. If it only has pictures, save it as PDF and upload that instead.`)
  return { kind: 'text', name: file.name, text: text.slice(0, 40_000) }
}

export async function loadFiles(files: File[], onStatus?: (msg: string) => void): Promise<{ loaded: Loaded[]; skipped: string[] }> {
  const loaded: Loaded[] = []
  const skipped: string[] = []
  for (const f of files) {
    try {
      if (f.type.startsWith('image/')) { onStatus?.(`Preparing ${f.name}…`); loaded.push({ kind: 'image', name: f.name || 'Pasted image', dataUrl: await fileToCompressedDataUrl(f) }) }
      else if (isPdf(f)) loaded.push(...(await pdfToImages(f, (n, t) => onStatus?.(`Reading PDF page ${n} of ${t}…`))))
      else if (isDocx(f)) { onStatus?.(`Reading ${f.name}…`); loaded.push(await docxToText(f)) }
      else skipped.push(f.name)
    } catch (e) {
      console.warn(e)
      skipped.push(`${f.name} (${(e as Error).message})`)
    }
  }
  return { loaded, skipped }
}

/** Images (screenshots) currently on the clipboard, via the Paste button. */
export async function readClipboardImages(): Promise<File[]> {
  const items = await navigator.clipboard.read()
  const files: File[] = []
  for (const item of items) {
    const type = item.types.find((t) => t.startsWith('image/'))
    if (type) files.push(new File([await item.getType(type)], `Pasted image ${files.length + 1}.png`, { type }))
  }
  return files
}
