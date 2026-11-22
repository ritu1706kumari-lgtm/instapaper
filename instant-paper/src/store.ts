import { create } from 'zustand'
import { get as idbGet, set as idbSet } from 'idb-keyval'
import type { MatchPair, Paper, PaperHeader, Question, Section, Settings } from './types'
import { blankPaper, samplePaper } from './lib/sample'
import { checkServerAI, extractPaper, type ServerAIStatus } from './lib/ai'
import { uid } from './lib/id'

export type View = 'photos' | 'template' | 'editor'

export interface Toast { id: string; kind: 'success' | 'error' | 'info'; text: string }

interface State {
  hydrated: boolean
  settings: Settings
  papers: Paper[]
  activeId: string
  views: Record<string, View>
  progress: Record<string, string>
  toasts: Toast[]
  settingsOpen: boolean
  serverAI: ServerAIStatus & { checked: boolean }

  hydrate: () => Promise<void>
  setSettings: (p: Partial<Settings>) => void
  openSettings: (open: boolean) => void
  toast: (kind: Toast['kind'], text: string) => void
  dismissToast: (id: string) => void

  addPaper: (p?: Paper) => string
  removePaper: (id: string) => void
  duplicatePaper: (id: string) => void
  setActive: (id: string) => void
  setView: (id: string, v: View) => void
  updatePaper: (id: string, fn: (p: Paper) => Paper) => void

  setHeader: (id: string, field: keyof PaperHeader, value: PaperHeader[keyof PaperHeader]) => void
  setSection: (id: string, sid: string, patch: Partial<Section>) => void
  setQuestion: (id: string, sid: string, qid: string, patch: Partial<Question>) => void
  setPair: (id: string, sid: string, pid: string, patch: Partial<MatchPair>) => void

  generate: (id: string) => Promise<boolean>
  generateMany: (ids: string[]) => Promise<void>
}

const defaultSettings: Settings = {
  geminiKey: '',
  groqKey: '',
  geminiModel: 'auto',
  groqModel: 'meta-llama/llama-4-scout-17b-16e-instruct',
  schoolName: 'Little Flower Convent School, Faridabad',
  theme: 'system',
}

const first = samplePaper()

export const useStore = create<State>((set, get) => ({
  hydrated: false,
  settings: defaultSettings,
  papers: [first],
  activeId: first.id,
  views: { [first.id]: 'editor' },
  progress: {},
  toasts: [],
  settingsOpen: false,
  serverAI: { available: false, needsCode: false, checked: false },

  hydrate: async () => {
    checkServerAI().then((st) => set({ serverAI: { ...st, checked: true } }))
    try {
      const saved = await idbGet('instant-paper:v1')
      if (saved?.papers?.length) {
        const papers: Paper[] = saved.papers.map((p: Paper) => (p.status === 'generating' ? { ...p, status: p.photos.length ? 'ready' : 'empty' } : p))
        set({
          papers,
          activeId: papers.some((p) => p.id === saved.activeId) ? saved.activeId : papers[0].id,
          views: saved.views ?? {},
          settings: { ...defaultSettings, ...saved.settings },
        })
      } else if (saved?.settings) set({ settings: { ...defaultSettings, ...saved.settings } })
    } catch (e) {
      console.warn('Could not load saved work', e)
    }
    set({ hydrated: true })
  },

  setSettings: (p) => set((s) => ({ settings: { ...s.settings, ...p } })),
  openSettings: (open) => set({ settingsOpen: open }),
  toast: (kind, text) => {
    const id = uid()
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, kind, text }] }))
    setTimeout(() => get().dismissToast(id), kind === 'error' ? 9000 : 4500)
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  addPaper: (p) => {
    const { settings } = get()
    const paper = p ?? blankPaper(settings.schoolName, settings.schoolLogo)
    set((s) => ({ papers: [...s.papers, paper], activeId: paper.id, views: { ...s.views, [paper.id]: p ? 'editor' : 'photos' } }))
    return paper.id
  },
  removePaper: (id) => set((s) => {
    const papers = s.papers.filter((p) => p.id !== id)
    if (!papers.length) {
      const b = blankPaper(s.settings.schoolName, s.settings.schoolLogo)
      return { papers: [b], activeId: b.id, views: { [b.id]: 'photos' } }
    }
    const idx = s.papers.findIndex((p) => p.id === id)
    return { papers, activeId: s.activeId === id ? papers[Math.max(0, idx - 1)].id : s.activeId }
  }),
  duplicatePaper: (id) => {
    const src = get().papers.find((p) => p.id === id)
    if (!src) return
    const copy: Paper = { ...structuredClone(src), id: uid(), name: `${src.name} (copy)`, updatedAt: Date.now() }
    set((s) => ({ papers: [...s.papers, copy], activeId: copy.id, views: { ...s.views, [copy.id]: s.views[id] ?? 'editor' } }))
  },
  setActive: (id) => set({ activeId: id }),
  setView: (id, v) => set((s) => ({ views: { ...s.views, [id]: v } })),
  updatePaper: (id, fn) => set((s) => ({ papers: s.papers.map((p) => (p.id === id ? { ...fn(p), updatedAt: Date.now() } : p)) })),

  setHeader: (id, field, value) => get().updatePaper(id, (p) => ({ ...p, header: { ...p.header, [field]: value } })),
  setSection: (id, sid, patch) => get().updatePaper(id, (p) => ({ ...p, sections: p.sections.map((s) => (s.id === sid ? { ...s, ...patch } : s)) })),
  setQuestion: (id, sid, qid, patch) => get().updatePaper(id, (p) => ({
    ...p,
    sections: p.sections.map((s) => (s.id === sid ? { ...s, questions: s.questions.map((q) => (q.id === qid ? { ...q, ...patch } : q)) } : s)),
  })),
  setPair: (id, sid, pid, patch) => get().updatePaper(id, (p) => ({
    ...p,
    sections: p.sections.map((s) => (s.id === sid ? { ...s, pairs: (s.pairs ?? []).map((x) => (x.id === pid ? { ...x, ...patch } : x)) } : s)),
  })),

  generate: async (id) => {
    const paper = get().papers.find((p) => p.id === id)
    if (!paper) return false
    const { settings } = get()
    get().updatePaper(id, (p) => ({ ...p, status: 'generating', error: undefined }))
    const setProgress = (msg: string) => set((s) => ({ progress: { ...s.progress, [id]: msg } }))
    try {
      const res = await extractPaper(paper.photos.map((p) => p.dataUrl), settings, get().serverAI, setProgress)
      get().updatePaper(id, (p) => ({
        ...p,
        status: 'done',
        header: {
          ...res.header,
          school: res.header.school || p.header.school || settings.schoolName,
          logo: p.header.logo ?? settings.schoolLogo,
        },
        sections: res.sections,
        name: [res.header.className && `Class ${res.header.className}`, res.header.subject].filter(Boolean).join(' · ') || p.name,
      }))
      set((s) => ({ views: { ...s.views, [id]: 'editor' } }))
      const diagrams = res.sections.flatMap((s) => s.questions).filter((q) => q.needsDiagram).length
      get().toast('success', `Paper ready (read by ${res.provider}).${diagrams ? ` ${diagrams} question(s) need a diagram — look for the yellow badges.` : ' Check it once and print!'}`)
      return true
    } catch (e) {
      const msg = (e as Error).message
      get().updatePaper(id, (p) => ({ ...p, status: 'error', error: msg }))
      get().toast('error', msg)
      if (/key|code/i.test(msg)) set({ settingsOpen: true })
      return false
    } finally {
      set((s) => { const pr = { ...s.progress }; delete pr[id]; return { progress: pr } })
    }
  },

  generateMany: async (ids) => {
    // One at a time keeps us inside the free per-minute limits.
    for (const id of ids) {
      const ok = await get().generate(id)
      if (!ok && get().papers.find((p) => p.id === id)?.error?.match(/key|code/i)) break
    }
  },
}))

/* Autosave everything (photos included) to IndexedDB, debounced. */
let timer: ReturnType<typeof setTimeout> | undefined
useStore.subscribe((s, prev) => {
  if (!s.hydrated) return
  if (s.papers === prev.papers && s.settings === prev.settings && s.activeId === prev.activeId && s.views === prev.views) return
  clearTimeout(timer)
  timer = setTimeout(() => {
    idbSet('instant-paper:v1', { papers: s.papers, activeId: s.activeId, views: s.views, settings: s.settings }).catch((e) =>
      console.warn('Autosave failed', e),
    )
  }, 400)
})

export const useActivePaper = () => useStore((s) => s.papers.find((p) => p.id === s.activeId) ?? s.papers[0])

/** True when papers can be read: a personal key, or the school AI (plus its code if required). */
export const useAIReady = () =>
  useStore((s) => !!(s.settings.geminiKey || s.settings.groqKey) || (s.serverAI.available && (!s.serverAI.needsCode || !!s.settings.accessCode)))
