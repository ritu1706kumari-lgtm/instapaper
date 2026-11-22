import { forwardRef, useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { useStore } from '../store'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent'
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-ink-800 text-white hover:bg-ink-700 shadow-sm shadow-ink-900/20 dark:bg-ink-500 dark:hover:bg-ink-400',
  accent: 'bg-marigold text-ink-950 hover:brightness-105 shadow-sm shadow-marigold/30',
  secondary: 'bg-white text-ink-900 ring-1 ring-ink-200 hover:bg-ink-50 hover:ring-ink-300 dark:bg-white/5 dark:text-ink-50 dark:ring-white/15 dark:hover:bg-white/10',
  ghost: 'text-ink-800 hover:bg-ink-100/70 dark:text-ink-100 dark:hover:bg-white/10',
  danger: 'text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10',
}

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: 'sm' | 'md' | 'lg' | 'icon'
  icon?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button(
  { variant = 'secondary', size = 'md', icon, className = '', children, type = 'button', ...rest },
  ref,
) {
  const sizes = { sm: 'h-8 px-3 text-[13px] gap-1.5', md: 'h-10 px-4 text-sm gap-2', lg: 'h-12 px-6 text-base gap-2.5', icon: 'h-9 w-9 justify-center' }
  return (
    <button
      ref={ref}
      type={type}
      className={`inline-flex items-center rounded-xl font-medium transition-all duration-150 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none select-none ${sizes[size]} ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {icon}
      {children}
    </button>
  )
})

/* Native <dialog>: gives us focus trapping, Esc to close and an inert background for free. */
export function Modal({ open, onClose, title, children, wide, labelledBy }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean; labelledBy?: string }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  const id = labelledBy ?? `dlg-${title.replace(/\W+/g, '-')}`
  return (
    <dialog ref={ref} aria-labelledby={id} onCancel={(e) => { e.preventDefault(); onClose() }} onClick={(e) => { if (e.target === ref.current) onClose() }}>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className={`w-[calc(100vw-24px)] ${wide ? 'max-w-4xl' : 'max-w-xl'} max-h-[88vh] overflow-auto rounded-3xl bg-white p-6 text-ink-950 shadow-2xl dark:bg-[#191c28] dark:text-ink-50 scrollbar-thin`}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <h2 id={id} className="font-display text-2xl font-semibold tracking-tight">{title}</h2>
              <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close dialog"><X size={18} /></Button>
            </div>
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </dialog>
  )
}

export function Toasts() {
  const toasts = useStore((s) => s.toasts)
  const dismiss = useStore((s) => s.dismissToast)
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(420px,calc(100vw-32px))] flex-col gap-2 no-print" role="status" aria-live="polite">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, x: 40, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, transition: { duration: 0.18 } }}
            className={`pointer-events-auto flex items-start gap-3 rounded-2xl p-4 text-sm shadow-xl ring-1 ${
              t.kind === 'error' ? 'bg-red-50 text-red-900 ring-red-200 dark:bg-red-950 dark:text-red-100 dark:ring-red-800'
                : t.kind === 'success' ? 'bg-emerald-50 text-emerald-900 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-100 dark:ring-emerald-800'
                  : 'bg-white text-ink-900 ring-ink-200 dark:bg-[#1d2030] dark:text-ink-50 dark:ring-white/10'
            }`}
            role={t.kind === 'error' ? 'alert' : undefined}
          >
            {t.kind === 'error' ? <XCircle className="mt-0.5 shrink-0" size={18} aria-hidden /> : t.kind === 'success' ? <CheckCircle2 className="mt-0.5 shrink-0" size={18} aria-hidden /> : <Info className="mt-0.5 shrink-0" size={18} aria-hidden />}
            <p className="flex-1 leading-snug">{t.text}</p>
            <button className="rounded-md p-0.5 opacity-60 hover:opacity-100" onClick={() => dismiss(t.id)} aria-label="Dismiss notification"><X size={16} /></button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

export function Field({ label, hint, children, id }: { label: string; hint?: ReactNode; children: ReactNode; id: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-semibold text-ink-800 dark:text-ink-100">{label}</label>
      {children}
      {hint && <p className="text-xs text-ink-500 dark:text-ink-300" id={`${id}-hint`}>{hint}</p>}
    </div>
  )
}

export const inputCls =
  'w-full rounded-xl bg-white px-3 py-2 text-sm text-ink-950 ring-1 ring-ink-200 placeholder:text-ink-300 transition focus:outline-none focus:ring-2 focus:ring-ink-500 dark:bg-white/5 dark:text-ink-50 dark:ring-white/15 dark:placeholder:text-ink-400'

export function Toggle({ checked, onChange, label, id }: { checked: boolean; onChange: (v: boolean) => void; label: string; id: string }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center justify-between gap-3 py-1 text-sm">
      <span>{label}</span>
      <span className="relative">
        <input id={id} type="checkbox" role="switch" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="block h-6 w-11 rounded-full bg-ink-200 transition peer-checked:bg-ink-600 peer-focus-visible:ring-2 peer-focus-visible:ring-marigold dark:bg-white/15 dark:peer-checked:bg-ink-400" />
        <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  )
}
