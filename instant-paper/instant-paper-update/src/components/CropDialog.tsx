import { useEffect, useRef, useState } from 'react'
import { Crop } from 'lucide-react'
import { Button, Modal, Toggle } from './ui'
import { cropDataUrl } from '../lib/image'

type Rect = { x: number; y: number; w: number; h: number }
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v))

/** Drag on the photo to select a diagram. Keyboard: arrows move, Shift+arrows resize. */
export function CropDialog({ src, onClose, onSave }: { src: string | null; onClose: () => void; onSave: (img: string) => void }) {
  const [rect, setRect] = useState<Rect>({ x: 0.2, y: 0.25, w: 0.6, h: 0.3 })
  const [clean, setClean] = useState(true)
  const [busy, setBusy] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const start = useRef<{ x: number; y: number; mode: 'new' | 'move'; orig: Rect } | null>(null)

  useEffect(() => { if (src) setRect({ x: 0.2, y: 0.25, w: 0.6, h: 0.3 }) }, [src])

  const pos = (e: React.PointerEvent) => {
    const r = box.current!.getBoundingClientRect()
    return { x: clamp((e.clientX - r.left) / r.width), y: clamp((e.clientY - r.top) / r.height) }
  }
  const down = (e: React.PointerEvent) => {
    const p = pos(e)
    const inside = p.x > rect.x && p.x < rect.x + rect.w && p.y > rect.y && p.y < rect.y + rect.h
    start.current = { ...p, mode: inside ? 'move' : 'new', orig: rect }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }
  const moveP = (e: React.PointerEvent) => {
    if (!start.current) return
    const p = pos(e); const s = start.current
    if (s.mode === 'move') {
      setRect({ ...s.orig, x: clamp(s.orig.x + p.x - s.x, 0, 1 - s.orig.w), y: clamp(s.orig.y + p.y - s.y, 0, 1 - s.orig.h) })
    } else {
      setRect({ x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.max(0.02, Math.abs(p.x - s.x)), h: Math.max(0.02, Math.abs(p.y - s.y)) })
    }
  }
  const key = (e: React.KeyboardEvent) => {
    const d = 0.01 * (e.altKey ? 5 : 1)
    const map: Record<string, [number, number]> = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, -d], ArrowDown: [0, d] }
    const v = map[e.key]
    if (!v) return
    e.preventDefault()
    setRect((r) => e.shiftKey
      ? { ...r, w: clamp(r.w + v[0], 0.03, 1 - r.x), h: clamp(r.h + v[1], 0.03, 1 - r.y) }
      : { ...r, x: clamp(r.x + v[0], 0, 1 - r.w), y: clamp(r.y + v[1], 0, 1 - r.h) })
  }

  const save = async () => {
    if (!src) return
    setBusy(true)
    try { onSave(await cropDataUrl(src, rect, clean)); onClose() } finally { setBusy(false) }
  }

  return (
    <Modal open={!!src} onClose={onClose} title="Crop a diagram" wide>
      <p className="mb-3 text-sm text-ink-600 dark:text-ink-300">Drag over the figure to select it, or drag the box to move it. Keyboard: arrow keys move, Shift + arrows resize.</p>
      {src && (
        <div className="relative mx-auto w-fit max-w-full touch-none select-none overflow-hidden rounded-xl ring-1 ring-ink-100 dark:ring-white/10">
          <div
            ref={box} className="relative cursor-crosshair" onPointerDown={down} onPointerMove={moveP} onPointerUp={() => { start.current = null }}
            tabIndex={0} role="application" aria-label={`Selection at ${Math.round(rect.x * 100)}% left, ${Math.round(rect.y * 100)}% top, ${Math.round(rect.w * 100)}% wide, ${Math.round(rect.h * 100)}% tall`} onKeyDown={key}
          >
            <img src={src} alt="Page to crop from" className="block max-h-[60vh] w-auto max-w-full" draggable={false} />
            <div className="pointer-events-none absolute inset-0 bg-black/45" style={{ clipPath: `polygon(0 0,100% 0,100% 100%,0 100%,0 0,${rect.x * 100}% ${rect.y * 100}%,${rect.x * 100}% ${(rect.y + rect.h) * 100}%,${(rect.x + rect.w) * 100}% ${(rect.y + rect.h) * 100}%,${(rect.x + rect.w) * 100}% ${rect.y * 100}%,${rect.x * 100}% ${rect.y * 100}%)` }} />
            <div className="pointer-events-none absolute border-2 border-marigold shadow-[0_0_0_1px_rgba(0,0,0,.4)]" style={{ left: `${rect.x * 100}%`, top: `${rect.y * 100}%`, width: `${rect.w * 100}%`, height: `${rect.h * 100}%` }}>
              {['-left-1.5 -top-1.5', '-right-1.5 -top-1.5', '-left-1.5 -bottom-1.5', '-right-1.5 -bottom-1.5'].map((c) => <span key={c} className={`absolute h-3 w-3 rounded-full bg-marigold ${c}`} />)}
            </div>
          </div>
        </div>
      )}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="w-72"><Toggle id="clean" checked={clean} onChange={setClean} label="Clean up for printing (black & white)" /></div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon={<Crop size={16} />} onClick={save} disabled={busy}>Save diagram</Button>
        </div>
      </div>
    </Modal>
  )
}
