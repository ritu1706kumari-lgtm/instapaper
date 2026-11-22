import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronDown, ChevronUp, ImagePlus, ListPlus, Plus, Trash2, GitBranch, Sigma, X, AlertTriangle } from 'lucide-react'
import type { Paper, Question, Section, SectionType } from '../types'
import { useStore } from '../store'
import { uid } from '../lib/id'
import { Button, inputCls } from './ui'
import { getTemplate, sectionLabel } from '../lib/templates'
import { OPTION_LABELS } from '../lib/templates'

const TYPE_LABELS: Record<SectionType, string> = {
  list: 'Questions / short answer', mcq: 'Multiple choice', fill: 'Fill in the blanks', match: 'Match the following', truefalse: 'True / False', long: 'Long answer',
}
const DEFAULT_TITLES: Record<SectionType, string> = {
  list: 'Answer the following questions:', mcq: 'Choose the correct option:', fill: 'Fill in the blanks:', match: 'Match the following:', truefalse: 'Write True or False:', long: 'Answer in detail:',
}

/* ---------- Maths / symbol toolbar that types into the last focused field ---------- */
let lastField: HTMLInputElement | HTMLTextAreaElement | null = null
const remember = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => { lastField = e.currentTarget }

function insert(text: string, caretBack = 0) {
  const el = lastField
  if (!el || !document.body.contains(el)) return false
  el.focus()
  const ok = document.execCommand('insertText', false, text)
  if (!ok) {
    const s = el.selectionStart ?? el.value.length
    el.setRangeText(text, s, el.selectionEnd ?? s, 'end')
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }
  if (caretBack) { const p = (el.selectionStart ?? 0) - caretBack; el.setSelectionRange(p, p) }
  return true
}

const SYMBOLS: { label: string; text: string; back?: number; title: string }[] = [
  { label: '____', text: '____', title: 'Blank line' },
  { label: 'a⁄b', text: '$\\frac{}{}$', back: 4, title: 'Fraction' },
  { label: '√', text: '$\\sqrt{}$', back: 2, title: 'Square root' },
  { label: 'x²', text: '$^{2}$', back: 0, title: 'Power / square' },
  { label: '×', text: '×', title: 'Multiply' },
  { label: '÷', text: '÷', title: 'Divide' },
  { label: '°', text: '°', title: 'Degree' },
  { label: 'π', text: 'π', title: 'Pi' },
  { label: '≤', text: '≤', title: 'Less or equal' },
  { label: '≥', text: '≥', title: 'Greater or equal' },
  { label: '½', text: '½', title: 'Half' },
  { label: '✓', text: '✓', title: 'Tick mark' },
  { label: 'H₂O', text: '$\\ce{}$', back: 2, title: 'Chemical formula (type e.g. H2SO4)' },
  { label: '→', text: '→', title: 'Arrow' },
]

export function SymbolBar() {
  const toast = useStore((s) => s.toast)
  return (
    <div className="flex flex-wrap items-center gap-1" role="toolbar" aria-label="Insert maths and symbols">
      <Sigma size={15} className="mr-1 text-ink-400" aria-hidden />
      {SYMBOLS.map((s) => (
        <button
          key={s.title} type="button" title={s.title} aria-label={`Insert ${s.title}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => { if (!insert(s.text, s.back)) toast('info', 'Click inside a question box first, then insert.') }}
          className="h-7 min-w-7 rounded-lg bg-white px-1.5 text-[13px] font-medium ring-1 ring-ink-100 transition hover:-translate-y-px hover:bg-ink-50 hover:ring-ink-300 dark:bg-white/5 dark:ring-white/10 dark:hover:bg-white/10"
        >{s.label}</button>
      ))}
    </div>
  )
}

/* ---------- Panel ---------- */

export function QuestionsPanel({ paper, onPickDiagram }: { paper: Paper; onPickDiagram: (sid: string, qid: string) => void }) {
  const updatePaper = useStore((s) => s.updatePaper)
  const setHeader = useStore((s) => s.setHeader)
  const t = getTemplate(paper.templateId)
  const h = paper.header
  const [open, setOpen] = useState<Record<string, boolean>>({})

  const setSections = (fn: (s: Section[]) => Section[]) => updatePaper(paper.id, (p) => ({ ...p, sections: fn(p.sections) }))
  const addSection = (type: SectionType) => {
    const s: Section = {
      id: uid(), type, title: DEFAULT_TITLES[type], marks: '',
      questions: type === 'match' ? [] : [{ id: uid(), text: '', options: type === 'mcq' ? ['', '', '', ''] : undefined }],
      pairs: type === 'match' ? [{ id: uid(), left: '', right: '' }, { id: uid(), left: '', right: '' }] : undefined,
    }
    setSections((all) => [...all, s])
    setOpen((o) => ({ ...o, [s.id]: true }))
    setTimeout(() => document.getElementById(`sec-${s.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80)
  }

  return (
    <div className="space-y-5">
      <details className="group rounded-2xl bg-white ring-1 ring-ink-100 dark:bg-white/5 dark:ring-white/10" open={!h.subject}>
        <summary className="flex cursor-pointer list-none items-center justify-between rounded-2xl px-4 py-3 font-semibold hover:bg-ink-50/60 dark:hover:bg-white/5">
          Paper heading <ChevronDown size={16} className="transition group-open:rotate-180" aria-hidden />
        </summary>
        <div className="grid grid-cols-2 gap-3 px-4 pb-4">
          {([
            ['school', 'School name', 2], ['exam', 'Examination', 2], ['className', 'Class', 1], ['subject', 'Subject', 1], ['time', 'Time', 1], ['maxMarks', 'Maximum marks', 1],
          ] as const).map(([k, label, span]) => (
            <label key={k} className={`flex flex-col gap-1 text-xs font-semibold text-ink-600 dark:text-ink-300 ${span === 2 ? 'col-span-2' : ''}`}>
              {label}
              <input className={inputCls} value={h[k] as string} onFocus={remember} onChange={(e) => setHeader(paper.id, k, e.target.value)} />
            </label>
          ))}
          <label className="col-span-2 flex flex-col gap-1 text-xs font-semibold text-ink-600 dark:text-ink-300">
            General instructions (one per line, optional)
            <textarea
              className={`${inputCls} min-h-16 [field-sizing:content]`} value={h.instructions.join('\n')} onFocus={remember}
              onChange={(e) => setHeader(paper.id, 'instructions', e.target.value.split('\n'))}
              onBlur={(e) => setHeader(paper.id, 'instructions', e.target.value.split('\n').map((x) => x.trim()).filter(Boolean))}
            />
          </label>
        </div>
      </details>

      <ul className="space-y-3">
        <AnimatePresence initial={false}>
          {paper.sections.map((s, i) => (
            <motion.li key={s.id} id={`sec-${s.id}`} layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -30, height: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 34 }}>
              <SectionCard
                s={s} index={i} count={paper.sections.length} label={sectionLabel(t, i)}
                open={open[s.id] ?? paper.sections.length <= 3}
                onToggle={() => setOpen((o) => ({ ...o, [s.id]: !(o[s.id] ?? paper.sections.length <= 3) }))}
                onChange={(patch) => setSections((all) => all.map((x) => (x.id === s.id ? { ...x, ...patch } : x)))}
                onMove={(d) => setSections((all) => { const a = [...all]; const j = i + d; if (j < 0 || j >= a.length) return a; [a[i], a[j]] = [a[j], a[i]]; return a })}
                onDelete={() => { if (confirm(`Delete ${sectionLabel(t, i)} “${s.title}”?`)) setSections((all) => all.filter((x) => x.id !== s.id)) }}
                onPickDiagram={(qid) => onPickDiagram(s.id, qid)}
              />
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      <div className="rounded-2xl border-2 border-dashed border-ink-200 p-4 dark:border-white/10">
        <p className="mb-2 flex items-center gap-2 text-sm font-semibold"><ListPlus size={16} aria-hidden /> Add a question / section</p>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(TYPE_LABELS) as SectionType[]).map((k) => (
            <Button key={k} size="sm" icon={<Plus size={14} />} onClick={() => addSection(k)}>{TYPE_LABELS[k]}</Button>
          ))}
        </div>
      </div>
    </div>
  )
}

interface CardProps {
  s: Section; index: number; count: number; label: string; open: boolean
  onToggle: () => void; onChange: (p: Partial<Section>) => void; onMove: (d: -1 | 1) => void; onDelete: () => void; onPickDiagram: (qid: string) => void
}

function SectionCard({ s, index, count, label, open, onToggle, onChange, onMove, onDelete, onPickDiagram }: CardProps) {
  const setQ = (qid: string, patch: Partial<Question>) => onChange({ questions: s.questions.map((q) => (q.id === qid ? { ...q, ...patch } : q)) })
  const moveQ = (k: number, d: -1 | 1) => { const a = [...s.questions]; const j = k + d; if (j < 0 || j >= a.length) return; [a[k], a[j]] = [a[j], a[k]]; onChange({ questions: a }) }
  const addQ = () => {
    const q: Question = { id: uid(), text: '', options: s.type === 'mcq' ? ['', '', '', ''] : undefined }
    onChange({ questions: [...s.questions, q] })
    setTimeout(() => (document.getElementById(`q-${q.id}`) as HTMLTextAreaElement | null)?.focus(), 60)
  }
  const needs = s.questions.filter((q) => q.needsDiagram && !q.image).length

  return (
    <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-ink-100 transition-shadow focus-within:shadow-lg focus-within:ring-ink-300 dark:bg-white/5 dark:ring-white/10 dark:focus-within:ring-white/25">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button onClick={onToggle} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-2 rounded-lg p-1 text-left hover:bg-ink-50 dark:hover:bg-white/5">
          <ChevronDown size={16} className={`shrink-0 transition ${open ? '' : '-rotate-90'}`} aria-hidden />
          <span className="shrink-0 rounded-md bg-ink-800 px-1.5 py-0.5 text-[11px] font-bold text-white dark:bg-ink-500">{label}</span>
          <span className="truncate text-sm font-medium">{s.title || 'Untitled'}</span>
          {s.marks && <span className="shrink-0 text-xs text-ink-500">({s.marks})</span>}
          {needs > 0 && <span className="flex shrink-0 items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-[11px] font-semibold text-yellow-800" title="Needs a diagram"><AlertTriangle size={11} aria-hidden />{needs}</span>}
        </button>
        <Button variant="ghost" size="icon" onClick={() => onMove(-1)} disabled={index === 0} aria-label={`Move ${label} up`}><ChevronUp size={16} /></Button>
        <Button variant="ghost" size="icon" onClick={() => onMove(1)} disabled={index === count - 1} aria-label={`Move ${label} down`}><ChevronDown size={16} /></Button>
        <Button variant="danger" size="icon" onClick={onDelete} aria-label={`Delete ${label}`}><Trash2 size={15} /></Button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} className="overflow-hidden">
            <div className="space-y-3 border-t border-ink-100 px-3 pb-3 pt-3 dark:border-white/10">
              <div className="grid grid-cols-[1fr_110px] gap-2">
                <label className="flex flex-col gap-1 text-xs font-semibold text-ink-600 dark:text-ink-300">Instruction
                  <input className={inputCls} value={s.title} onFocus={remember} onChange={(e) => onChange({ title: e.target.value })} />
                </label>
                <label className="flex flex-col gap-1 text-xs font-semibold text-ink-600 dark:text-ink-300">Marks
                  <input className={inputCls} value={s.marks} placeholder="e.g. 1×5=5" onFocus={remember} onChange={(e) => onChange({ marks: e.target.value })} />
                </label>
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold text-ink-600 dark:text-ink-300">Type
                <select
                  className={`${inputCls} h-8 py-0`} value={s.type}
                  onChange={(e) => {
                    const type = e.target.value as SectionType
                    onChange({
                      type,
                      pairs: type === 'match' && !s.pairs?.length ? s.questions.map((q) => ({ id: uid(), left: q.text, right: '' })) : s.pairs,
                      questions: type === 'mcq' ? s.questions.map((q) => ({ ...q, options: q.options?.length ? q.options : ['', '', '', ''] })) : s.questions,
                    })
                  }}
                >
                  {(Object.keys(TYPE_LABELS) as SectionType[]).map((k) => <option key={k} value={k}>{TYPE_LABELS[k]}</option>)}
                </select>
              </label>

              {s.type === 'match' ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-[20px_1fr_1fr_32px] gap-2 text-[11px] font-semibold uppercase tracking-wide text-ink-400"><span /><span>Column A</span><span>Column B</span><span /></div>
                  {(s.pairs ?? []).map((p, k) => (
                    <div key={p.id} className="grid grid-cols-[20px_1fr_1fr_32px] items-center gap-2">
                      <span className="text-xs text-ink-400">{k + 1}.</span>
                      <input aria-label={`Column A item ${k + 1}`} className={inputCls} value={p.left} onFocus={remember} onChange={(e) => onChange({ pairs: s.pairs!.map((x) => (x.id === p.id ? { ...x, left: e.target.value } : x)) })} />
                      <input aria-label={`Column B item ${k + 1}`} className={inputCls} value={p.right} onFocus={remember} onChange={(e) => onChange({ pairs: s.pairs!.map((x) => (x.id === p.id ? { ...x, right: e.target.value } : x)) })} />
                      <Button variant="danger" size="icon" className="h-8 w-8" onClick={() => onChange({ pairs: s.pairs!.filter((x) => x.id !== p.id) })} aria-label={`Delete pair ${k + 1}`}><X size={14} /></Button>
                    </div>
                  ))}
                  <Button size="sm" variant="ghost" icon={<Plus size={14} />} onClick={() => onChange({ pairs: [...(s.pairs ?? []), { id: uid(), left: '', right: '' }] })}>Add pair</Button>
                </div>
              ) : (
                <ol className="space-y-2">
                  {s.questions.map((q, k) => (
                    <li key={q.id} className="group rounded-xl bg-ink-50/60 p-2 dark:bg-black/20">
                      <div className="flex items-start gap-2">
                        <span className="mt-2 w-5 shrink-0 text-right text-xs font-semibold text-ink-400">{k + 1}.</span>
                        <textarea
                          id={`q-${q.id}`} aria-label={`Question ${k + 1} text`} rows={1}
                          className={`${inputCls} min-h-9 resize-none [field-sizing:content]`} value={q.text} placeholder="Type the question… use ____ for a blank"
                          onFocus={remember} onChange={(e) => setQ(q.id, { text: e.target.value })}
                          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); addQ() } }}
                        />
                      </div>
                      {q.options && (
                        <div className="mt-2 grid grid-cols-2 gap-1.5 pl-7">
                          {q.options.map((o, oi) => (
                            <div key={oi} className="flex items-center gap-1">
                              <span className="w-6 text-xs text-ink-400">{OPTION_LABELS[oi]}</span>
                              <input aria-label={`Question ${k + 1} option ${OPTION_LABELS[oi]}`} className={`${inputCls} h-8 py-1`} value={o} onFocus={remember} onChange={(e) => setQ(q.id, { options: q.options!.map((x, xi) => (xi === oi ? e.target.value : x)) })} />
                            </div>
                          ))}
                        </div>
                      )}
                      {q.orText !== undefined && (
                        <div className="mt-2 flex items-start gap-2 pl-7">
                          <span className="mt-2 text-xs font-bold text-ink-500">OR</span>
                          <textarea aria-label={`Question ${k + 1} OR alternative`} rows={1} className={`${inputCls} resize-none [field-sizing:content]`} value={q.orText} onFocus={remember} onChange={(e) => setQ(q.id, { orText: e.target.value })} />
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setQ(q.id, { orText: undefined })} aria-label="Remove OR question"><X size={14} /></Button>
                        </div>
                      )}
                      {q.image && (
                        <div className="mt-2 flex items-center gap-2 pl-7">
                          <img src={q.image} alt={`Diagram for question ${k + 1}`} className="h-16 rounded-lg bg-white object-contain ring-1 ring-ink-100" />
                          <Button variant="danger" size="sm" onClick={() => setQ(q.id, { image: undefined })}>Remove diagram</Button>
                        </div>
                      )}
                      <div className="mt-1.5 flex flex-wrap items-center gap-1 pl-7 opacity-80 transition group-focus-within:opacity-100 group-hover:opacity-100">
                        <input aria-label={`Marks for question ${k + 1}`} className={`${inputCls} h-7 w-20 py-0 text-xs`} placeholder="marks" value={q.marks ?? ''} onChange={(e) => setQ(q.id, { marks: e.target.value || undefined })} />
                        <Button size="sm" variant={q.needsDiagram && !q.image ? 'accent' : 'ghost'} className="h-7" icon={<ImagePlus size={13} />} onClick={() => onPickDiagram(q.id)}>{q.image ? 'Change' : 'Diagram'}</Button>
                        {s.type !== 'mcq' && !q.options && <Button size="sm" variant="ghost" className="h-7" onClick={() => setQ(q.id, { options: ['', '', '', ''] })}>+ Options</Button>}
                        {q.options && s.type !== 'mcq' && <Button size="sm" variant="ghost" className="h-7" onClick={() => setQ(q.id, { options: undefined })}>− Options</Button>}
                        {q.orText === undefined && <Button size="sm" variant="ghost" className="h-7" icon={<GitBranch size={13} />} onClick={() => setQ(q.id, { orText: '' })}>OR</Button>}
                        <span className="ml-auto flex">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveQ(k, -1)} disabled={k === 0} aria-label={`Move question ${k + 1} up`}><ChevronUp size={14} /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveQ(k, 1)} disabled={k === s.questions.length - 1} aria-label={`Move question ${k + 1} down`}><ChevronDown size={14} /></Button>
                          <Button variant="danger" size="icon" className="h-7 w-7" onClick={() => onChange({ questions: s.questions.filter((x) => x.id !== q.id) })} aria-label={`Delete question ${k + 1}`}><Trash2 size={13} /></Button>
                        </span>
                      </div>
                    </li>
                  ))}
                  <li><Button size="sm" variant="ghost" icon={<Plus size={14} />} onClick={addQ}>Add question <kbd className="ml-1 hidden rounded bg-ink-100 px-1 text-[10px] text-ink-500 sm:inline dark:bg-white/10">Ctrl+Enter</kbd></Button></li>
                </ol>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
