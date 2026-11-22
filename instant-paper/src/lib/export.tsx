import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { create } from 'zustand'
import { saveAs } from 'file-saver'
import type { Paper } from '../types'
import { PaperView } from '../components/PaperView'
import { buildDocx } from './docx'

/* ---------------- print ---------------- */

interface PrintState { job: { papers: Paper[]; copies: number } | null; start: (papers: Paper[], copies: number) => void; done: () => void }
export const usePrint = create<PrintState>((set) => ({
  job: null,
  start: (papers, copies) => set({ job: { papers, copies } }),
  done: () => set({ job: null }),
}))

export async function waitForAssets(root: HTMLElement) {
  await document.fonts?.ready
  const imgs = [...root.querySelectorAll('img')]
  await Promise.all(imgs.map((img) => (img.complete ? Promise.resolve() : new Promise((r) => { img.onload = img.onerror = () => r(null) }))))
}

export const safeName = (s: string) => s.replace(/[^\p{L}\p{M}\p{N}\- _.·]+/gu, '').replace(/\s+/g, ' ').trim().slice(0, 80) || 'question-paper'

/* ---------------- PDF ---------------- */

const PAGE_W_MM = 210, PAGE_H_MM = 297, MX = 13, MY = 12
const CONTENT_W_MM = PAGE_W_MM - 2 * MX, CONTENT_H_MM = PAGE_H_MM - 2 * MY
/** Blocks that must never be split across two pages. */
const ATOMIC = '.p-passage, .p-header, .p-student, .p-instructions, .p-sec-head, .q-item, .p-match tr, .q-img, .p-empty'

/** Find y-positions (in CSS px, relative to el) where it is safe to start a new page. */
function pageCuts(el: HTMLElement, pagePx: number): number[] {
  const top0 = el.getBoundingClientRect().top
  const blocks = [...el.querySelectorAll<HTMLElement>(ATOMIC)].map((b) => {
    const r = b.getBoundingClientRect()
    return { top: r.top - top0, bottom: r.bottom - top0, head: b.classList.contains('p-sec-head') }
  })
  const total = el.scrollHeight
  const cuts: number[] = [0]
  let start = 0
  while (total - start > pagePx + 1) {
    const limit = start + pagePx
    // A cut is safe at the top of a block if no other block straddles that line.
    let best = -1
    for (const b of blocks) {
      if (b.top <= start + 20 || b.top > limit) continue
      const straddles = blocks.some((o) => o.top < b.top - 0.5 && o.bottom > b.top + 0.5)
      if (straddles) continue
      // never leave a section heading alone at the bottom of a page
      const prev = blocks.filter((o) => o.bottom <= b.top + 0.5).pop()
      if (prev?.head) continue
      best = Math.max(best, b.top - 2)
    }
    const cut = best > start ? best : limit
    cuts.push(cut)
    start = cut
  }
  return cuts
}

export async function downloadPdf(papers: Paper[], filename: string, copies = 1) {
  const [{ jsPDF }, { toCanvas }] = await Promise.all([import('jspdf'), import('html-to-image')])
  const host = document.createElement('div')
  host.setAttribute('aria-hidden', 'true')
  Object.assign(host.style, { position: 'fixed', left: '-10000px', top: '0', width: `${CONTENT_W_MM}mm`, background: '#fff' })
  document.body.appendChild(host)
  const root = createRoot(host)
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true })
  let firstPage = true
  try {
    for (const paper of papers) {
      flushSync(() => root.render(<div className="pdf-root"><PaperView paper={paper} /></div>))
      const el = host.firstElementChild as HTMLElement
      await waitForAssets(host)
      const widthPx = el.offsetWidth
      const pxPerMm = widthPx / CONTENT_W_MM
      const pagePx = CONTENT_H_MM * pxPerMm
      const cuts = pageCuts(el, pagePx)
      const ratio = 2.6
      const canvas = await toCanvas(el, { pixelRatio: ratio, backgroundColor: '#ffffff', cacheBust: false, width: widthPx, height: el.scrollHeight })
      // Slice the tall render into A4 pages once, then reuse the slices for every copy.
      const slices: { data: string; hMm: number }[] = []
      for (let i = 0; i < cuts.length; i++) {
        const y0 = cuts[i]
        const y1 = i + 1 < cuts.length ? cuts[i + 1] : el.scrollHeight
        const c = document.createElement('canvas')
        c.width = canvas.width
        c.height = Math.max(1, Math.round((y1 - y0) * ratio))
        const ctx = c.getContext('2d')!
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height)
        ctx.drawImage(canvas, 0, Math.round(y0 * ratio), c.width, c.height, 0, 0, c.width, c.height)
        slices.push({ data: c.toDataURL('image/jpeg', 0.92), hMm: (y1 - y0) / pxPerMm })
      }
      for (let k = 0; k < copies; k++) {
        for (const s of slices) {
          if (!firstPage) pdf.addPage()
          firstPage = false
          pdf.addImage(s.data, 'JPEG', MX, MY, CONTENT_W_MM, s.hMm, undefined, 'FAST')
        }
      }
    }
    pdf.setProperties({ title: filename, creator: 'Instant Paper' })
    pdf.save(`${filename}.pdf`)
  } finally {
    root.unmount()
    host.remove()
  }
}

/* ---------------- Word ---------------- */

export async function downloadDocx(papers: Paper[], filename: string) {
  const blob = await buildDocx(papers)
  saveAs(blob, `${filename}.docx`)
}
