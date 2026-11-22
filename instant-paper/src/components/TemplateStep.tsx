import { useMemo } from 'react'
import { motion } from 'motion/react'
import { ArrowLeft, CheckCircle2, PenLine, Sparkles, Loader2 } from 'lucide-react'
import type { Paper } from '../types'
import { useStore } from '../store'
import { TEMPLATES } from '../lib/templates'
import { mathDemoSections, samplePaper } from '../lib/sample'
import { PaperView } from './PaperView'
import { ScaledPaper } from './ScaledPaper'
import { Button } from './ui'

export function TemplateStep({ paper }: { paper: Paper }) {
  const updatePaper = useStore((s) => s.updatePaper)
  const setView = useStore((s) => s.setView)
  const generate = useStore((s) => s.generate)
  const progress = useStore((s) => s.progress[paper.id])
  const school = useStore((s) => s.settings.schoolName)
  const generating = paper.status === 'generating'

  const demo = useMemo(() => {
    if (paper.sections.length) return paper
    const s = samplePaper(school)
    return { ...s, sections: [...s.sections.slice(0, 2), ...mathDemoSections(), s.sections[3]] }
  }, [paper, school])

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Pick a template</h1>
          <p className="mt-2 max-w-2xl text-ink-600 dark:text-ink-300">The AI fills the heading, class, subject, time, marks and every section into the layout you choose. You can switch templates any time later.</p>
        </div>
      </div>

      {generating ? (
        <Scanning paper={paper} message={progress ?? 'Starting…'} />
      ) : (
        <div role="radiogroup" aria-label="Templates" className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {TEMPLATES.map((t, i) => {
            const sel = paper.templateId === t.id
            return (
              <motion.button
                key={t.id} role="radio" aria-checked={sel}
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                whileHover={{ y: -4 }} whileTap={{ scale: 0.98 }}
                onClick={() => updatePaper(paper.id, (p) => ({ ...p, templateId: t.id, showStudentFields: t.studentFields }))}
                className={`group relative overflow-hidden rounded-3xl bg-white p-3 text-left ring-2 transition-shadow dark:bg-white/5 ${sel ? 'ring-ink-600 shadow-xl shadow-ink-900/10 dark:ring-ink-400' : 'ring-transparent sheet-shadow hover:ring-ink-200 dark:hover:ring-white/20'}`}
              >
                <div className="relative aspect-[210/170] overflow-hidden rounded-2xl bg-paper-2 ring-1 ring-ink-100 dark:bg-black/20 dark:ring-white/5" aria-hidden>
                  <div className="absolute inset-x-3 top-3">
                    <ScaledPaper>
                      <div className="pointer-events-none rounded-sm shadow-md">
                        <PaperView paper={{ ...demo, templateId: t.id, showStudentFields: t.studentFields, setLabel: undefined }} />
                      </div>
                    </ScaledPaper>
                  </div>
                  <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-paper-2 to-transparent dark:from-[#16182240]" />
                </div>
                <div className="flex items-start gap-3 px-1 pb-1 pt-3">
                  <div className="flex-1">
                    <p className="font-semibold">{t.name}</p>
                    <p className="text-sm text-ink-500 dark:text-ink-300">{t.tagline}</p>
                  </div>
                  <span className="mt-0.5 h-3 w-3 shrink-0 rounded-full" style={{ background: t.accent }} aria-hidden />
                </div>
                {sel && (
                  <motion.span layoutId="tpl-check" className="absolute right-5 top-5 grid h-8 w-8 place-items-center rounded-full bg-ink-700 text-white shadow-lg dark:bg-ink-400">
                    <CheckCircle2 size={18} aria-hidden />
                  </motion.span>
                )}
              </motion.button>
            )
          })}
        </div>
      )}

      {paper.error && !generating && (
        <div role="alert" className="rounded-2xl bg-red-50 p-4 text-sm text-red-900 ring-1 ring-red-200 dark:bg-red-950/50 dark:text-red-100 dark:ring-red-900">{paper.error}</div>
      )}

      <div className="flex flex-col-reverse items-stretch justify-between gap-3 border-t border-ink-100 pt-5 sm:flex-row sm:items-center dark:border-white/10">
        <Button variant="ghost" icon={<ArrowLeft size={16} />} onClick={() => setView(paper.id, 'photos')} disabled={generating}>Back to photos</Button>
        <div className="flex flex-col gap-3 sm:flex-row">
          {paper.sections.length > 0 && (
            <Button size="lg" icon={<PenLine size={18} />} onClick={() => setView(paper.id, 'editor')} disabled={generating}>Keep current text</Button>
          )}
          <Button
            variant="accent" size="lg" disabled={!paper.photos.length || generating}
            icon={generating ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
            onClick={() => generate(paper.id)}
          >
            {generating ? 'Reading…' : paper.sections.length ? 'Read photos again with AI' : 'Create paper with AI'}
          </Button>
        </div>
      </div>
    </div>
  )
}

function Scanning({ paper, message }: { paper: Paper; message: string }) {
  return (
    <div className="grid items-center gap-8 rounded-3xl bg-white p-6 ring-1 ring-ink-100 sm:grid-cols-[minmax(0,320px)_1fr] sm:p-10 dark:bg-white/5 dark:ring-white/10" aria-busy="true">
      <div className="relative mx-auto w-full max-w-[320px]">
        {paper.photos.slice(0, 3).reverse().map((ph, i, arr) => (
          <motion.img
            key={ph.id} src={ph.dataUrl} alt=""
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className={`${i === arr.length - 1 ? 'relative' : 'absolute inset-0'} aspect-[3/4] w-full rounded-2xl object-cover shadow-xl ring-1 ring-ink-100`}
            style={{ rotate: `${(arr.length - 1 - i) * -4}deg` }}
          />
        ))}
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
          <div className="absolute inset-x-0 top-0 h-1.5 animate-scan rounded-full bg-marigold shadow-[0_0_24px_6px_rgba(242,165,22,.55)]" />
        </div>
      </div>
      <div>
        <p className="font-display text-3xl font-semibold">Reading the handwriting…</p>
        <p className="mt-3 text-ink-600 dark:text-ink-300" role="status" aria-live="polite">{message}</p>
        <ul className="mt-6 space-y-2 text-sm text-ink-600 dark:text-ink-300">
          {['Finding the header, class & subject', 'Detecting sections and marks', 'Typing every question, blank and option', 'Formatting maths & Hindi text'].map((t, i) => (
            <motion.li key={t} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 + i * 1.4 }} className="flex items-center gap-2">
              <motion.span animate={{ scale: [1, 1.3, 1] }} transition={{ repeat: Infinity, duration: 1.6, delay: i * 0.3 }} className="h-2 w-2 rounded-full bg-ink-500" aria-hidden />
              {t}
            </motion.li>
          ))}
        </ul>
        <p className="mt-6 text-xs text-ink-400">Usually takes 10–40 seconds per paper on the free tier.</p>
      </div>
    </div>
  )
}
