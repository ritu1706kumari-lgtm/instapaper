import katex from 'katex'
import 'katex/contrib/mhchem'

export type Token = { t: 'text' | 'math' | 'blank'; v: string }

/** Split "Solve $x^2$ = ____ now" into text / math / blank tokens. */
export function tokenize(src: string): Token[] {
  const out: Token[] = []
  const re = /\$([^$]+)\$|_{3,}/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(src))) {
    if (m.index > last) out.push({ t: 'text', v: src.slice(last, m.index) })
    out.push(m[1] !== undefined ? { t: 'math', v: m[1] } : { t: 'blank', v: m[0] })
    last = m.index + m[0].length
  }
  if (last < src.length) out.push({ t: 'text', v: src.slice(last) })
  return out
}

const cache = new Map<string, string>()
export function mathHtml(latex: string): string {
  const hit = cache.get(latex)
  if (hit) return hit
  const html = katex.renderToString(latex, { throwOnError: false, output: 'html', strict: 'ignore' })
  cache.set(latex, html)
  return html
}

/* ---------- LaTeX → readable Unicode (used for Word export) ---------- */

const SUP: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾', n: 'ⁿ', x: 'ˣ', i: 'ⁱ', a: 'ᵃ', b: 'ᵇ', m: 'ᵐ', y: 'ʸ' }
const SUB: Record<string, string> = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉', '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎', a: 'ₐ', e: 'ₑ', x: 'ₓ', n: 'ₙ', m: 'ₘ' }
const SYMBOLS: Record<string, string> = {
  times: '×', div: '÷', pm: '±', mp: '∓', cdot: '·', le: '≤', leq: '≤', ge: '≥', geq: '≥', ne: '≠', neq: '≠', approx: '≈',
  infty: '∞', pi: 'π', theta: 'θ', alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', Delta: 'Δ', lambda: 'λ', mu: 'μ', sigma: 'σ',
  omega: 'ω', Omega: 'Ω', phi: 'φ', rho: 'ρ', angle: '∠', triangle: '△', perp: '⊥', parallel: '∥', circ: '°', degree: '°',
  rightarrow: '→', to: '→', leftarrow: '←', Rightarrow: '⇒', leftrightarrow: '↔', therefore: '∴', because: '∵', sum: 'Σ',
  int: '∫', in: '∈', cup: '∪', cap: '∩', subset: '⊂', cong: '≅', sim: '∼', propto: '∝', percent: '%', ldots: '…', dots: '…',
  quad: '  ', qquad: '    ', ',': ' ', ';': ' ', '!': '', '%': '%',
}

function readGroup(s: string, i: number): [string, number] {
  while (s[i] === ' ') i++
  if (s[i] === '{') {
    let depth = 1; let j = i + 1
    while (j < s.length && depth) { if (s[j] === '{') depth++; else if (s[j] === '}') depth--; j++ }
    return [s.slice(i + 1, j - 1), j]
  }
  if (s[i] === '\\') { const m = s.slice(i).match(/^\\[a-zA-Z]+/); if (m) return [m[0], i + m[0].length] }
  return [s[i] ?? '', i + 1]
}

const mapChars = (t: string, table: Record<string, string>) => {
  const conv = [...t].map((c) => table[c])
  return conv.every(Boolean) ? conv.join('') : null
}

function chem(src: string): string {
  return src
    .replace(/<=>/g, ' ⇌ ').replace(/->/g, ' → ').replace(/<-/g, ' ← ')
    .replace(/\^\{?([0-9]*[+-])\}?/g, (_, c: string) => mapChars(c, SUP) ?? `^${c}`)
    .replace(/([A-Za-z)\]])(\d+)/g, (_, a: string, d: string) => a + (mapChars(d, SUB) ?? d))
    .replace(/\s+/g, ' ').trim()
}

export function latexToUnicode(src: string): string {
  let out = ''
  let i = 0
  while (i < src.length) {
    const c = src[i]
    if (c === '\\') {
      const m = src.slice(i).match(/^\\([a-zA-Z]+|.)/)!
      const name = m[1]; i += m[0].length
      if (name === 'frac' || name === 'dfrac' || name === 'tfrac') {
        const [a, j] = readGroup(src, i); const [b, k] = readGroup(src, j); i = k
        const A = latexToUnicode(a); const B = latexToUnicode(b)
        out += /^[\w]+$/.test(A) && /^[\w]+$/.test(B) ? `${A}/${B}` : `(${A})/(${B})`
      } else if (name === 'sqrt') {
        let root = ''
        if (src[i] === '[') { const e = src.indexOf(']', i); root = src.slice(i + 1, e); i = e + 1 }
        const [a, j] = readGroup(src, i); i = j
        const A = latexToUnicode(a)
        out += (root ? mapChars(root, SUP) ?? root : '') + '√' + (/^[\w.]+$/.test(A) ? A : `(${A})`)
      } else if (name === 'ce' || name === 'pu') {
        const [a, j] = readGroup(src, i); i = j; out += chem(a)
      } else if (['text', 'mathrm', 'mathbf', 'textbf', 'mathit', 'operatorname', 'boxed', 'overline', 'bar', 'vec', 'hat'].includes(name)) {
        const [a, j] = readGroup(src, i); i = j
        out += (name === 'overline' || name === 'bar' ? '‾' : name === 'vec' ? '→' : '') + latexToUnicode(a)
      } else if (name === 'left' || name === 'right' || name === 'displaystyle' || name === 'big' || name === 'Big') {
        /* skip */
      } else if (SYMBOLS[name] !== undefined) out += SYMBOLS[name]
      else if (['sin', 'cos', 'tan', 'log', 'ln', 'cot', 'sec', 'cosec', 'csc'].includes(name)) out += name + ' '
      else out += name
    } else if (c === '^' || c === '_') {
      const [g, j] = readGroup(src, i + 1); i = j
      const v = latexToUnicode(g)
      if (g === '\\circ') { out += '°'; continue }
      out += mapChars(v, c === '^' ? SUP : SUB) ?? (c === '^' ? `^(${v})` : `_(${v})`)
    } else if (c === '{' || c === '}') i++
    else { out += c; i++ }
  }
  return out.replace(/\s{2,}/g, ' ')
}

/** Plain text version of a rich string, for Word export & accessibility labels. */
export function toPlain(src: string, blank = '____________'): string {
  return tokenize(src).map((tk) => (tk.t === 'text' ? tk.v : tk.t === 'blank' ? blank : latexToUnicode(tk.v))).join('')
}
