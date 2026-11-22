import { useEffect, useRef, useState, type ReactNode } from 'react'

export const A4_PX = (210 / 25.4) * 96 // 793.7px

/** Scales an A4 paper (rendered at true size) to fit the available width using CSS zoom. */
export function ScaledPaper({ children, max = 1, zoom: forced, className = '' }: { children: ReactNode; max?: number; zoom?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState(0.5)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setFit(Math.min(max, e.contentRect.width / A4_PX)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [max])
  const z = forced ?? fit
  return (
    <div ref={ref} className={`w-full ${className}`}>
      <div style={{ zoom: z, width: A4_PX }} className="mx-auto origin-top">{children}</div>
    </div>
  )
}

export function usePageBreaks(target: React.RefObject<HTMLElement | null>, deps: unknown[]) {
  const [breaks, setBreaks] = useState<number[]>([])
  useEffect(() => {
    const el = target.current
    if (!el) return
    const calc = () => {
      const mm = el.offsetWidth / 210
      const page = 297 * mm
      const content = (297 - 24) * mm
      const total = el.scrollHeight
      const out: number[] = []
      for (let y = 13 * mm + content; y < total - 4 * mm; y += content) out.push(y)
      setBreaks(total > page + 2 ? out : [])
    }
    calc()
    const ro = new ResizeObserver(calc)
    ro.observe(el)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return breaks
}
