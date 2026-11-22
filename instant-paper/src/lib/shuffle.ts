import type { Paper, SetOptions } from '../types'
import { uid } from './id'

/** Small deterministic RNG so each set is reproducible. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffled<T>(arr: T[], rnd: () => number): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Shuffle but guarantee the order differs from the original when possible. */
function reorder<T>(arr: T[], rnd: () => number): T[] {
  if (arr.length < 2) return arr
  for (let i = 0; i < 6; i++) {
    const s = shuffled(arr, rnd)
    if (s.some((x, k) => x !== arr[k])) return s
  }
  return [...arr.slice(1), arr[0]]
}

export const setLetter = (i: number) => String.fromCharCode(65 + i)

/** Build Set A (original order) + shuffled Sets B, C… */
export function makeSets(paper: Paper, opts: SetOptions): Paper[] {
  const sets: Paper[] = []
  for (let i = 0; i < opts.count; i++) {
    const label = setLetter(i)
    if (i === 0) { sets.push({ ...structuredClone(paper), id: uid(), setLabel: label }); continue }
    const rnd = mulberry32(hash(paper.id) + i * 7919)
    let sections = structuredClone(paper.sections)
    sections = sections.map((s) => {
      let questions = s.questions
      if (opts.shuffleQuestions) questions = reorder(questions, rnd)
      if (opts.shuffleOptions) questions = questions.map((q) => (q.options && q.options.length > 1 ? { ...q, options: reorder(q.options, rnd) } : q))
      let pairs = s.pairs
      if (opts.shuffleMatch && pairs && pairs.length > 1) {
        const lefts = reorder(pairs.map((p) => p.left), rnd)
        const rights = reorder(pairs.map((p) => p.right), rnd)
        pairs = lefts.map((left, k) => ({ id: uid(), left, right: rights[k] }))
      }
      return { ...s, questions, pairs }
    })
    if (opts.shuffleSections) sections = reorder(sections, rnd)
    sets.push({ ...structuredClone(paper), id: uid(), sections, setLabel: label })
  }
  return sets
}

function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}
