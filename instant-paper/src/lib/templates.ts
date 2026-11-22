export interface TemplateLabels {
  cls: string; subject: string; time: string; mm: string; que: string; set: string
  name: string; roll: string; date: string; instructions: string; section: string; or: string
}

export interface TemplateDef {
  id: string
  name: string
  tagline: string
  /** CSS class applied to the paper root (styles in paper.css). */
  cls: string
  /** How each section heading is numbered. */
  heading: 'que' | 'section' | 'qdot' | 'roman'
  /** Number sub-questions as 1. 2. or (a) (b) or (i) (ii). */
  sub: 'decimal' | 'alpha' | 'roman'
  /** Board style: every question gets a continuous number across sections. */
  continuous: boolean
  studentFields: boolean
  labels: TemplateLabels
  accent: string
}

const EN: TemplateLabels = {
  cls: 'Class', subject: 'Sub', time: 'Time', mm: 'M.M', que: 'Que', set: 'Set',
  name: 'Name', roll: 'Roll No.', date: 'Date', instructions: 'General Instructions', section: 'Section', or: 'OR',
}

export const TEMPLATES: TemplateDef[] = [
  {
    id: 'littleflower', name: 'School Classic', tagline: 'Your current Little Flower format — Arial, ruled header, “Que 1.” headings',
    cls: 't-classic', heading: 'que', sub: 'decimal', continuous: false, studentFields: false, labels: EN, accent: '#1d4ed8',
  },
  {
    id: 'board', name: 'Board Exam', tagline: 'CBSE-style sections A–D, general instructions, continuous numbering',
    cls: 't-board', heading: 'section', sub: 'decimal', continuous: true, studentFields: true,
    labels: { ...EN, subject: 'Subject', time: 'Time Allowed', mm: 'Maximum Marks' }, accent: '#0f766e',
  },
  {
    id: 'primary', name: 'Junior / Primary', tagline: 'Large friendly type, name & roll lines, boxed questions',
    cls: 't-primary', heading: 'que', sub: 'alpha', continuous: false, studentFields: true, labels: EN, accent: '#c2410c',
  },
  {
    id: 'compact', name: 'Compact Unit Test', tagline: 'Saves paper — tighter spacing, options in a grid',
    cls: 't-compact', heading: 'qdot', sub: 'roman', continuous: false, studentFields: true,
    labels: { ...EN, subject: 'Subject', mm: 'Max. Marks' }, accent: '#7c3aed',
  },
  {
    id: 'hindi', name: 'हिंदी पारंपरिक', tagline: 'Hindi labels — कक्षा, विषय, समय, पूर्णांक, प्रश्न',
    cls: 't-hindi', heading: 'que', sub: 'decimal', continuous: false, studentFields: true,
    labels: { cls: 'कक्षा', subject: 'विषय', time: 'समय', mm: 'पूर्णांक', que: 'प्रश्न', set: 'सेट', name: 'नाम', roll: 'अनुक्रमांक', date: 'दिनांक', instructions: 'सामान्य निर्देश', section: 'खंड', or: 'अथवा' },
    accent: '#be123c',
  },
]

export const getTemplate = (id: string) => TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0]

const ROMAN = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii', 'xiii', 'xiv', 'xv', 'xvi', 'xvii', 'xviii', 'xix', 'xx']
export const roman = (n: number) => ROMAN[n - 1] ?? String(n)
export const ROMAN_UPPER = (n: number) => roman(n).toUpperCase()

export function subLabel(kind: TemplateDef['sub'], n: number) {
  if (kind === 'alpha') return `(${String.fromCharCode(96 + n)})`
  if (kind === 'roman') return `(${roman(n)})`
  return `${n}.`
}

export function sectionLabel(t: TemplateDef, i: number) {
  switch (t.heading) {
    case 'section': return `${t.labels.section.toUpperCase()} – ${String.fromCharCode(65 + i)}`
    case 'qdot': return `Q.${i + 1}`
    case 'roman': return `${ROMAN_UPPER(i + 1)}.`
    default: return `${t.labels.que} ${i + 1}.`
  }
}

export const OPTION_LABELS = ['(a)', '(b)', '(c)', '(d)', '(e)', '(f)']
