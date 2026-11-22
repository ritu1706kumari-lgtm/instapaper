import { useState } from 'react'
import { Crop, Trash2, Upload } from 'lucide-react'
import type { Paper } from '../types'
import { useStore } from '../store'
import { Modal } from './ui'
import { CropDialog } from './CropDialog'
import { fileToCompressedDataUrl } from '../lib/image'

export function DiagramPicker({ paper, target, onClose }: { paper: Paper; target: { sid: string; qid: string } | null; onClose: () => void }) {
  const setQuestion = useStore((s) => s.setQuestion)
  const updatePaper = useStore((s) => s.updatePaper)
  const [cropSrc, setCropSrc] = useState<string | null>(null)

  const attach = (img: string) => {
    if (!target) return
    setQuestion(paper.id, target.sid, target.qid, { image: img, needsDiagram: false })
    onClose()
  }

  return (
    <>
      <Modal open={!!target && !cropSrc} onClose={onClose} title="Add a diagram" wide>
        <div className="space-y-6">
          {paper.photos.length > 0 && (
            <section>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold"><Crop size={16} aria-hidden /> Crop it from a photo</h3>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {paper.photos.map((ph, i) => (
                  <button key={ph.id} onClick={() => setCropSrc(ph.dataUrl)} className="shrink-0 overflow-hidden rounded-xl ring-1 ring-ink-100 transition hover:-translate-y-1 hover:ring-ink-400 dark:ring-white/10" aria-label={`Crop from page ${i + 1}`}>
                    <img src={ph.dataUrl} alt="" className="h-36 w-28 object-cover" />
                  </button>
                ))}
              </div>
            </section>
          )}
          {paper.diagrams.length > 0 && (
            <section>
              <h3 className="mb-2 text-sm font-semibold">Saved diagrams</h3>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                {paper.diagrams.map((d, i) => (
                  <div key={i} className="group relative">
                    <button onClick={() => attach(d)} className="block w-full overflow-hidden rounded-xl bg-white ring-1 ring-ink-100 transition hover:ring-2 hover:ring-ink-500" aria-label={`Use saved diagram ${i + 1}`}>
                      <img src={d} alt="" className="h-24 w-full object-contain" />
                    </button>
                    <button onClick={() => updatePaper(paper.id, (p) => ({ ...p, diagrams: p.diagrams.filter((_, k) => k !== i) }))} className="absolute right-1 top-1 rounded-md bg-white/90 p-1 text-red-600 opacity-0 shadow transition group-hover:opacity-100 focus:opacity-100" aria-label={`Delete saved diagram ${i + 1}`}><Trash2 size={13} /></button>
                  </div>
                ))}
              </div>
            </section>
          )}
          <section>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-ink-200 p-6 text-sm font-medium hover:border-ink-400 hover:bg-ink-50 focus-within:ring-2 focus-within:ring-marigold dark:border-white/15 dark:hover:bg-white/5">
              <Upload size={18} aria-hidden /> Upload a diagram image
              <input type="file" accept="image/*" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; if (f) attach(await fileToCompressedDataUrl(f, 1400, 0.92)) }} />
            </label>
          </section>
        </div>
      </Modal>
      <CropDialog
        src={cropSrc}
        onClose={() => setCropSrc(null)}
        onSave={(img) => { updatePaper(paper.id, (p) => ({ ...p, diagrams: [...p.diagrams, img] })); attach(img) }}
      />
    </>
  )
}
