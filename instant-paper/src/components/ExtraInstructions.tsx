import { MessageSquarePlus } from 'lucide-react'
import type { Paper } from '../types'
import { useStore } from '../store'
import { inputCls } from './ui'

const IDEAS: Record<string, string[]> = {
  handwritten: ['Correct spelling mistakes', 'Keep the questions exactly as written', 'Make all marks 1 for one-word answers'],
  book: ['Make questions easy for weak students', 'Include 2 questions on diagrams', 'Use simple English', 'पेपर हिंदी में बनाएं', 'Only from Exercise 3.2'],
  previous: ['Keep the same difficulty', 'Change all numbers in sums', 'Add 2 more MCQs', 'पेपर हिंदी में बनाएं'],
}

/** Free-text extra wishes for the AI, with one-tap suggestions. */
export function ExtraInstructions({ paper }: { paper: Paper }) {
  const updatePaper = useStore((s) => s.updatePaper)
  const value = paper.extra ?? ''
  const set = (v: string) => updatePaper(paper.id, (p) => ({ ...p, extra: v.slice(0, 600) }))
  const ideas = IDEAS[paper.mode ?? 'handwritten'] ?? []
  return (
    <section className="rounded-3xl bg-white p-5 ring-1 ring-ink-100 dark:bg-white/5 dark:ring-white/10" aria-labelledby={`extra-${paper.id}`}>
      <h2 id={`extra-${paper.id}`} className="flex items-center gap-2 font-semibold">
        <MessageSquarePlus size={18} className="text-marigold" aria-hidden /> Anything special? <span className="text-sm font-normal text-ink-500">(optional · कोई खास निर्देश?)</span>
      </h2>
      <textarea
        className={`${inputCls} mt-3 min-h-20 [field-sizing:content]`} maxLength={600} value={value}
        placeholder="Write your extra instructions for the AI here, in English or Hindi…"
        aria-label="Extra instructions for the AI" onChange={(e) => set(e.target.value)}
      />
      <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Suggestions">
        {ideas.map((t) => (
          <button
            key={t} type="button"
            onClick={() => set(value ? `${value.replace(/[.\s]*$/, '')}. ${t}` : t)}
            className="rounded-full bg-ink-50 px-3 py-1 text-xs font-medium text-ink-700 ring-1 ring-ink-100 transition hover:-translate-y-px hover:bg-marigold-soft hover:ring-marigold/40 dark:bg-white/5 dark:text-ink-100 dark:ring-white/10"
          >+ {t}</button>
        ))}
      </div>
    </section>
  )
}
