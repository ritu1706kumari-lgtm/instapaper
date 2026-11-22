import { Fragment, memo } from 'react'
import type { Paper, Question, Section } from '../types'
import { getTemplate, OPTION_LABELS, sectionLabel, subLabel, type TemplateDef } from '../lib/templates'
import { Editable, RichText } from './RichText'
import { useStore } from '../store'
import { toPlain } from '../lib/latex'

interface Props {
  paper: Paper
  editable?: boolean
  /** Shown in print/preview only; used to give each print copy a unique key. */
  className?: string
  onDiagramClick?: (sid: string, qid: string) => void
}

function ClassName({ v }: { v: string }) {
  const m = v.match(/^(\d+)(st|nd|rd|th)$/i)
  return m ? <>{m[1]}<sup>{m[2]}</sup></> : <>{v}</>
}

export const PaperView = memo(function PaperView({ paper, editable = false, className = '', onDiagramClick }: Props) {
  const t = getTemplate(paper.templateId)
  const { setHeader, setSection, setQuestion, setPair } = useStore.getState()
  const h = paper.header
  const E = (value: string, onChange: (v: string) => void, label: string, placeholder?: string, cls?: string) => (
    <Editable value={value} onChange={onChange} label={label} placeholder={placeholder} editable={editable} className={cls} />
  )

  let counter = 0
  const sectionStart: number[] = paper.sections.map((s) => {
    const start = counter
    counter += s.type === 'match' ? 1 : Math.max(1, s.questions.length)
    return start
  })

  return (
    <article
      className={`paper ${t.cls} ${editable ? 'is-editable' : ''} ${className}`}
      style={{ ['--fs' as string]: paper.fontScale }}
      lang={/[ऀ-ॿ]/.test(JSON.stringify(paper.sections).slice(0, 4000)) ? 'hi' : 'en'}
      aria-label={`Question paper: ${paper.name}`}
    >
      <header className="p-header">
        {h.logo && <img className="p-logo" src={h.logo} alt="" />}
        <div className="p-titles">
          <h1>{E(h.school, (v) => setHeader(paper.id, 'school', v), 'school name', 'School name')}</h1>
          <h2>{E(h.exam, (v) => setHeader(paper.id, 'exam', v), 'exam name', 'Examination name')}</h2>
        </div>
        {paper.setLabel && <div className="p-set">{t.labels.set} – {paper.setLabel}</div>}
        <table className="p-info">
          <tbody>
            <tr>
              <td className="al">{t.labels.cls} – {editable ? E(h.className, (v) => setHeader(paper.id, 'className', v), 'class', 'Class') : <ClassName v={h.className} />}</td>
              <td className="ac">{t.labels.subject} – {E(h.subject, (v) => setHeader(paper.id, 'subject', v), 'subject', 'Subject')}</td>
              <td className="ac">{t.labels.time}: {E(h.time, (v) => setHeader(paper.id, 'time', v), 'time', 'Time')}</td>
              <td className="ar">{t.labels.mm}: {E(h.maxMarks, (v) => setHeader(paper.id, 'maxMarks', v), 'maximum marks', 'Marks')}</td>
            </tr>
          </tbody>
        </table>
      </header>

      {paper.showStudentFields && (
        <div className="p-student">
          <span>{t.labels.name}: <i className="fill-line wide" /></span>
          <span>{t.labels.roll}: <i className="fill-line" /></span>
          <span>{t.labels.date}: <i className="fill-line" /></span>
        </div>
      )}

      {h.instructions.length > 0 && (
        <section className="p-instructions" aria-label={t.labels.instructions}>
          <div className="p-instr-title">{t.labels.instructions}:</div>
          <ol>
            {h.instructions.map((ins, i) => (
              <li key={i}>
                {E(ins, (v) => setHeader(paper.id, 'instructions', h.instructions.map((x, k) => (k === i ? v : x)).filter((x, k) => x || k !== i)), `instruction ${i + 1}`)}
              </li>
            ))}
          </ol>
        </section>
      )}

      {paper.sections.length === 0 && <p className="p-empty">No questions yet.</p>}

      {paper.sections.map((s, i) => (
        <SectionBlock
          key={s.id} s={s} i={i} t={t} paperId={paper.id} editable={editable} start={sectionStart[i]}
          onSection={(patch) => setSection(paper.id, s.id, patch)}
          onQuestion={(qid, patch) => setQuestion(paper.id, s.id, qid, patch)}
          onPair={(pid, patch) => setPair(paper.id, s.id, pid, patch)}
          onDiagramClick={onDiagramClick}
        />
      ))}
    </article>
  )
})

interface SectionProps {
  s: Section; i: number; t: TemplateDef; paperId: string; editable: boolean; start: number
  onSection: (p: Partial<Section>) => void
  onQuestion: (qid: string, p: Partial<Question>) => void
  onPair: (pid: string, p: Partial<{ left: string; right: string }>) => void
  onDiagramClick?: (sid: string, qid: string) => void
}

function SectionBlock({ s, i, t, editable, start, onSection, onQuestion, onPair, onDiagramClick }: SectionProps) {
  const label = sectionLabel(t, i)
  const E = (value: string, onChange: (v: string) => void, lbl: string, placeholder?: string, cls?: string) => (
    <Editable value={value} onChange={onChange} label={lbl} placeholder={placeholder} editable={editable} className={cls} />
  )
  const numberOf = (k: number) => (t.continuous ? `${start + k + 1}.` : subLabel(t.sub, k + 1))

  return (
    <section className={`p-section type-${s.type}`} aria-label={`${label} ${toPlain(s.title)}`}>
      {t.heading === 'section' ? (
        <div className="p-sec-head board">
          <div className="p-sec-name">{label}</div>
          <div className="p-sec-row">
            <span className="p-sec-title">{E(s.title, (v) => onSection({ title: v }), `section ${i + 1} title`, 'Section instruction')}</span>
            {s.marks ? <span className="p-marks">({E(s.marks, (v) => onSection({ marks: v }), `section ${i + 1} marks`)})</span>
              : editable && <span className="p-marks add-marks no-print">{E('', (v) => onSection({ marks: v }), `section ${i + 1} marks`, '+ marks')}</span>}
          </div>
        </div>
      ) : (
        <div className="p-sec-head">
          <span className="p-sec-title">
            <span className="p-sec-num">{label}</span> {E(s.title, (v) => onSection({ title: v }), `question ${i + 1} title`, 'Instruction')}
          </span>
          {s.marks ? <span className="p-marks">({E(s.marks, (v) => onSection({ marks: v }), `question ${i + 1} marks`)})</span>
            : editable && <span className="p-marks add-marks no-print">{E('', (v) => onSection({ marks: v }), `question ${i + 1} marks`, '+ marks')}</span>}
        </div>
      )}

      {s.type === 'match' ? (
        <table className="p-match">
          <tbody>
            {(s.pairs ?? []).map((p, k) => (
              <tr key={p.id}>
                <td className="m-left"><span className="q-num">{subLabel(t.sub, k + 1)}</span> {E(p.left, (v) => onPair(p.id, { left: v }), `match left ${k + 1}`)}</td>
                <td className="m-dash">—</td>
                <td className="m-right">{E(p.right, (v) => onPair(p.id, { right: v }), `match right ${k + 1}`)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <ol className="q-list" role="list">
          {s.questions.map((q, k) => (
            <li className="q-item" key={q.id}>
              <span className="q-num" aria-hidden>{numberOf(k)}</span>
              <div className="q-body">
                <div className="q-line">
                  <span className="q-text">{E(q.text, (v) => onQuestion(q.id, { text: v }), `question ${i + 1}.${k + 1}`, 'Question text')}</span>
                  {q.marks && <span className="q-marks">[{E(q.marks, (v) => onQuestion(q.id, { marks: v }), 'question marks')}]</span>}
                </div>
                {q.needsDiagram && !q.image && editable && (
                  <button type="button" className="diagram-badge no-print" onClick={() => onDiagramClick?.(s.id, q.id)}>
                    Diagram needed — click to crop it from the photo
                  </button>
                )}
                {q.image && <img className="q-img" src={q.image} alt={`Diagram for question ${k + 1}`} />}
                {q.options && q.options.length > 0 && (
                  <div className={`q-options ${q.options.join('').length > 64 || q.options.some((o) => o.length > 22) ? 'two' : 'four'}`}>
                    {q.options.map((o, oi) => (
                      <span className="q-opt" key={oi}>
                        <span className="opt-label">{OPTION_LABELS[oi]}</span>{' '}
                        {E(o, (v) => onQuestion(q.id, { options: q.options!.map((x, xi) => (xi === oi ? v : x)) }), `option ${OPTION_LABELS[oi]}`)}
                      </span>
                    ))}
                  </div>
                )}
                {q.orText !== undefined && (
                  <Fragment>
                    <div className="q-or">{t.labels.or}</div>
                    <div className="q-text">{E(q.orText, (v) => onQuestion(q.id, { orText: v || undefined }), 'OR question', 'Alternative question')}</div>
                  </Fragment>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

export function PaperStatic({ paper }: { paper: Paper }) {
  return <PaperView paper={paper} editable={false} />
}

export { RichText }
