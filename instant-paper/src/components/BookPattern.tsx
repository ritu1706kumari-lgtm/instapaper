import { AnimatePresence, motion } from 'motion/react'
import { ChevronDown, ChevronUp, Minus, Plus, Trash2, BookOpen, Wand2, SlidersHorizontal } from 'lucide-react'
import type { BookSettings, Paper, PatternRow, PatternType, SubjectKind } from '../types'
import { useStore } from '../store'
import { Button, inputCls } from './ui'
import { SUBJECTS, TYPE_INFO, defaultBook, detectSubject, fmtMark, patternTotal } from '../lib/pattern'
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

const Step = ({ n, title, icon, children, id }: { n: number; title: string; icon: React.ReactNode; children: React.ReactNode; id: string }) => (
  <section aria-labelledby={id} className="rounded-3xl bg-white p-5 ring-1 ring-ink-100 dark:bg-white/5 dark:ring-white/10">
    <h2 id={id} className="mb-4 flex items-center gap-2 font-display text-xl font-semibold">
      <span className="grid h-7 w-7 place-items-center rounded-full bg-ink-800 text-sm font-bold text-white dark:bg-ink-500" aria-hidden>{n}</span>
      {icon} {title}
    </h2>
    {children}
  </section>
)

export function BookPattern({ paper }: { paper: Paper }) {
  const updatePaper = useStore((s) => s.updatePaper)
  const setHeader = useStore((s) => s.setHeader)
  const toast = useStore((s) => s.toast)
  const book = paper.book ?? defaultBook()
  const kind: SubjectKind = book.subject ?? 'general'
  const subj = SUBJECTS[kind]
  const setBook = (patch: Partial<BookSettings>) => updatePaper(paper.id, (p) => ({ ...p, book: { ...(p.book ?? defaultBook()), ...(patch.pattern && patch.touched === undefined ? { touched: true } : {}), ...patch } }))
  const setRow = (id: string, patch: Partial<PatternRow>) => setBook({ pattern: book.pattern.map((r) => (r.id === id ? { ...r, ...patch } : r)) })
  const move = (i: number, d: -1 | 1) => { const a = [...book.pattern]; const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; setBook({ pattern: a }) }
  const total = patternTotal(book.pattern)
  const count = book.pattern.reduce((n, r) => n + r.count, 0)
  const h = paper.header
  const others = (Object.keys(TYPE_INFO) as PatternType[]).filter((t) => !subj.types.includes(t))

  const chooseSubject = (k: SubjectKind, auto = false) => {
    if (k === kind) return
    const next = SUBJECTS[k]
    const language = next.language ?? (book.language === 'hi' ? 'same' : book.language)
    // Typed subject: never overwrite a pattern the teacher already set up by hand.
    if (auto && book.touched) { setBook({ subject: k, language }); return }
    setBook({ subject: k, pattern: next.presets[0].rows(), language, touched: false })
    if (auto) toast('info', `Question types are now set for ${next.label}. Change them below if you like.`)
  }

  return (
    <div className="space-y-5">
      {/* 1. class & subject */}
      <Step n={1} id="st-1" title="Class & subject" icon={<BookOpen size={18} className="text-ink-500" aria-hidden />}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="flex flex-col gap-1 text-xs font-semibold text-ink-600 dark:text-ink-300">Class
            <input className={inputCls} placeholder="e.g. 6th" value={h.className} onChange={(e) => setHeader(paper.id, 'className', e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-ink-600 dark:text-ink-300">Subject
            <input className={inputCls} placeholder="e.g. Maths" value={h.subject} onChange={(e) => setHeader(paper.id, 'subject', e.target.value)}
              onBlur={(e) => { const k = detectSubject(e.target.value); if (k && k !== 'general') chooseSubject(k, true) }} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-ink-600 dark:text-ink-300">Exam name
            <input className={inputCls} placeholder="e.g. Unit Test 2" value={h.exam} onChange={(e) => setHeader(paper.id, 'exam', e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-ink-600 dark:text-ink-300">Time
            <input className={inputCls} placeholder="e.g. 1 Hour" value={h.time} onChange={(e) => setHeader(paper.id, 'time', e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-ink-600 dark:text-ink-300">Chapter(s) <span className="sr-only">optional</span>
            <input className={inputCls} placeholder="optional, e.g. Ch 3" value={book.chapters} onChange={(e) => setBook({ chapters: e.target.value })} />
          </label>
        </div>
        <fieldset className="mt-4">
          <legend className="mb-2 text-[13px] font-semibold">Type of subject <span className="font-normal text-ink-500">— the question types change to suit it</span></legend>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(SUBJECTS) as SubjectKind[]).map((k) => (
              <label key={k} className={`relative flex cursor-pointer items-center gap-2 rounded-2xl px-3.5 py-2 text-sm font-semibold ring-2 transition focus-within:ring-marigold ${kind === k ? 'bg-ink-800 text-white ring-ink-800 dark:bg-ink-500 dark:ring-ink-500' : 'bg-white ring-ink-100 hover:-translate-y-0.5 hover:ring-ink-300 dark:bg-white/5 dark:ring-white/10'}`}>
                <input type="radio" name={`subj-${paper.id}`} className="sr-only" checked={kind === k} onChange={() => chooseSubject(k)} />
                <span aria-hidden className="text-base leading-none">{SUBJECTS[k].emoji}</span>
                <span>{SUBJECTS[k].label}</span>
                <span className={`text-xs font-normal ${kind === k ? 'text-white/70' : 'text-ink-400'}`}>{SUBJECTS[k].hi}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </Step>

      {/* 2. pattern */}
      <Step n={2} id="st-2" title={`Question pattern for ${subj.label}`} icon={<Wand2 size={18} className="text-marigold" aria-hidden />}>
        <div className="mb-3 flex flex-wrap items-center gap-1.5" role="group" aria-label="Ready-made patterns">
          <span className="mr-1 text-xs font-semibold text-ink-500">Quick start:</span>
          {subj.presets.map((p) => (
            <Button key={p.name} size="sm" variant="ghost" className="ring-1 ring-ink-100 dark:ring-white/10" onClick={() => setBook({ pattern: p.rows() })}>{p.name}</Button>
          ))}
        </div>

        <div className="hidden grid-cols-[1fr_120px_110px_70px_96px] gap-2 px-1 pb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-400 sm:grid">
          <span>Question type</span><span className="text-center">How many</span><span className="text-center">Marks each</span><span className="text-right">Total</span><span />
        </div>
        <ul className="space-y-2">
          <AnimatePresence initial={false}>
            {book.pattern.map((r, i) => {
              const info = TYPE_INFO[r.type]
              return (
                <motion.li
                  key={r.id} layout initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20, height: 0 }}
                  className="grid grid-cols-2 items-center gap-2 rounded-2xl bg-ink-50/70 p-2 sm:grid-cols-[1fr_120px_110px_70px_96px] dark:bg-black/20"
                >
                  <label className="col-span-2 sm:col-span-1">
                    <span className="sr-only">Question type for section {i + 1}</span>
                    <select className={`${inputCls} font-medium`} value={r.type} onChange={(e) => { const type = e.target.value as PatternType; setRow(r.id, { type, marks: TYPE_INFO[type].marks, count: TYPE_INFO[type].passage ? 5 : ['letter', 'essay', 'story'].includes(type) ? 1 : r.count }) }}>
                      <optgroup label={`For ${subj.label}`}>
                        {subj.types.map((t) => <option key={t} value={t}>{i + 1}. {TYPE_INFO[t].label} · {TYPE_INFO[t].hi}</option>)}
                      </optgroup>
                      {kind !== 'general' || others.length ? (
                        <optgroup label="Other types">
                          {others.map((t) => <option key={t} value={t}>{i + 1}. {TYPE_INFO[t].label} · {TYPE_INFO[t].hi}</option>)}
                        </optgroup>
                      ) : null}
                    </select>
                    {info.passage && <span className="mt-1 block pl-1 text-[11px] text-ink-500">One passage + the number of questions you choose</span>}
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
                  <span className="pl-2 text-sm font-bold tabular-nums sm:pl-0 sm:text-right"><span className="font-normal text-ink-500 sm:hidden">Total: </span>{fmtMark(r.marks * r.count)}</span>
                  <span className="flex justify-end">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move section ${i + 1} up`}><ChevronUp size={15} /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => move(i, 1)} disabled={i === book.pattern.length - 1} aria-label={`Move section ${i + 1} down`}><ChevronDown size={15} /></Button>
                    <Button variant="danger" size="icon" className="h-8 w-8" onClick={() => setBook({ pattern: book.pattern.filter((x) => x.id !== r.id) })} disabled={book.pattern.length === 1} aria-label={`Remove section ${i + 1}`}><Trash2 size={14} /></Button>
                  </span>
                </motion.li>
              )
            })}
          </AnimatePresence>
        </ul>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <Button size="sm" icon={<Plus size={14} />} onClick={() => setBook({ pattern: [...book.pattern, { id: uid(), type: subj.types.find((t) => !book.pattern.some((r) => r.type === t)) ?? 'short', count: 5, marks: 2 }] })}>Add question type</Button>
          <motion.p key={total} initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="rounded-full bg-ink-800 px-4 py-1.5 text-sm font-semibold text-white dark:bg-ink-500" role="status">
            {count} questions · Total {fmtMark(total)} marks
          </motion.p>
        </div>
      </Step>

      {/* 3. options */}
      <Step n={3} id="st-3" title="Options" icon={<SlidersHorizontal size={18} className="text-ink-500" aria-hidden />}>
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr_1fr]">
          <fieldset>
            <legend className="mb-1.5 text-[13px] font-semibold">Questions come from</legend>
            <div className="space-y-1.5">
              {([['mixed', 'Book first, AI fills gaps', 'Uses book exercises; writes new ones if needed'], ['book', 'Only the book', 'Only questions from the exercises'], ['new', 'All new questions', 'Fresh questions from the chapter content']] as const).map(([v, t, d]) => (
                <label key={v} className={`flex cursor-pointer gap-3 rounded-xl p-2.5 ring-1 transition focus-within:ring-2 focus-within:ring-marigold ${book.source === v ? 'bg-ink-50 ring-ink-500 dark:bg-white/10 dark:ring-ink-400' : 'ring-ink-100 hover:ring-ink-300 dark:ring-white/10'}`}>
                  <input type="radio" name={`source-${paper.id}`} className="mt-1 accent-ink-700" checked={book.source === v} onChange={() => setBook({ source: v })} />
                  <span><span className="block text-sm font-semibold">{t}</span><span className="block text-xs text-ink-500 dark:text-ink-300">{d}</span></span>
                </label>
              ))}
            </div>
          </fieldset>
          <Segmented label="Difficulty" value={book.difficulty} onChange={(v) => setBook({ difficulty: v })} options={[['easy', 'Easy'], ['mixed', 'Mixed'], ['hard', 'Hard']]} />
          <Segmented label="Language" value={book.language} onChange={(v) => setBook({ language: v })} options={[['same', 'As book'], ['en', 'English'], ['hi', 'हिंदी']]} />
        </div>
      </Step>
    </div>
  )
}
