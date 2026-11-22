import { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, ArrowRight, Camera, Crop, ImagePlus, KeyRound, PenLine, RotateCcw, RotateCw, Trash2, UploadCloud } from 'lucide-react'
import type { Paper } from '../types'
import { useAIReady, useStore } from '../store'
import { Button } from './ui'
import { fileToCompressedDataUrl, rotateDataUrl } from '../lib/image'
import { uid } from '../lib/id'
import { CropDialog } from './CropDialog'

export function PhotosStep({ paper }: { paper: Paper }) {
  const updatePaper = useStore((s) => s.updatePaper)
  const setView = useStore((s) => s.setView)
  const toast = useStore((s) => s.toast)
  const hasKey = useAIReady()
  const server = useStore((s) => s.serverAI)
  const openSettings = useStore((s) => s.openSettings)
  const [drag, setDrag] = useState(false)
  const isBook = paper.mode === 'book'
  const [loading, setLoading] = useState(0)
  const [crop, setCrop] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const camRef = useRef<HTMLInputElement>(null)

  const addFiles = async (files: FileList | File[] | null) => {
    const list = [...(files ?? [])].filter((f) => f.type.startsWith('image/'))
    if (!list.length) { toast('error', 'Please choose photos (JPG or PNG). For PDFs, take a screenshot of each page.'); return }
    setLoading(list.length)
    try {
      const photos = await Promise.all(list.map(async (f) => ({ id: uid(), name: f.name, dataUrl: await fileToCompressedDataUrl(f) })))
      updatePaper(paper.id, (p) => ({ ...p, photos: [...p.photos, ...photos], status: p.status === 'done' ? 'done' : 'ready' }))
      toast('success', `${photos.length} page${photos.length > 1 ? 's' : ''} added.`)
    } catch (e) {
      toast('error', (e as Error).message)
    } finally {
      setLoading(0)
    }
  }

  const move = (i: number, d: -1 | 1) => updatePaper(paper.id, (p) => {
    const photos = [...p.photos]; const j = i + d
    if (j < 0 || j >= photos.length) return p;
    [photos[i], photos[j]] = [photos[j], photos[i]]
    return { ...p, photos }
  })
  const rotate = async (id: string, deg: 90 | -90) => {
    const ph = paper.photos.find((x) => x.id === id)!
    const dataUrl = await rotateDataUrl(ph.dataUrl, deg)
    updatePaper(paper.id, (p) => ({ ...p, photos: p.photos.map((x) => (x.id === id ? { ...x, dataUrl } : x)) }))
  }
  const remove = (id: string) => updatePaper(paper.id, (p) => {
    const photos = p.photos.filter((x) => x.id !== id)
    return { ...p, photos, status: photos.length ? p.status : p.sections.length ? p.status : 'empty' }
  })

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">{isBook ? 'Add photos of the chapter pages' : 'Add photos of the handwritten paper'}</h1>
        <p className="mt-2 max-w-2xl text-ink-600 dark:text-ink-300">
          {isBook
            ? 'Snap the chapter’s exercise pages — and the lesson pages too if you want questions from the content. Up to about 10 pages; hold the phone straight above the book.'
            : 'Take a clear, well-lit photo of each page — straight from above. Add pages in order; you can reorder or rotate them below.'}
        </p>
      </div>

      {!hasKey && server.checked && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-start gap-3 rounded-2xl bg-marigold-soft p-4 text-ink-900 ring-1 ring-marigold/40 sm:flex-row sm:items-center dark:bg-marigold/10 dark:text-ink-50">
          <KeyRound className="shrink-0 text-marigold" aria-hidden />
          <p className="flex-1 text-sm">{server.needsCode ? <><b>One-time step:</b> enter the school code you were given to start using the AI.</> : <><b>One-time setup:</b> connect the free Google Gemini AI (takes 2 minutes, no card needed) so the app can read handwriting.</>}</p>
          <Button variant="primary" size="sm" onClick={() => openSettings(true)}>{server.needsCode ? 'Enter code' : 'Connect now'}</Button>
        </motion.div>
      )}

      <motion.div
        onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files) }}
        animate={{ scale: drag ? 1.01 : 1 }}
        className={`relative overflow-hidden rounded-3xl border-2 border-dashed p-8 text-center transition-colors sm:p-12 ${drag ? 'border-ink-500 bg-ink-50 dark:bg-ink-500/10' : 'border-ink-200 bg-white/70 dark:border-white/15 dark:bg-white/[0.03]'}`}
      >
        <div className="pointer-events-none absolute inset-0 grain" aria-hidden />
        <motion.div animate={{ y: drag ? -6 : 0 }} className="relative mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-ink-800 text-white shadow-lg shadow-ink-900/20 dark:bg-ink-500">
          <UploadCloud size={30} aria-hidden />
        </motion.div>
        <p className="relative font-display text-xl font-semibold">{drag ? 'Drop the photos here' : 'Drag & drop photos here'}</p>
        <p className="relative mt-1 text-sm text-ink-500 dark:text-ink-300">JPG or PNG photos from your phone · several pages at once</p>
        <div className="relative mt-6 flex flex-wrap justify-center gap-3">
          <Button variant="primary" size="lg" icon={<ImagePlus size={18} />} onClick={() => fileRef.current?.click()}>Choose photos</Button>
          <Button size="lg" icon={<Camera size={18} />} onClick={() => camRef.current?.click()}>Take photo</Button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" multiple className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
        <input ref={camRef} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
        {loading > 0 && <p className="relative mt-4 text-sm text-ink-600" role="status">Preparing {loading} photo(s)…</p>}
      </motion.div>

      {paper.photos.length > 0 && (
        <section aria-labelledby="pages-h">
          <h2 id="pages-h" className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-300">Pages ({paper.photos.length})</h2>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            <AnimatePresence initial={false}>
              {paper.photos.map((ph, i) => (
                <motion.li
                  key={ph.id} layout initial={{ opacity: 0, scale: 0.9, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.85 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                  className="group overflow-hidden rounded-2xl bg-white ring-1 ring-ink-100 sheet-shadow dark:bg-white/5 dark:ring-white/10"
                >
                  <div className="relative aspect-[3/4] bg-ink-50 dark:bg-black/20">
                    <img src={ph.dataUrl} alt={`Page ${i + 1} photo`} className="h-full w-full object-contain" />
                    <span className="absolute left-2 top-2 rounded-full bg-ink-900/80 px-2 py-0.5 text-xs font-semibold text-white">Page {i + 1}</span>
                  </div>
                  <div className="flex items-center justify-between gap-0.5 p-1.5">
                    <Button variant="ghost" size="icon" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move page ${i + 1} earlier`}><ArrowLeft size={16} /></Button>
                    <Button variant="ghost" size="icon" onClick={() => move(i, 1)} disabled={i === paper.photos.length - 1} aria-label={`Move page ${i + 1} later`}><ArrowRight size={16} /></Button>
                    <Button variant="ghost" size="icon" onClick={() => rotate(ph.id, -90)} aria-label={`Rotate page ${i + 1} left`}><RotateCcw size={16} /></Button>
                    <Button variant="ghost" size="icon" onClick={() => rotate(ph.id, 90)} aria-label={`Rotate page ${i + 1} right`}><RotateCw size={16} /></Button>
                    <Button variant="ghost" size="icon" onClick={() => setCrop(ph.dataUrl)} aria-label={`Crop a diagram from page ${i + 1}`} title="Crop a diagram"><Crop size={16} /></Button>
                    <Button variant="danger" size="icon" onClick={() => remove(ph.id)} aria-label={`Delete page ${i + 1}`}><Trash2 size={16} /></Button>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </section>
      )}

      <div className="flex flex-col-reverse items-stretch justify-between gap-3 border-t border-ink-100 pt-5 sm:flex-row sm:items-center dark:border-white/10">
        {!isBook ? <Button variant="ghost" icon={<PenLine size={16} />} onClick={() => setView(paper.id, 'editor')}>Skip — I’ll type the questions myself</Button> : <span />}
        <Button variant="primary" size="lg" disabled={!paper.photos.length} onClick={() => setView(paper.id, 'template')}>
          {isBook ? 'Choose pattern' : 'Choose template'} <ArrowRight size={18} aria-hidden />
        </Button>
      </div>

      <CropDialog
        src={crop}
        onClose={() => setCrop(null)}
        onSave={(img) => { updatePaper(paper.id, (p) => ({ ...p, diagrams: [...p.diagrams, img] })); toast('success', 'Diagram saved. Attach it to a question in the editor.') }}
      />
    </div>
  )
}
