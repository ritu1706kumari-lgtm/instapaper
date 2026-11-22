import { AnimatePresence, motion } from 'motion/react'
import { ChevronDown, ChevronUp, Minus, Plus, Trash2, BookOpen, Wand2 } from 'lucide-react'
import type { BookSettings, Paper, PatternRow, PatternType } from '../types'
import { useStore } from '../store'
import { Button, inputCls } from './ui'
import { PRESETS, TYPE_INFO, defaultBook, fmtMark, patternTotal } from '../lib/pattern'
import { uid } from '../lib/id'

function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: [T, string][]; label: string }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-[13px] font-semibold">{label}</legend>
      <div className="flex rounded-xl bg-ink-50 p-1 ring-1 ring-ink-100 dark:bg-white/5 dark:ring-white/10">
        {options.map(([v, l]) => (
          <label key={v} className={`relative flex-1 cursor-pointer rounded-lg px-2 py-1.5 text-center text-sm font-medium transition focus-within:ring-2 focus-within:ring-marigold ${value === v ? 'text-white' : 'text-ink-600 hover:text-ink-900 dark:text-ink-300'}`}>
            <input type="radio" className="sr-only" checked={value === v} onChange={() => onChange(v)} name={label} />
            {value === v && <motion.span layoutId={`seg-${label}`} className="absolute inset-0 rounded-lg bg-ink-800 dark:bg-ink-500" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
            <span className="relative">{l}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export function BookPattern({ paper }: { paper: Paper }) {
  const updatePaper = useStore((s) => s.updatePaper)
  const setHeader = useStore((s) => s.setHeader)
  const book = paper.book ?? defaultBook()
  const setBook = (patch: Partial<BookSettings>) => updatePaper(paper.id, (p) => ({ ...p, book: { ...(p.book ?? defaultBook()), ...patch } }))
  const setRow = (id: string, patch: Partial<PatternRow>) => setBook({ pattern: book.pattern.map((r) => (r.id === id ? { ...r, ...patch } : r)) })
  const move = (i: number, d: -1 | 1) => { const a = [...book.pattern]; const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; setBook({ pattern: a }) }
  const total = patternTotal(book.pattern)
  const count = book.pattern.reduce((n, r) => n + r.count, 0)
  const h = paper.header

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
      {/* ---- pattern ---- */}
      <section aria-labelledby="pat-h" className="rounded-3xl bg-white p-5 ring-1 ring-ink-100 dark:bg-white/5 dark:ring-white/10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 id="pat-h" className="flex items-center gap-2 font-display text-xl font-semibold"><Wand2 size={20} className="text-marigold" aria-hidden /> Question pattern</h2>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Ready-made patterns">
            {PRESETS.map((p) => (
              <Button key={p.name} size="sm" variant="ghost" className="ring-1 ring-ink-100 dark:ring-white/10" onClick={() => setBook({ pattern: p.rows() })}>{p.name}</Button>
            ))}
          </div>
        </div>

        <div className="hidden grid-cols-[1fr_120px_110px_70px_96px] gap-2 px-1 pb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-400 sm:grid">
          <span>Question type</span><span className="text-center">How many</span><span className="text-center">Marks each</span><span className="text-right">Total</span><span />
        </div>
        <ul className="space-y-2">
          <AnimatePresence initial={false}>
            {book.pattern.map((r, i) => (
              <motion.li
                key={r.id} layout initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20, height: 0 }}
                className="grid grid-cols-2 items-center gap-2 rounded-2xl bg-ink-50/70 p-2 sm:grid-cols-[1fr_120px_110px_70px_96px] dark:bg-black/20"
              >
                <label className="col-span-2 sm:col-span-1">
                  <span className="sr-only">Question type for section {i + 1}</span>
                  <select className={`${inputCls} font-medium`} value={r.type} onChange={(e) => { const type = e.target.value as PatternType; setRow(r.id, { type, marks: TYPE_INFO[type].marks }) }}>
                    {(Object.keys(TYPE_INFO) as PatternType[]).map((t) => <option key={t} value={t}>{i + 1}. {TYPE_INFO[t].label}</option>)}
                  </select>
                </label>
                <div className="flex items-center justify-center gap-1">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setRow(r.id, { count: Math.max(1, r.count - 1) })} aria-label={`Fewer questions in section ${i + 1}`}><Minus size={14} /></Button>
                  <input aria-label={`Number of questions in section ${i + 1}`} type="number" min={1} max={40} className={`${inputCls} w-12 px-1 text-center font-semibold`} value={r.count} onChange={(e) => setRow(r.id, { count: Math.max(1, Math.min(40, Math.round(+e.target.value) || 1)) })} />
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setRow(r.id, { count: Math.min(40, r.count + 1) })} aria-label={`More questions in section ${i + 1}`}><Plus size={14} /></Button>
                </div>
                <label className="flex items-center justify-center gap-1 text-xs text-ink-500">
                  <span className="sm:hidden">Marks</span>
                  <input aria-label={`Marks for each question in section ${i + 1}`} type="number" min={0.5} max={20} step={0.5} className={`${inputCls} w-16 text-center font-semibold`} value={r.marks} onChange={(e) => setRow(r.id, { marks: Math.max(0.5, Math.min(20, +e.target.value || 1)) })} />
                </label>
                <span className="text-right text-sm font-bold tabular-nums">{fmtMark(r.marks * r.count)}</span>
                <span className="col-span-2 flex justify-end sm:col-span-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move section ${i + 1} up`}><ChevronUp size={15} /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => move(i, 1)} disabled={i === book.pattern.length - 1} aria-label={`Move section ${i + 1} down`}><ChevronDown size={15} /></Button>
                  <Button variant="danger" size="icon" className="h-8 w-8" onClick={() => setBook({ pattern: book.pattern.filter((x) => x.id !== r.id) })} disabled={book.pattern.length === 1} aria-label={`Remove section ${i + 1}`}><Trash2 size={14} /></Button>
                </span>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <Button size="sm" icon={<Plus size={14} />} onClick={() => setBook({ pattern: [...book.pattern, { id: uid(), type: 'short', count: 5, marks: 2 }] })}>Add question type</Button>
          <motion.p key={total} initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="rounded-full bg-ink-800 px-4 py-1.5 text-sm font-semibold text-white dark:bg-ink-500" role="status">
            {count} questions · Total {fmtMark(total)} marks
          </motion.p>
        </div>
      </section>

      {/* ---- details & options ---- */}
      <aside className="space-y-4 rounded-3xl bg-white p-5 ring-1 ring-ink-100 dark:bg-white/5 dark:ring-white/10" aria-label="Paper details">
        <h2 className="flex items-center gap-2 font-semibold"><BookOpen size={18} className="text-ink-500" aria-hidden /> Paper details</h2>
        <div className="grid grid-cols-2 gap-2">
          {([['className', 'Class', 'e.g. 6th'], ['subject', 'Subject', 'e.g. Science'], ['exam', 'Exam name', 'e.g. Unit Test 2'], ['time', 'Time', 'e.g. 1 Hour']] as const).map(([k, label, ph]) => (
            <label key={k} className="flex flex-col gap-1 text-xs font-semibold text-ink-600 dark:text-ink-300">{label}
              <input className={inputCls} placeholder={ph} value={h[k] as string} onChange={(e) => setHeader(paper.id, k, e.target.value)} />
            </label>
          ))}
          <label className="col-span-2 flex flex-col gap-1 text-xs font-semibold text-ink-600 dark:text-ink-300">Chapter name(s) <span className="font-normal text-ink-400">optional</span>
            <input className={inputCls} placeholder="e.g. Ch 3 – Fibre to Fabric" value={book.chapters} onChange={(e) => setBook({ chapters: e.target.value })} />
          </label>
        </div>
        <fieldset>
          <legend className="mb-1.5 text-[13px] font-semibold">Questions come from</legend>
          <div className="space-y-1.5">
            {([['mixed', 'Book first, AI fills gaps', 'Uses book exercises; writes new ones from the chapter if needed'], ['book', 'Only the book', 'Only questions from the exercises (may have fewer)'], ['new', 'All new questions', 'Fresh questions written from the chapter content']] as const).map(([v, t, d]) => (
              <label key={v} className={`flex cursor-pointer gap-3 rounded-xl p-2.5 ring-1 transition focus-within:ring-2 focus-within:ring-marigold ${book.source === v ? 'bg-ink-50 ring-ink-500 dark:bg-white/10 dark:ring-ink-400' : 'ring-ink-100 hover:ring-ink-300 dark:ring-white/10'}`}>
                <input type="radio" name="source" className="mt-1 accent-ink-700" checked={book.source === v} onChange={() => setBook({ source: v })} />
                <span><span className="block text-sm font-semibold">{t}</span><span className="block text-xs text-ink-500 dark:text-ink-300">{d}</span></span>
              </label>
            ))}
          </div>
        </fieldset>
        <Segmented label="Difficulty" value={book.difficulty} onChange={(v) => setBook({ difficulty: v })} options={[['easy', 'Easy'], ['mixed', 'Mixed'], ['hard', 'Hard']]} />
        <Segmented label="Language" value={book.language} onChange={(v) => setBook({ language: v })} options={[['same', 'Same as book'], ['en', 'English'], ['hi', 'हिंदी']]} />
      </aside>
    </div>
  )
}
