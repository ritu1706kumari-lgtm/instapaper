import { motion } from 'motion/react'
import { ArrowRight, BookOpen, Camera, FileText, History, LayoutTemplate, PenLine, Printer, Trash2, Sparkles } from 'lucide-react'
import { useStore } from '../store'
import type { Paper } from '../types'

const CHOICES = [
  {
    mode: 'handwritten' as const, icon: PenLine, color: 'bg-ink-800 text-white dark:bg-ink-500',
    title: 'Type a handwritten paper', hi: 'हाथ से लिखा पेपर टाइप करें',
    body: 'A teacher wrote the paper by hand. Take photos — the app types it neatly.',
    need: 'You need: photos of the paper',
  },
  {
    mode: 'book' as const, icon: BookOpen, color: 'bg-marigold text-ink-950',
    title: 'Make a paper from the book', hi: 'किताब से पेपर बनाएं',
    body: 'Take photos of the chapter. Choose how many MCQs, short answers… The app makes the paper.',
    need: 'You need: photos of the chapter pages',
  },
  {
    mode: 'previous' as const, icon: History, color: 'bg-teal-600 text-white',
    title: 'Use an old paper', hi: 'पुराने पेपर से नया पेपर',
    body: 'Upload last year’s paper. Shuffle it, or get new questions in the same pattern.',
    need: 'You need: the old paper (photo, PDF or Word)',
  },
]

const MODE_ICON = { handwritten: PenLine, book: BookOpen, previous: History }

export function Home() {
  const addPaper = useStore((s) => s.addPaper)
  const papers = useStore((s) => s.papers)
  const openPaper = useStore((s) => s.openPaper)
  const removePaper = useStore((s) => s.removePaper)
  const sorted = [...papers].sort((a, b) => b.updatedAt - a.updatedAt)

  return (
    <div className="mx-auto max-w-6xl space-y-12 px-4 pb-16 pt-8 sm:px-6">
      <header className="text-center">
        <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
          What do you want to make today?
        </motion.h1>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="mt-2 text-lg text-ink-500 dark:text-ink-300" lang="hi">
          आज आप क्या बनाना चाहते हैं? — नीचे एक बटन दबाएं
        </motion.p>
      </header>

      <nav aria-label="Start a new paper" className="grid gap-5 md:grid-cols-3">
        {CHOICES.map((c, i) => (
          <motion.button
            key={c.mode}
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 * i, type: 'spring', stiffness: 260, damping: 24 }}
            whileHover={{ y: -6 }} whileTap={{ scale: 0.98 }}
            onClick={() => addPaper(undefined, c.mode)}
            className="group flex flex-col rounded-[2rem] bg-white p-6 text-left ring-1 ring-ink-100 sheet-shadow transition-shadow hover:shadow-2xl focus-visible:ring-4 focus-visible:ring-marigold dark:bg-white/5 dark:ring-white/10"
          >
            <span className={`mb-5 grid h-16 w-16 place-items-center rounded-2xl shadow-lg ${c.color}`}><c.icon size={30} aria-hidden /></span>
            <span className="font-display text-2xl font-semibold leading-tight">{c.title}</span>
            <span className="mt-1 text-base font-medium text-ink-500 dark:text-ink-300" lang="hi">{c.hi}</span>
            <span className="mt-3 flex-1 text-[15px] text-ink-700 dark:text-ink-200">{c.body}</span>
            <span className="mt-4 rounded-xl bg-ink-50 px-3 py-2 text-xs font-medium text-ink-600 dark:bg-white/5 dark:text-ink-300">{c.need}</span>
            <span className="mt-5 inline-flex items-center gap-2 font-semibold text-ink-800 dark:text-ink-100">
              Start <ArrowRight size={18} className="transition group-hover:translate-x-1" aria-hidden />
            </span>
          </motion.button>
        ))}
      </nav>

      <section aria-labelledby="how-h" className="rounded-[2rem] bg-white/60 p-6 ring-1 ring-ink-100 dark:bg-white/[0.03] dark:ring-white/10">
        <h2 id="how-h" className="mb-4 text-center text-sm font-semibold uppercase tracking-wider text-ink-500">How it works · कैसे काम करता है</h2>
        <ol className="grid gap-4 sm:grid-cols-3">
          {[
            [Camera, 'Add photos or a file', 'फ़ोटो या फ़ाइल जोड़ें'],
            [LayoutTemplate, 'Choose what you want', 'अपनी पसंद चुनें'],
            [Printer, 'Check & print', 'जाँचें और प्रिंट करें'],
          ].map(([Icon, t, h], i) => {
            const I = Icon as typeof Camera
            return (
              <li key={i} className="flex items-center gap-4">
                <span className="relative grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-ink-50 text-ink-700 dark:bg-white/10 dark:text-ink-100">
                  <I size={24} aria-hidden />
                  <span className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-marigold text-xs font-bold text-ink-950">{i + 1}</span>
                </span>
                <span><span className="block font-semibold">{t as string}</span><span className="block text-sm text-ink-500" lang="hi">{h as string}</span></span>
              </li>
            )
          })}
        </ol>
      </section>

      {sorted.length > 0 && (
        <section aria-labelledby="mine-h">
          <h2 id="mine-h" className="mb-4 font-display text-2xl font-semibold">Your papers <span className="text-base font-normal text-ink-500" lang="hi">· आपके पेपर</span></h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sorted.map((p, i) => <PaperCard key={p.id} p={p} i={i} onOpen={() => openPaper(p.id)} onDelete={() => { if (confirm(`Delete “${p.name}”?`)) removePaper(p.id) }} />)}
          </ul>
        </section>
      )}
    </div>
  )
}

function PaperCard({ p, i, onOpen, onDelete }: { p: Paper; i: number; onOpen: () => void; onDelete: () => void }) {
  const Icon = MODE_ICON[p.mode ?? 'handwritten'] ?? FileText
  const qs = p.sections.reduce((n, s) => n + (s.type === 'match' ? (s.pairs?.length ?? 0) : s.questions.length), 0)
  return (
    <motion.li initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.04 }}
      className="group flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-ink-100 transition hover:shadow-lg dark:bg-white/5 dark:ring-white/10">
      <button onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-1 text-left">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-ink-50 text-ink-600 dark:bg-white/10 dark:text-ink-200"><Icon size={22} aria-hidden /></span>
        <span className="min-w-0">
          <span className="block truncate font-semibold">{p.name}</span>
          <span className="block text-xs text-ink-500 dark:text-ink-300">
            {p.status === 'done' || qs ? <>{qs} questions · {new Date(p.updatedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</> : p.status === 'generating' ? <span className="inline-flex items-center gap-1"><Sparkles size={12} aria-hidden /> Working…</span> : 'Not finished yet'}
          </span>
        </span>
      </button>
      <button onClick={onDelete} className="rounded-lg p-2 text-ink-400 opacity-60 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 focus:opacity-100" aria-label={`Delete ${p.name}`}><Trash2 size={16} /></button>
    </motion.li>
  )
}
