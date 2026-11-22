import { useState } from 'react'
import { motion } from 'motion/react'
import { FileDown, FileText, Loader2, Printer } from 'lucide-react'
import type { Paper } from '../types'
import { useStore } from '../store'
import { Button, Modal, inputCls } from './ui'
import { makeSets } from '../lib/shuffle'
import { downloadDocx, downloadPdf, safeName, usePrint } from '../lib/export'

export type ExportKind = 'print' | 'pdf' | 'docx'

/** Expand each paper into its sets (Set A, B, C…) when the user turned sets on. */
export function expand(papers: Paper[]): Paper[] {
  return papers.flatMap((p) => (p.sets && p.sets.count > 1 ? makeSets(p, p.sets) : [p]))
}

export function ExportDialog({ paper, kind, onClose }: { paper: Paper; kind: ExportKind | null; onClose: () => void }) {
  const papers = useStore((s) => s.papers)
  const toast = useStore((s) => s.toast)
  const startPrint = usePrint((s) => s.start)
  const others = papers.filter((p) => p.sections.length > 0)
  const [scope, setScope] = useState<'one' | 'all'>('one')
  const [copies, setCopies] = useState(1)
  const [busy, setBusy] = useState(false)

  const chosen = expand(scope === 'all' ? others : [paper])
  const sets = paper.sets && paper.sets.count > 1 ? paper.sets.count : 1
  const name = safeName(scope === 'all' ? `Question papers (${others.length})` : `${paper.name}${sets > 1 ? ` – ${sets} sets` : ''}`)

  const run = async () => {
    if (!kind) return
    setBusy(true)
    try {
      if (kind === 'print') {
        onClose()
        startPrint(chosen, copies)
        return
      }
      if (kind === 'pdf') await downloadPdf(chosen, name, copies)
      else await downloadDocx(chosen, name)
      toast('success', `${kind === 'pdf' ? 'PDF' : 'Word file'} downloaded: ${name}`)
      onClose()
    } catch (e) {
      console.error(e)
      toast('error', `Could not create the file: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  const title = kind === 'print' ? 'Print paper' : kind === 'pdf' ? 'Download PDF' : 'Download Word file'
  const Icon = kind === 'print' ? Printer : kind === 'pdf' ? FileDown : FileText

  return (
    <Modal open={!!kind} onClose={onClose} title={title}>
      <div className="space-y-5">
        {others.length > 1 && (
          <fieldset>
            <legend className="mb-2 text-[13px] font-semibold">What to include</legend>
            <div className="grid grid-cols-2 gap-2">
              {([['one', `This paper`, paper.name], ['all', `All ${others.length} papers`, others.map((p) => p.name).join(', ')]] as const).map(([v, label, sub]) => (
                <label key={v} className={`cursor-pointer rounded-2xl p-3 ring-2 transition ${scope === v ? 'bg-ink-50 ring-ink-600 dark:bg-white/10 dark:ring-ink-400' : 'ring-ink-100 hover:ring-ink-300 dark:ring-white/10'}`}>
                  <input type="radio" name="scope" value={v} checked={scope === v} onChange={() => setScope(v)} className="sr-only" />
                  <span className="block text-sm font-semibold">{label}</span>
                  <span className="block truncate text-xs text-ink-500">{sub}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {kind !== 'docx' && (
          <div>
            <label htmlFor="copies" className="mb-2 block text-[13px] font-semibold">
              {chosen.length > 1 ? 'Copies of each paper / set' : 'Number of copies (students)'}
            </label>
            <div className="flex items-center gap-2">
              <Button size="icon" onClick={() => setCopies((c) => Math.max(1, c - 1))} aria-label="Fewer copies">−</Button>
              <input id="copies" type="number" min={1} max={500} className={`${inputCls} w-24 text-center text-lg font-semibold`} value={copies} onChange={(e) => setCopies(Math.max(1, Math.min(500, +e.target.value || 1)))} />
              <Button size="icon" onClick={() => setCopies((c) => Math.min(500, c + 1))} aria-label="More copies">+</Button>
              <div className="ml-2 flex flex-wrap gap-1">
                {[20, 30, 40, 50].map((n) => <Button key={n} size="sm" variant={copies === n ? 'primary' : 'ghost'} onClick={() => setCopies(n)}>{n}</Button>)}
              </div>
            </div>
            <p className="mt-2 text-xs text-ink-500 dark:text-ink-300">
              {kind === 'print'
                ? 'Tip: you can also keep this at 1 and set “Copies” in the printer dialog — that is faster for very large numbers.'
                : 'Each copy is added to the PDF so you can send one file to the photocopy shop or printer.'}
            </p>
          </div>
        )}

        <motion.div layout className="rounded-2xl bg-paper-2/70 p-4 text-sm dark:bg-white/5">
          <p className="font-semibold">Summary</p>
          <p className="mt-1 text-ink-600 dark:text-ink-300">
            {chosen.length} paper{chosen.length > 1 ? 's' : ''}{sets > 1 && scope === 'one' ? ` (Sets ${chosen.map((c) => c.setLabel).join(', ')})` : ''}
            {kind !== 'docx' && copies > 1 ? ` × ${copies} copies = ${chosen.length * copies} papers` : ''} · A4
          </p>
          {kind === 'docx' && <p className="mt-1 text-xs text-ink-500">Maths is converted to readable text (e.g. ¾, √49, H₂SO₄). For exact equation typesetting use PDF.</p>}
        </motion.div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="lg" onClick={run} disabled={busy} icon={busy ? <Loader2 size={18} className="animate-spin" /> : <Icon size={18} />}>
            {busy ? 'Preparing…' : kind === 'print' ? 'Print now' : 'Download'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
