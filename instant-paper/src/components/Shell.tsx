import { motion, AnimatePresence } from 'motion/react'
import { Camera, Check, Copy, FileText, LayoutTemplate, Loader2, Moon, PenLine, Plus, Settings, Sparkles, Sun, X, AlertTriangle, Monitor } from 'lucide-react'
import { useAIReady, useStore, type View } from '../store'
import { Button } from './ui'

export function TopBar() {
  const theme = useStore((s) => s.settings.theme)
  const setSettings = useStore((s) => s.setSettings)
  const openSettings = useStore((s) => s.openSettings)
  const hasKey = useAIReady()
  const checked = useStore((s) => s.serverAI.checked)
  const needsCode = useStore((s) => s.serverAI.needsCode)
  const next = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light'
  return (
    <header className="sticky top-0 z-30 border-b border-ink-900/5 bg-paper/80 backdrop-blur-xl dark:border-white/5 dark:bg-[#10121b]/80 no-print">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-3 px-4 sm:px-6">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:shadow">Skip to content</a>
        <motion.div initial={{ rotate: -12, scale: 0.8 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 14 }}>
          <img src="/favicon.svg" alt="" className="h-9 w-9" />
        </motion.div>
        <div className="mr-auto leading-tight">
          <p className="font-display text-xl font-semibold tracking-tight">Instant Paper</p>
          <p className="hidden text-xs text-ink-500 sm:block dark:text-ink-300">Handwritten draft → print-ready exam paper</p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setSettings({ theme: next })} aria-label={`Theme: ${theme}. Switch to ${next}`} title={`Theme: ${theme}`}>
          {theme === 'light' ? <Sun size={18} /> : theme === 'dark' ? <Moon size={18} /> : <Monitor size={18} />}
        </Button>
        <Button variant={hasKey || !checked ? 'secondary' : 'accent'} onClick={() => openSettings(true)} icon={<Settings size={16} />} className="relative">
          <span className="hidden sm:inline">{hasKey || !checked ? 'Settings' : needsCode ? 'Enter school code' : 'Connect free AI'}</span>
          {!hasKey && checked && <span className="absolute -right-1 -top-1 h-3 w-3 animate-ping rounded-full bg-red-500" aria-hidden />}
        </Button>
      </div>
    </header>
  )
}

export function PaperTabs() {
  const papers = useStore((s) => s.papers)
  const activeId = useStore((s) => s.activeId)
  const setActive = useStore((s) => s.setActive)
  const addPaper = useStore((s) => s.addPaper)
  const removePaper = useStore((s) => s.removePaper)
  const duplicate = useStore((s) => s.duplicatePaper)
  const generateMany = useStore((s) => s.generateMany)
  const pending = papers.filter((p) => p.photos.length && (p.status === 'ready' || p.status === 'error'))
  const busy = papers.some((p) => p.status === 'generating')

  const onKey = (e: React.KeyboardEvent, i: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    const n = (i + (e.key === 'ArrowRight' ? 1 : -1) + papers.length) % papers.length
    setActive(papers[n].id)
    document.getElementById(`tab-${papers[n].id}`)?.focus()
  }

  return (
    <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-2 px-4 pt-4 sm:px-6 no-print">
      <div role="tablist" aria-label="Your papers" className="flex max-w-full flex-1 gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
        <AnimatePresence initial={false}>
          {papers.map((p, i) => {
            const active = p.id === activeId
            return (
              <motion.div
                key={p.id} layout initial={{ opacity: 0, y: -8, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.85, width: 0 }}
                className="relative flex shrink-0 items-center"
              >
                <button
                  id={`tab-${p.id}`} role="tab" aria-selected={active} aria-controls="main" tabIndex={active ? 0 : -1}
                  onClick={() => setActive(p.id)} onKeyDown={(e) => onKey(e, i)}
                  className={`relative flex h-10 items-center gap-2 rounded-xl pl-3 ${active ? "pr-14" : "pr-9"} text-sm font-medium transition ${active ? 'text-ink-950 dark:text-white' : 'text-ink-600 hover:bg-white/60 dark:text-ink-300 dark:hover:bg-white/5'}`}
                >
                  {active && <motion.span layoutId="tab-pill" className="absolute inset-0 rounded-xl bg-white shadow-sm ring-1 ring-ink-100 dark:bg-white/10 dark:ring-white/10" transition={{ type: 'spring', stiffness: 400, damping: 34 }} />}
                  <span className="relative">
                    {p.status === 'generating' ? <Loader2 size={15} className="animate-spin text-ink-500" aria-label="Reading" />
                      : p.status === 'done' ? <Check size={15} className="text-emerald-600" aria-label="Ready" />
                        : p.status === 'error' ? <AlertTriangle size={15} className="text-red-500" aria-label="Error" />
                          : <FileText size={15} className="text-ink-400" aria-hidden />}
                  </span>
                  <span className="relative max-w-[180px] truncate">{p.name}</span>
                </button>
                <div className="absolute right-1 flex">
                  {active && (
                    <button onClick={() => duplicate(p.id)} className="hidden rounded-md p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700 sm:block dark:hover:bg-white/10" aria-label={`Duplicate ${p.name}`} title="Duplicate"><Copy size={13} /></button>
                  )}
                  <button
                    onClick={() => { if (p.sections.length === 0 || confirm(`Remove “${p.name}”? This cannot be undone.`)) removePaper(p.id) }}
                    className="rounded-md p-1 text-ink-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10" aria-label={`Remove ${p.name}`} title="Remove"
                  ><X size={14} /></button>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
        <Button variant="ghost" size="sm" className="h-10 shrink-0" icon={<Plus size={16} />} onClick={() => addPaper()}>New paper</Button>
      </div>
      <AnimatePresence>
        {pending.length > 1 && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
            <Button variant="accent" disabled={busy} icon={busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} onClick={() => generateMany(pending.map((p) => p.id))}>
              Read all {pending.length} papers
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

const STEPS: { id: View; label: string; icon: typeof Camera }[] = [
  { id: 'photos', label: 'Photos', icon: Camera },
  { id: 'template', label: 'Template & AI', icon: LayoutTemplate },
  { id: 'editor', label: 'Edit & print', icon: PenLine },
]

export function Stepper({ paperId, view }: { paperId: string; view: View }) {
  const setView = useStore((s) => s.setView)
  const idx = STEPS.findIndex((s) => s.id === view)
  return (
    <nav aria-label="Steps" className="no-print">
      <ol className="flex items-center gap-1 sm:gap-2">
        {STEPS.map((s, i) => {
          const Icon = s.icon
          const active = s.id === view
          const done = i < idx
          return (
            <li key={s.id} className="flex items-center gap-1 sm:gap-2">
              <button
                onClick={() => setView(paperId, s.id)} aria-current={active ? 'step' : undefined}
                className={`group relative flex h-9 items-center gap-2 rounded-full px-3 text-sm font-medium transition ${active ? 'text-white' : done ? 'text-ink-800 hover:bg-white dark:text-ink-100 dark:hover:bg-white/10' : 'text-ink-500 hover:bg-white dark:text-ink-400 dark:hover:bg-white/10'}`}
              >
                {active && <motion.span layoutId="step-pill" className="absolute inset-0 rounded-full bg-ink-800 dark:bg-ink-500" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
                <span className={`relative grid h-5 w-5 place-items-center rounded-full text-[11px] ${active ? 'bg-white/20' : done ? 'bg-emerald-500 text-white' : 'bg-ink-100 dark:bg-white/10'}`}>
                  {done ? <Check size={12} aria-hidden /> : i + 1}
                </span>
                <Icon size={15} className="relative hidden sm:block" aria-hidden />
                <span className={`relative whitespace-nowrap ${active ? '' : 'hidden sm:inline'}`}>{s.label}</span>
                {done && <span className="sr-only">(completed)</span>}
              </button>
              {i < STEPS.length - 1 && <span className={`h-px w-4 sm:w-8 ${i < idx ? 'bg-emerald-400' : 'bg-ink-200 dark:bg-white/10'}`} aria-hidden />}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
