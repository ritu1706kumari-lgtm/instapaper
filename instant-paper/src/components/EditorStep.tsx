import { useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { CheckCircle2, AlertTriangle, FileDown, FileText, Layers, LayoutTemplate, ListChecks, Minus, Plus, Printer, Shuffle, Eye, PencilLine, Maximize2, RefreshCw } from 'lucide-react'
import type { Paper, SetOptions } from '../types'
import { useStore } from '../store'
import { PaperView } from './PaperView'
import { QuestionsPanel, SymbolBar } from './QuestionsPanel'
import { DiagramPicker } from './DiagramPicker'
import { ExportDialog, type ExportKind } from './ExportDialog'
import { ScaledPaper, usePageBreaks } from './ScaledPaper'
import { Button, Toggle } from './ui'
import { TEMPLATES } from '../lib/templates'
import { fmt, paperTotal, parseMarks } from '../lib/marks'
import { makeSets, setLetter } from '../lib/shuffle'

const DEFAULT_SETS: SetOptions = { count: 1, shuffleQuestions: true, shuffleOptions: true, shuffleMatch: true, shuffleSections: false }

export function EditorStep({ paper }: { paper: Paper }) {
  const updatePaper = useStore((s) => s.updatePaper)
  const setView = useStore((s) => s.setView)
  const generate = useStore((s) => s.generate)
  const [tab, setTab] = useState<'questions' | 'layout' | 'sets'>('questions')
  const [diagramFor, setDiagramFor] = useState<{ sid: string; qid: string } | null>(null)
  const [exportKind, setExportKind] = useState<ExportKind | null>(null)
  const [zoom, setZoom] = useState<number | undefined>(undefined)
  const [viewSet, setViewSet] = useState(0)
  const [mobilePreview, setMobilePreview] = useState(false)
  const paperRef = useRef<HTMLDivElement>(null)

  const sets = paper.sets ?? DEFAULT_SETS
  const setVariants = useMemo(() => (sets.count > 1 ? makeSets(paper, sets) : null), [paper, sets])
  const shown = setVariants && viewSet > 0 ? setVariants[Math.min(viewSet, setVariants.length - 1)] : setVariants ? { ...paper, setLabel: 'A' } : paper
  const editable = !setVariants || viewSet === 0

  const total = paperTotal(paper.sections)
  const mm = parseMarks(paper.header.maxMarks)
  const marksOk = mm == null || Math.abs(total - mm) < 0.01
  const breaks = usePageBreaks(paperRef, [shown, zoom])

  const TABS = [
    { id: 'questions', label: 'Questions', icon: ListChecks },
    { id: 'layout', label: 'Layout', icon: LayoutTemplate },
    { id: 'sets', label: 'Sets A/B', icon: Shuffle },
  ] as const

  return (
    <div className="mx-auto max-w-[1600px]">
      {/* toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          aria-label="Paper name (used for file names)"
          className="min-w-0 basis-full sm:basis-0 flex-1 rounded-xl bg-transparent px-2 py-1 font-display text-2xl font-semibold tracking-tight transition hover:bg-white/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-ink-400 sm:text-3xl dark:hover:bg-white/5 dark:focus:bg-white/5"
          value={paper.name} onChange={(e) => updatePaper(paper.id, (p) => ({ ...p, name: e.target.value }))}
        />
        {paper.sections.length > 0 && (
          <motion.span
            key={String(marksOk)} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${marksOk ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-500/30' : 'bg-amber-50 text-amber-900 ring-1 ring-amber-300 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/30'}`}
            role="status"
          >
            {marksOk ? <CheckCircle2 size={14} aria-hidden /> : <AlertTriangle size={14} aria-hidden />}
            {mm == null ? `Total ${fmt(total)} marks` : marksOk ? `Marks add up: ${fmt(total)} / ${fmt(mm)}` : `Sections total ${fmt(total)}, but M.M is ${fmt(mm)}`}
          </motion.span>
        )}
        <div className="flex gap-2">
          {(paper.mode === 'book' || paper.mode === 'previous') && (paper.photos.length > 0 || !!paper.docs?.length) && (
            <Button variant="accent" icon={<RefreshCw size={16} />} title="Same pattern, a different set of questions" onClick={() => { if (!confirm('Replace the current questions with a new set (same pattern)? Your edits to this paper will be lost.')) return; setView(paper.id, 'template'); void generate(paper.id) }}>New questions</Button>
          )}
          <Button variant="primary" icon={<Printer size={16} />} onClick={() => setExportKind('print')} disabled={!paper.sections.length}>Print</Button>
          <Button icon={<FileDown size={16} />} onClick={() => setExportKind('pdf')} disabled={!paper.sections.length}>PDF</Button>
          <Button icon={<FileText size={16} />} onClick={() => setExportKind('docx')} disabled={!paper.sections.length}>Word</Button>
        </div>
      </div>

      <div className="mb-3 flex gap-2 lg:hidden">
        <Button size="sm" variant={!mobilePreview ? 'primary' : 'secondary'} icon={<PencilLine size={14} />} onClick={() => setMobilePreview(false)}>Edit</Button>
        <Button size="sm" variant={mobilePreview ? 'primary' : 'secondary'} icon={<Eye size={14} />} onClick={() => setMobilePreview(true)}>Preview</Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(380px,460px)_1fr]">
        {/* -------- left panel -------- */}
        <aside className={`${mobilePreview ? 'hidden lg:block' : ''} min-w-0 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:pr-1 scrollbar-thin`} aria-label="Edit paper">
          <div role="tablist" aria-label="Editor sections" className="sticky top-0 z-10 mb-3 flex gap-1 rounded-2xl bg-paper/90 p-1 ring-1 ring-ink-100 backdrop-blur dark:bg-[#10121b]/90 dark:ring-white/10">
            {TABS.map((t) => (
              <button
                key={t.id} role="tab" aria-selected={tab === t.id} aria-controls={`panel-${t.id}`} id={`tabbtn-${t.id}`} onClick={() => setTab(t.id)}
                className={`relative flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl text-sm font-medium transition ${tab === t.id ? 'text-ink-950 dark:text-white' : 'text-ink-500 hover:text-ink-800 dark:text-ink-300'}`}
              >
                {tab === t.id && <motion.span layoutId="ed-tab" className="absolute inset-0 rounded-xl bg-white shadow-sm dark:bg-white/10" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                <t.icon size={15} className="relative" aria-hidden />
                <span className="relative">{t.label}</span>
                {t.id === 'sets' && sets.count > 1 && <span className="relative rounded-full bg-marigold px-1.5 text-[10px] font-bold text-ink-950">{sets.count}</span>}
              </button>
            ))}
          </div>
          {tab === 'questions' && (
            <div className="sticky top-12 z-[9] mb-3 rounded-2xl bg-paper/95 p-2 ring-1 ring-ink-100 backdrop-blur dark:bg-[#10121b]/95 dark:ring-white/10"><SymbolBar /></div>
          )}
          <AnimatePresence mode="wait">
            <motion.div key={tab} id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tabbtn-${tab}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.16 }}>
              {tab === 'questions' && <QuestionsPanel paper={paper} onPickDiagram={(sid, qid) => setDiagramFor({ sid, qid })} />}
              {tab === 'layout' && <LayoutPanel paper={paper} />}
              {tab === 'sets' && <SetsPanel paper={paper} sets={sets} onView={setViewSet} />}
            </motion.div>
          </AnimatePresence>
        </aside>

        {/* -------- preview -------- */}
        <section className={`${mobilePreview ? '' : 'hidden lg:block'} min-w-0`} aria-label="Live preview">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm text-ink-500 dark:text-ink-300">
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" aria-hidden />Live preview</span>
              {editable && <span className="hidden xl:inline">· click any text on the page to edit it</span>}
            </div>
            <div className="flex items-center gap-1">
              {setVariants && (
                <div className="mr-2 flex rounded-xl bg-white p-0.5 ring-1 ring-ink-100 dark:bg-white/5 dark:ring-white/10" role="group" aria-label="Preview set">
                  {setVariants.map((_, i) => (
                    <button key={i} onClick={() => setViewSet(i)} aria-pressed={viewSet === i} className={`h-7 rounded-lg px-2.5 text-xs font-semibold transition ${viewSet === i ? 'bg-ink-800 text-white dark:bg-ink-500' : 'text-ink-600 hover:bg-ink-50 dark:text-ink-200 dark:hover:bg-white/10'}`}>Set {setLetter(i)}</button>
                  ))}
                </div>
              )}
              <Button variant="ghost" size="icon" onClick={() => setZoom((z) => Math.max(0.4, (z ?? 0.8) - 0.1))} aria-label="Zoom out"><Minus size={16} /></Button>
              <span className="w-12 text-center text-xs tabular-nums text-ink-500" aria-live="polite">{zoom ? `${Math.round(zoom * 100)}%` : 'Fit'}</span>
              <Button variant="ghost" size="icon" onClick={() => setZoom((z) => Math.min(1.6, (z ?? 0.8) + 0.1))} aria-label="Zoom in"><Plus size={16} /></Button>
              <Button variant="ghost" size="icon" onClick={() => setZoom(undefined)} aria-label="Fit to width" title="Fit to width"><Maximize2 size={15} /></Button>
            </div>
          </div>
          <div className="overflow-x-auto rounded-3xl bg-paper-2/60 p-3 ring-1 ring-ink-900/5 sm:p-6 dark:bg-black/25 dark:ring-white/5">
            <ScaledPaper zoom={zoom} max={1.25}>
              <motion.div key={shown.id + shown.templateId} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 28 }} className="relative sheet-shadow" ref={paperRef}>
                <PaperView paper={shown} editable={editable} onDiagramClick={(sid, qid) => setDiagramFor({ sid, qid })} />
                {breaks.map((y, i) => (
                  <div key={i} className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-ink-300/70 no-print" style={{ top: y }} aria-hidden>
                    <span className="absolute right-2 -translate-y-1/2 rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-semibold text-ink-600">page {i + 2} ≈</span>
                  </div>
                ))}
              </motion.div>
            </ScaledPaper>
          </div>
          {!editable && <p className="mt-2 text-center text-xs text-ink-500">Set {setLetter(viewSet)} is generated from Set A — edit Set A and the other sets update automatically.</p>}
        </section>
      </div>

      <DiagramPicker paper={paper} target={diagramFor} onClose={() => setDiagramFor(null)} />
      <ExportDialog paper={paper} kind={exportKind} onClose={() => setExportKind(null)} />
    </div>
  )
}

function LayoutPanel({ paper }: { paper: Paper }) {
  const updatePaper = useStore((s) => s.updatePaper)
  const set = (patch: Partial<Paper>) => updatePaper(paper.id, (p) => ({ ...p, ...patch }))
  return (
    <div className="space-y-5">
      <fieldset className="space-y-2">
        <legend className="mb-2 text-[13px] font-semibold">Template</legend>
        {TEMPLATES.map((t) => (
          <label key={t.id} className={`flex cursor-pointer items-center gap-3 rounded-2xl bg-white p-3 ring-2 transition dark:bg-white/5 ${paper.templateId === t.id ? 'ring-ink-600 dark:ring-ink-400' : 'ring-transparent hover:ring-ink-200 dark:hover:ring-white/15'}`}>
            <input type="radio" name="tpl" className="sr-only" checked={paper.templateId === t.id} onChange={() => set({ templateId: t.id })} />
            <span className="h-8 w-1.5 rounded-full" style={{ background: t.accent }} aria-hidden />
            <span className="flex-1">
              <span className="block text-sm font-semibold">{t.name}</span>
              <span className="block text-xs text-ink-500 dark:text-ink-300">{t.tagline}</span>
            </span>
            {paper.templateId === t.id && <CheckCircle2 size={18} className="text-ink-600 dark:text-ink-300" aria-hidden />}
          </label>
        ))}
      </fieldset>

      <div className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-ink-100 dark:bg-white/5 dark:ring-white/10">
        <label htmlFor="fs" className="flex items-center justify-between text-sm font-semibold">Text size <span className="font-normal tabular-nums text-ink-500">{Math.round(paper.fontScale * 100)}%</span></label>
        <input id="fs" type="range" min={0.8} max={1.3} step={0.05} value={paper.fontScale} onChange={(e) => set({ fontScale: +e.target.value })} className="w-full accent-ink-600" />
        <p className="text-xs text-ink-500 dark:text-ink-300">Make it smaller to fit on one page, or bigger for young classes.</p>
        <div className="border-t border-ink-100 pt-2 dark:border-white/10">
          <Toggle id="sf" checked={paper.showStudentFields} onChange={(v) => set({ showStudentFields: v })} label="Show Name / Roll No. / Date lines" />
        </div>
      </div>
      <p className="text-xs text-ink-500 dark:text-ink-300">School name and logo for new papers can be changed in Settings.</p>
    </div>
  )
}

function SetsPanel({ paper, sets, onView }: { paper: Paper; sets: SetOptions; onView: (i: number) => void }) {
  const updatePaper = useStore((s) => s.updatePaper)
  const set = (patch: Partial<SetOptions>) => updatePaper(paper.id, (p) => ({ ...p, sets: { ...sets, ...patch } }))
  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-white p-4 ring-1 ring-ink-100 dark:bg-white/5 dark:ring-white/10">
        <div className="flex items-start gap-3">
          <Layers className="mt-0.5 shrink-0 text-marigold" aria-hidden />
          <p className="text-sm text-ink-700 dark:text-ink-200">Create different versions of the same paper so neighbouring students can’t copy. <b>Set A</b> is your original; other sets have the same questions in a shuffled order.</p>
        </div>
        <fieldset className="mt-4">
          <legend className="mb-2 text-[13px] font-semibold">Number of sets</legend>
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, 4].map((n) => (
              <button key={n} onClick={() => { set({ count: n }); onView(0) }} aria-pressed={sets.count === n} className={`h-14 rounded-2xl text-sm font-semibold ring-2 transition ${sets.count === n ? 'bg-ink-800 text-white ring-ink-800 dark:bg-ink-500 dark:ring-ink-500' : 'bg-white ring-ink-100 hover:ring-ink-300 dark:bg-white/5 dark:ring-white/10'}`}>
                {n === 1 ? 'Off' : <>{n}<span className="block text-[10px] font-medium opacity-70">A–{setLetter(n - 1)}</span></>}
              </button>
            ))}
          </div>
        </fieldset>
      </div>
      <AnimatePresence>
        {sets.count > 1 && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="space-y-1 rounded-2xl bg-white p-4 ring-1 ring-ink-100 dark:bg-white/5 dark:ring-white/10">
              <p className="mb-1 text-[13px] font-semibold">What to shuffle</p>
              <Toggle id="sq" checked={sets.shuffleQuestions} onChange={(v) => set({ shuffleQuestions: v })} label="Question order inside each section" />
              <Toggle id="so" checked={sets.shuffleOptions} onChange={(v) => set({ shuffleOptions: v })} label="MCQ options (a, b, c, d)" />
              <Toggle id="sm" checked={sets.shuffleMatch} onChange={(v) => set({ shuffleMatch: v })} label="Match-the-following columns" />
              <Toggle id="ss" checked={sets.shuffleSections} onChange={(v) => set({ shuffleSections: v })} label="Order of sections (Que 1, 2, 3…)" />
            </div>
            <p className="mt-3 text-xs text-ink-500 dark:text-ink-300">Print / PDF / Word will include all {sets.count} sets, each labelled “Set – A”, “Set – B”… in the corner. Use the Set buttons above the preview to check each one.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
