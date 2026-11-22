import {
  AlignmentType, BorderStyle, Document, ImageRun, Packer, PageBreak, Paragraph, Table, TableCell, TableRow,
  TabStopType, TextRun, WidthType, type IBorderOptions, type ParagraphChild,
} from 'docx'
import type { Paper } from '../types'
import { getTemplate, OPTION_LABELS, sectionLabel, subLabel } from './templates'
import { latexToUnicode, tokenize } from './latex'
import { loadImage } from './image'

const MM = 56.7 // twips per mm
const CONTENT_W = Math.round((210 - 26) * MM)
const NONE: IBorderOptions = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
const NO_BORDERS = { top: NONE, bottom: NONE, left: NONE, right: NONE, insideHorizontal: NONE, insideVertical: NONE }

function fontsFor(templateId: string) {
  const latin = templateId === 'board' ? 'Times New Roman' : 'Arial'
  return { ascii: latin, hAnsi: latin, cs: 'Nirmala UI', eastAsia: latin }
}

interface Ctx { font: ReturnType<typeof fontsFor>; size: number }

/** Rich text → Word runs: maths becomes readable Unicode, blanks become underlined gaps. */
function runs(text: string, ctx: Ctx, opts: { bold?: boolean } = {}): TextRun[] {
  return tokenize(text).map((tk) => {
    if (tk.t === 'blank') return new TextRun({ text: '________________', font: ctx.font, size: ctx.size, bold: opts.bold })
    const v = tk.t === 'math' ? latexToUnicode(tk.v) : tk.v
    return new TextRun({ text: v, font: ctx.font, size: ctx.size, bold: opts.bold, italics: false })
  })
}

async function imageRun(dataUrl: string, maxWmm: number, maxHmm: number): Promise<ImageRun | null> {
  try {
    const img = await loadImage(dataUrl)
    const pxPerMm = 96 / 25.4
    const scale = Math.min(1, (maxWmm * pxPerMm) / img.width, (maxHmm * pxPerMm) / img.height)
    const bin = atob(dataUrl.split(',')[1])
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return new ImageRun({
      type: dataUrl.startsWith('data:image/png') ? 'png' : 'jpg',
      data: bytes,
      transformation: { width: Math.round(img.width * scale), height: Math.round(img.height * scale) },
    })
  } catch {
    return null
  }
}

async function paperToBlocks(paper: Paper): Promise<(Paragraph | Table)[]> {
  const t = getTemplate(paper.templateId)
  const base = Math.round((t.id === 'primary' ? 16 : t.id === 'compact' ? 12.5 : t.id === 'hindi' ? 15 : 14) * 0.75 * 2 * paper.fontScale)
  const ctx: Ctx = { font: fontsFor(t.id), size: base }
  const h = paper.header
  const out: (Paragraph | Table)[] = []
  const small = { ...ctx, size: Math.round(base * 0.93) }

  if (h.logo) {
    const logo = await imageRun(h.logo, 20, 15)
    if (logo) out.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [logo] }))
  }
  out.push(new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { after: 0 },
    children: [new TextRun({ text: t.id === 'hindi' ? h.school : h.school.toUpperCase(), bold: true, font: ctx.font, size: Math.round(base * 1.22) })],
  }))
  out.push(new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { after: 60 },
    children: [new TextRun({ text: h.exam + (paper.setLabel ? `   (${t.labels.set} – ${paper.setLabel})` : ''), bold: true, font: ctx.font, size: base })],
  }))

  const info = [`${t.labels.cls} – ${h.className}`, `${t.labels.subject} – ${h.subject}`, `${t.labels.time}: ${h.time}`, `${t.labels.mm}: ${h.maxMarks}`]
  const aligns = [AlignmentType.LEFT, AlignmentType.CENTER, AlignmentType.CENTER, AlignmentType.RIGHT]
  out.push(new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [CONTENT_W / 4, CONTENT_W / 4, CONTENT_W / 4, CONTENT_W / 4],
    borders: { ...NO_BORDERS, bottom: { style: BorderStyle.SINGLE, size: 12, color: '000000' } },
    rows: [new TableRow({
      children: info.map((txt, i) => new TableCell({
        borders: { top: NONE, left: NONE, right: NONE, bottom: { style: BorderStyle.SINGLE, size: 12, color: '000000' } },
        width: { size: CONTENT_W / 4, type: WidthType.DXA },
        children: [new Paragraph({ alignment: aligns[i], spacing: { after: 60 }, children: [new TextRun({ text: txt, bold: true, font: ctx.font, size: small.size })] })],
      })),
    })],
  }))

  if (paper.showStudentFields) {
    out.push(new Paragraph({
      spacing: { before: 120, after: 60 },
      tabStops: [{ type: TabStopType.CENTER, position: CONTENT_W * 0.62 }, { type: TabStopType.RIGHT, position: CONTENT_W }],
      children: [
        new TextRun({ text: `${t.labels.name}: ____________________________`, bold: true, font: ctx.font, size: small.size }),
        new TextRun({ text: `\t${t.labels.roll}: __________`, bold: true, font: ctx.font, size: small.size }),
        new TextRun({ text: `\t${t.labels.date}: __________`, bold: true, font: ctx.font, size: small.size }),
      ],
    }))
  }

  if (h.instructions.length) {
    out.push(new Paragraph({ spacing: { before: 120 }, children: [new TextRun({ text: `${t.labels.instructions}:`, bold: true, font: ctx.font, size: small.size })] }))
    h.instructions.forEach((ins, i) => out.push(new Paragraph({
      indent: { left: 400, hanging: 300 }, children: [new TextRun({ text: `${i + 1}.\t`, font: ctx.font, size: small.size }), ...runs(ins, small)],
      tabStops: [{ type: TabStopType.LEFT, position: 400 }],
    })))
  }

  let counter = 0
  for (let si = 0; si < paper.sections.length; si++) {
    const s = paper.sections[si]
    const label = sectionLabel(t, si)
    const marks = s.marks ? `(${s.marks})` : ''
    if (t.heading === 'section') {
      out.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 240, after: 40 }, keepNext: true, children: [new TextRun({ text: label, bold: true, underline: {}, font: ctx.font, size: ctx.size })] }))
      out.push(new Paragraph({
        keepNext: true, spacing: { after: 60 }, tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_W }],
        children: [...runs(s.title, ctx, { bold: true }), new TextRun({ text: `\t${marks}`, bold: true, font: ctx.font, size: ctx.size })],
      }))
    } else {
      out.push(new Paragraph({
        keepNext: true, spacing: { before: 200, after: 60 }, tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_W }],
        children: [new TextRun({ text: `${label} `, bold: true, font: ctx.font, size: ctx.size }), ...runs(s.title, ctx, { bold: true }), new TextRun({ text: `\t${marks}`, bold: true, font: ctx.font, size: ctx.size })],
      }))
    }

    if (s.passage) {
      s.passage.split(/\n+/).forEach((para) => out.push(new Paragraph({
        indent: { left: 480 }, spacing: { after: 80 }, alignment: AlignmentType.JUSTIFIED,
        border: { top: { style: BorderStyle.SINGLE, size: 6, color: '000000', space: 4 }, bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000', space: 4 }, left: { style: BorderStyle.SINGLE, size: 6, color: '000000', space: 6 }, right: { style: BorderStyle.SINGLE, size: 6, color: '000000', space: 6 } },
        children: runs(para, ctx),
      })))
    }

    if (s.type === 'match') {
      const pairs = s.pairs ?? []
      const w = Math.round(CONTENT_W * 0.65)
      out.push(new Table({
        width: { size: w, type: WidthType.DXA }, columnWidths: [w * 0.45, w * 0.1, w * 0.45], indent: { size: 340, type: WidthType.DXA },
        borders: NO_BORDERS,
        rows: pairs.map((p, k) => new TableRow({
          children: [
            new TableCell({ borders: NO_BORDERS, children: [new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: `${subLabel(t.sub, k + 1)} `, font: ctx.font, size: ctx.size }), ...runs(p.left, ctx)] })] }),
            new TableCell({ borders: NO_BORDERS, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '—', font: ctx.font, size: ctx.size })] })] }),
            new TableCell({ borders: NO_BORDERS, children: [new Paragraph({ children: runs(p.right, ctx) })] }),
          ],
        })),
      }))
      counter++
      continue
    }

    for (let k = 0; k < s.questions.length; k++) {
      const q = s.questions[k]
      const num = t.continuous ? `${counter + k + 1}.` : subLabel(t.sub, k + 1)
      const children: ParagraphChild[] = [new TextRun({ text: `${num}\t`, font: ctx.font, size: ctx.size, bold: t.continuous }), ...runs(q.text, ctx)]
      if (q.marks) children.push(new TextRun({ text: `\t[${q.marks}]`, bold: true, font: ctx.font, size: ctx.size }))
      out.push(new Paragraph({
        indent: { left: 480, hanging: 380 }, spacing: { after: 60 }, keepLines: true,
        tabStops: [{ type: TabStopType.LEFT, position: 480 }, { type: TabStopType.RIGHT, position: CONTENT_W }],
        children,
      }))
      if (q.image) {
        const img = await imageRun(q.image, 120, 70)
        if (img) out.push(new Paragraph({ indent: { left: 480 }, spacing: { after: 60 }, children: [img] }))
      }
      if (q.options?.length) {
        const opts = q.options
        const four = opts.join('').length <= 64 && !opts.some((o) => o.length > 22)
        const per = four ? 4 : 2
        for (let r = 0; r < opts.length; r += per) {
          const row = opts.slice(r, r + per)
          const step = Math.round((CONTENT_W - 480) / per)
          out.push(new Paragraph({
            indent: { left: 480 }, spacing: { after: 40 },
            tabStops: row.map((_, c) => ({ type: TabStopType.LEFT, position: 480 + step * c })),
            children: row.flatMap((o, c) => [new TextRun({ text: `${c ? '\t' : ''}${OPTION_LABELS[r + c]} `, font: ctx.font, size: ctx.size }), ...runs(o, ctx)]),
          }))
        }
      }
      if (q.orText) {
        out.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: t.labels.or, bold: true, font: ctx.font, size: ctx.size })] }))
        out.push(new Paragraph({ indent: { left: 480 }, spacing: { after: 60 }, children: runs(q.orText, ctx) }))
      }
    }
    counter += Math.max(1, s.questions.length)
  }
  return out
}

export async function buildDocx(papers: Paper[], copies = 1): Promise<Blob> {
  const children: (Paragraph | Table)[] = []
  let first = true
  for (const p of papers) {
    for (let c = 0; c < copies; c++) {
      const blocks = await paperToBlocks(p)
      if (!first) children.push(new Paragraph({ children: [new PageBreak()] }))
      children.push(...blocks)
      first = false
    }
  }
  const doc = new Document({
    creator: 'Instant Paper',
    title: papers.map((p) => p.name).join(', '),
    styles: { default: { document: { run: { font: 'Arial' } } } },
    sections: [{
      properties: { page: { size: { width: Math.round(210 * MM), height: Math.round(297 * MM) }, margin: { top: Math.round(13 * MM), bottom: Math.round(13 * MM), left: Math.round(13 * MM), right: Math.round(13 * MM) } } },
      children,
    }],
  })
  return Packer.toBlob(doc)
}
