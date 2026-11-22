import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import { useActivePaper, useStore } from './store'
import { PaperTabs, Stepper, TopBar } from './components/Shell'
import { PhotosStep } from './components/PhotosStep'
import { TemplateStep } from './components/TemplateStep'
import { EditorStep } from './components/EditorStep'
import { Home } from './components/Home'
import { SettingsDialog } from './components/SettingsDialog'
import { Toasts } from './components/ui'
import { PaperView } from './components/PaperView'
import { usePrint, waitForAssets } from './lib/export'

function useTheme() {
  const theme = useStore((s) => s.settings.theme)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => document.documentElement.classList.toggle('dark', theme === 'dark' || (theme === 'system' && mq.matches))
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [theme])
}

/** Renders the papers to print outside #root, then opens the browser print dialog. */
function PrintHost() {
  const job = usePrint((s) => s.job)
  const done = usePrint((s) => s.done)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!job || !ref.current) return
    let cancelled = false
    const title = document.title
    ;(async () => {
      await waitForAssets(ref.current!)
      if (cancelled) return
      document.title = job.papers[0]?.name ?? title
      const finish = () => { document.title = title; done(); window.removeEventListener('afterprint', finish) }
      window.addEventListener('afterprint', finish)
      window.print()
      setTimeout(() => { if (usePrint.getState().job === job) finish() }, 1500)
    })()
    return () => { cancelled = true }
  }, [job, done])
  if (!job) return null
  return createPortal(
    <div className="print-root" ref={ref} aria-hidden>
      {job.papers.flatMap((p) => Array.from({ length: job.copies }, (_, c) => <PaperView key={`${p.id}-${c}`} paper={p} />))}
    </div>,
    document.body,
  )
}

export default function App() {
  const hydrated = useStore((s) => s.hydrated)
  const hydrate = useStore((s) => s.hydrate)
  const paper = useActivePaper()
  const view = useStore((s) => s.views[paper.id] ?? (paper.sections.length ? 'editor' : 'photos'))
  const screen = useStore((s) => s.screen)
  useTheme()
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }) }, [paper.id, view, screen])
  useEffect(() => { hydrate() }, [hydrate])

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-full grain">
        <TopBar />
        {hydrated && screen === 'home' ? (
          <main id="main" tabIndex={-1} className="outline-none"><Home /></main>
        ) : hydrated ? (
          <>
            <PaperTabs />
            <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 pb-2 pt-4 sm:px-6">
              <Stepper paperId={paper.id} view={view} mode={paper.mode} />
            </div>
            <main id="main" tabIndex={-1} className="px-4 pb-24 pt-4 outline-none sm:px-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key={paper.id + view}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
                >
                  {view === 'photos' && <PhotosStep paper={paper} />}
                  {view === 'template' && <TemplateStep paper={paper} />}
                  {view === 'editor' && <EditorStep paper={paper} />}
                </motion.div>
              </AnimatePresence>
            </main>
          </>
        ) : (
          <div className="grid h-[60vh] place-items-center" role="status"><span className="h-10 w-10 animate-spin rounded-full border-4 border-ink-200 border-t-ink-700" /><span className="sr-only">Loading…</span></div>
        )}
        <footer className="pb-8 text-center text-xs text-ink-400 no-print">Made for teachers · Your papers never leave this device except to the AI you connect.</footer>
        <SettingsDialog />
        <Toasts />
        <PrintHost />
      </div>
    </MotionConfig>
  )
}
