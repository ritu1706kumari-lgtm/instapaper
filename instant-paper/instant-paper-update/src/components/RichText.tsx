import { memo, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { mathHtml, tokenize } from '../lib/latex'

export const RichText = memo(function RichText({ text, placeholder }: { text: string; placeholder?: string }) {
  if (!text) return placeholder ? <span className="rt-placeholder">{placeholder}</span> : null
  return (
    <>
      {tokenize(text).map((tk, i) =>
        tk.t === 'math' ? (
          <span key={i} className="rt-math" dangerouslySetInnerHTML={{ __html: mathHtml(tk.v) }} />
        ) : tk.t === 'blank' ? (
          <span key={i} className="blank-line" aria-label="blank" />
        ) : (
          <span key={i} className="rt-text">{tk.v}</span>
        ),
      )}
    </>
  )
})

interface EditableProps {
  value: string
  onChange?: (v: string) => void
  label: string
  placeholder?: string
  editable?: boolean
  className?: string
  multiline?: boolean
}

/**
 * Shows rendered text (maths, blanks). Click / Enter / F2 turns it into a plain-text editor;
 * Enter or leaving the field saves, Escape cancels.
 */
export function Editable({ value, onChange, label, placeholder = 'Click to type', editable = true, className = '', multiline }: EditableProps) {
  const [editing, setEditing] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  const original = useRef(value)

  useEffect(() => {
    if (editing && ref.current) {
      ref.current.textContent = value
      ref.current.focus()
      const sel = window.getSelection()
      const range = document.createRange()
      range.selectNodeContents(ref.current)
      range.collapse(false)
      sel?.removeAllRanges(); sel?.addRange(range)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing])

  if (!editable || !onChange) return <span className={className}><RichText text={value} /></span>

  const commit = () => {
    const v = (ref.current?.textContent ?? '').replace(/ /g, ' ').replace(/\s+$/g, '')
    setEditing(false)
    if (v !== original.current) onChange(v)
  }

  const onKey = (e: KeyboardEvent<HTMLSpanElement>) => {
    if (e.key === 'Escape') { e.preventDefault(); if (ref.current) ref.current.textContent = original.current; setEditing(false) }
    if (e.key === 'Enter' && !(multiline && e.shiftKey)) { e.preventDefault(); commit() }
  }

  if (editing) {
    return (
      <span
        key="editing"
        ref={ref}
        className={`ed ed-active ${className}`}
        contentEditable="plaintext-only"
        suppressContentEditableWarning
        role="textbox"
        aria-label={label}
        aria-multiline={multiline}
        onBlur={commit}
        onKeyDown={onKey}
        spellCheck
      />
    )
  }

  return (
    <span
      key="view"
      className={`ed ${className}`}
      role="button"
      tabIndex={0}
      aria-label={`Edit ${label}: ${value || 'empty'}`}
      title="Click to edit"
      onClick={() => { original.current = value; setEditing(true) }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === 'F2' || e.key === ' ') { e.preventDefault(); original.current = value; setEditing(true) }
      }}
    >
      <RichText text={value} placeholder={placeholder} />
    </span>
  )
}
