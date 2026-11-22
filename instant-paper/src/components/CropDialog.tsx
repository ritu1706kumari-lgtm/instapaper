import { useEffect, useRef, useState } from 'react'
import { Crop, Maximize, RotateCcw } from 'lucide-react'
import { Button, Modal, Toggle } from './ui'
import { cropDataUrl } from '../lib/image'

type Rect = { x: number; y: number; w: number; h: number }
type Mode = 'new' | 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v))
const MIN = 0.03
const START: Rect = { x: 0.15, y: 0.25, w: 0.7, h: 0.3 }

const HANDLES: { mode: Mode; cls: string; cursor: string; label: string }[] = [
  { mode: 'nw', cls: 'left-0 top-0 -translate-x-1/2 -translate-y-1/2', cursor: 'nwse-resize', label: 'top-left corner' },
  { mode: 'ne', cls: 'right-0 top-0 translate-x-1/2 -translate-y-1/2', cursor: 'nesw-resize', label: 'top-right corner' },
  { mode: 'sw', cls: 'left-0 bottom-0 -translate-x-1/2 translate-y-1/2', cursor: 'nesw-resize', label: 'bottom-left corner' },
  { mode: 'se', cls: 'right-0 bottom-0 translate-x-1/2 translate-y-1/2', cursor: 'nwse-resize', label: 'bottom-right corner' },
  { mode: 'n', cls: 'left-1/2 top-0 -translate-x-1/2 -translate-y-1/2', cursor: 'ns-resize', label: 'top edge' },
  { mode: 's', cls: 'left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2', cursor: 'ns-resize', label: 'bottom edge' },
  { mode: 'w', cls: 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2', cursor: 'ew-resize', label: 'left edge' },
  { mode: 'e', cls: 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2', cursor: 'ew-resize', label: 'right edge' },
]

/**
 * Select a diagram on a photo.
 *  • drag a corner / edge handle to resize • drag inside the box to move it • drag anywhere else to draw a new box
 *  • keyboard: arrows move, Shift + arrows resize
 */
export function CropDialog({ src, onClose, onSave }: { src: string | null; onClose: () => void; onSave: (img: string) => void }) {
  const [rect, setRect] = useState<Rect>(START)
  const [clean, setClean] = useState(true)
  const [busy, setBusy] = useState(false)
  const [natural, setNatural] = useState({ w: 3, h: 4 })
  const box = useRef<HTMLDivElement>(null)
  const drag = useRef<{ mode: Mode; x: number; y: number; orig: Rect; prev: Rect; id: number } | null>(null)

  useEffect(() => { if (src) setRect(START) }, [src])

  const pos = (e: React.PointerEvent) => {
    const r = box.current!.getBoundingClientRect()
    return { x: clamp((e.clientX - r.left) / r.width), y: clamp((e.clientY - r.top) / r.height) }
  }

  const begin = (e: React.PointerEvent, mode: Mode) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    e.preventDefault()
    e.stopPropagation()
    const p = pos(e)
    drag.current = { mode, ...p, orig: mode === 'new' ? { x: p.x, y: p.y, w: 0, h: 0 } : rect, prev: rect, id: e.pointerId }
    if (mode === 'new') setRect({ x: p.x, y: p.y, w: MIN, h: MIN })
    box.current!.setPointerCapture(e.pointerId)
  }

  const onMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    const p = pos(e)
    const o = d.orig
    if (d.mode === 'move') {
      setRect({ ...o, x: clamp(o.x + p.x - d.x, 0, 1 - o.w), y: clamp(o.y + p.y - d.y, 0, 1 - o.h) })
      return
    }
    if (d.mode === 'new') {
      setRect({ x: Math.min(d.x, p.x), y: Math.min(d.y, p.y), w: Math.max(MIN, Math.abs(p.x - d.x)), h: Math.max(MIN, Math.abs(p.y - d.y)) })
      return
    }
    let { x, y, w, h } = o
    const right = o.x + o.w, bottom = o.y + o.h
    if (d.mode.includes('w')) { x = clamp(Math.min(p.x, right - MIN)); w = right - x }
    if (d.mode.includes('e')) { w = clamp(p.x, x + MIN) - x }
    if (d.mode.includes('n')) { y = clamp(Math.min(p.y, bottom - MIN)); h = bottom - y }
    if (d.mode.includes('s')) { h = clamp(p.y, y + MIN) - y }
    setRect({ x, y, w, h })
  }

  const end = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    // A simple tap (no real drag) outside the box shouldn't throw away the selection.
    if (d.mode === 'new') {
      const p = pos(e)
      if (Math.abs(p.x - d.x) < 0.02 && Math.abs(p.y - d.y) < 0.02) setRect(d.prev)
    }
    drag.current = null
  }

  const key = (e: React.KeyboardEvent) => {
    const d = 0.01 * (e.altKey ? 5 : 1)
    const map: Record<string, [number, number]> = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, -d], ArrowDown: [0, d] }
    const v = map[e.key]
    if (!v) return
    e.preventDefault()
    setRect((r) => e.shiftKey
      ? { ...r, w: clamp(r.w + v[0], MIN, 1 - r.x), h: clamp(r.h + v[1], MIN, 1 - r.y) }
      : { ...r, x: clamp(r.x + v[0], 0, 1 - r.w), y: clamp(r.y + v[1], 0, 1 - r.h) })
  }

  const save = async () => {
    if (!src) return
    setBusy(true)
    try { onSave(await cropDataUrl(src, rect, clean)); onClose() } finally { setBusy(false) }
  }

  const pct = (n: number) => `${n * 100}%`
  // Live preview: scale the photo so the selected area fills the preview box.
  const prevW = 220
  const prevH = Math.min(220, (prevW * (rect.h * natural.h)) / Math.max(1e-6, rect.w * natural.w))

  return (
    <Modal open={!!src} onClose={onClose} title="Crop a diagram" wide>
      <p className="mb-3 text-sm text-ink-600 dark:text-ink-300">
        <b>Drag the yellow dots</b> to resize, <b>drag inside the box</b> to move it, or <b>draw a new box</b> anywhere on the photo.
      </p>
      {src && (
        <div className="grid gap-4 md:grid-cols-[1fr_240px]">
          <div className="grid place-items-center rounded-2xl bg-ink-900/90 p-4">
            <div
              ref={box}
              className="relative w-fit max-w-full touch-none select-none outline-none focus-visible:ring-4 focus-visible:ring-marigold"
              onPointerDown={(e) => begin(e, 'new')} onPointerMove={onMove} onPointerUp={end} onPointerCancel={end}
              tabIndex={0} role="application" onKeyDown={key}
              aria-label={`Diagram selection: ${Math.round(rect.x * 100)}% from left, ${Math.round(rect.y * 100)}% from top, ${Math.round(rect.w * 100)}% wide, ${Math.round(rect.h * 100)}% tall. Arrow keys move, Shift plus arrows resize.`}
              style={{ cursor: 'crosshair' }}
            >
              <img
                src={src} alt="Page to crop from" draggable={false}
                onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
                className="pointer-events-none block max-h-[62vh] w-auto max-w-full"
              />
              {/* dim outside the selection */}
              <div className="pointer-events-none absolute inset-0 bg-black/50" style={{ clipPath: `polygon(0 0,100% 0,100% 100%,0 100%,0 0,${pct(rect.x)} ${pct(rect.y)},${pct(rect.x)} ${pct(rect.y + rect.h)},${pct(rect.x + rect.w)} ${pct(rect.y + rect.h)},${pct(rect.x + rect.w)} ${pct(rect.y)},${pct(rect.x)} ${pct(rect.y)})` }} />
              {/* selection box */}
              <div
                className="absolute cursor-move border-2 border-marigold shadow-[0_0_0_1px_rgba(0,0,0,.5)]"
                style={{ left: pct(rect.x), top: pct(rect.y), width: pct(rect.w), height: pct(rect.h) }}
                onPointerDown={(e) => begin(e, 'move')}
              >
                <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3" aria-hidden>
                  {Array.from({ length: 9 }).map((_, i) => <span key={i} className="border border-white/25" />)}
                </div>
                {HANDLES.map((hd) => (
                  <span
                    key={hd.mode} aria-hidden
                    onPointerDown={(e) => begin(e, hd.mode)}
                    className={`absolute grid h-9 w-9 place-items-center ${hd.cls}`}
                    style={{ cursor: hd.cursor }}
                    title={`Drag ${hd.label}`}
                  >
                    <span className={`block rounded-full bg-marigold shadow-md ring-2 ring-white ${hd.mode.length === 2 ? 'h-4 w-4' : 'h-3 w-3'}`} />
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-[13px] font-semibold">Preview</p>
            <div className="grid min-h-28 place-items-center rounded-2xl bg-white p-2 ring-1 ring-ink-100 dark:ring-white/10">
              <div
                aria-label="Preview of the selected area" role="img"
                style={{
                  width: prevW, height: prevH,
                  backgroundImage: `url(${src})`,
                  backgroundSize: `${prevW / rect.w}px ${prevH / rect.h}px`,
                  backgroundPosition: `${(-rect.x * prevW) / rect.w}px ${(-rect.y * prevH) / rect.h}px`,
                  filter: clean ? 'grayscale(1) contrast(1.6) brightness(1.1)' : undefined,
                }}
              />
            </div>
            <Toggle id="clean" checked={clean} onChange={setClean} label="Clean up for printing (black & white)" />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="ghost" icon={<Maximize size={14} />} onClick={() => setRect({ x: 0, y: 0, w: 1, h: 1 })}>Whole photo</Button>
              <Button size="sm" variant="ghost" icon={<RotateCcw size={14} />} onClick={() => setRect(START)}>Reset</Button>
            </div>
          </div>
        </div>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" size="lg" icon={<Crop size={18} />} onClick={save} disabled={busy}>Use this diagram</Button>
      </div>
    </Modal>
  )
}
