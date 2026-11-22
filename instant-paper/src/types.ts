export type SectionType = 'list' | 'mcq' | 'match' | 'truefalse' | 'fill' | 'long'

export interface Question {
  id: string
  /** Question text. Supports $latex$ math, $\ce{H2O}$ chemistry and ____ blanks. */
  text: string
  /** MCQ options (a, b, c, d). */
  options?: string[]
  /** "OR" alternative question (board-exam style). */
  orText?: string
  /** Per-question marks, if the paper shows them next to each question. */
  marks?: string
  /** Data URL of a cropped diagram shown under the question. */
  image?: string
  /** Set by AI when the handwritten question has a figure that must be cropped in. */
  needsDiagram?: boolean
}

export interface MatchPair {
  id: string
  left: string
  right: string
}

export interface Section {
  id: string
  /** e.g. "Tick (✓) the correct answer:" */
  title: string
  /** As printed, e.g. "5" or "2½ × 8 = 20". */
  marks: string
  type: SectionType
  questions: Question[]
  pairs?: MatchPair[]
}

export interface PaperHeader {
  school: string
  exam: string
  className: string
  subject: string
  time: string
  maxMarks: string
  instructions: string[]
  logo?: string
}

export interface PhotoPage {
  id: string
  dataUrl: string
  name: string
}

export interface Paper {
  id: string
  name: string
  templateId: string
  photos: PhotoPage[]
  /** Cropped diagrams the user can attach to questions. */
  diagrams: string[]
  header: PaperHeader
  sections: Section[]
  fontScale: number
  showStudentFields: boolean
  status: 'empty' | 'ready' | 'generating' | 'done' | 'error'
  error?: string
  /** Set label printed on the paper, e.g. "A". */
  setLabel?: string
  /** Set A/B/C shuffle options for this paper. */
  sets?: SetOptions
  /** 'handwritten' = type out a teacher's paper; 'book' = create a paper from textbook pages. */
  mode?: 'handwritten' | 'book'
  book?: BookSettings
  updatedAt: number
}

export interface Settings {
  geminiKey: string
  groqKey: string
  geminiModel: string
  groqModel: string
  /** School code, only needed when the administrator set ACCESS_CODE. */
  accessCode?: string
  schoolName: string
  schoolLogo?: string
  theme: 'light' | 'dark' | 'system'
}

export type PatternType = 'mcq' | 'fill' | 'truefalse' | 'match' | 'oneword' | 'short' | 'long'
export interface PatternRow { id: string; type: PatternType; count: number; marks: number }
export interface BookSettings {
  pattern: PatternRow[]
  difficulty: 'easy' | 'mixed' | 'hard'
  source: 'book' | 'mixed' | 'new'
  language: 'same' | 'en' | 'hi'
  chapters: string
}

export interface SetOptions {
  count: number
  shuffleQuestions: boolean
  shuffleOptions: boolean
  shuffleMatch: boolean
  shuffleSections: boolean
}
