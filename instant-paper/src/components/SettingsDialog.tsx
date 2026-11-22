import { useEffect, useState } from 'react'
import { CheckCircle2, Eye, EyeOff, ExternalLink, KeyRound, Loader2, ShieldCheck, Upload, Trash2 } from 'lucide-react'
import { useStore } from '../store'
import { Button, Field, Modal, inputCls } from './ui'
import { listGeminiModels, prettyModel } from '../lib/ai'
import { fileToCompressedDataUrl } from '../lib/image'

export function SettingsDialog() {
  const open = useStore((s) => s.settingsOpen)
  const setOpen = useStore((s) => s.openSettings)
  const settings = useStore((s) => s.settings)
  const setSettings = useStore((s) => s.setSettings)
  const toast = useStore((s) => s.toast)
  const updatePaper = useStore((s) => s.updatePaper)
  const papers = useStore((s) => s.papers)
  const [show, setShow] = useState(false)
  const [testing, setTesting] = useState(false)
  const [models, setModels] = useState<string[]>([])
  const server = useStore((s) => s.serverAI)

  useEffect(() => {
    if (open && settings.geminiKey && !models.length) listGeminiModels(settings.geminiKey).then(setModels).catch(() => {})
  }, [open, settings.geminiKey, models.length])

  const test = async () => {
    setTesting(true)
    try {
      const list = await listGeminiModels(settings.geminiKey.trim())
      setModels(list)
      toast('success', `Key works! ${list.length} models available — best free pick: ${prettyModel(list[0] ?? 'gemini-flash-latest')}.`)
    } catch (e) {
      toast('error', (e as Error).message)
    } finally {
      setTesting(false)
    }
  }

  const onLogo = async (f?: File) => {
    if (!f) return
    const url = await fileToCompressedDataUrl(f, 400, 0.92)
    setSettings({ schoolLogo: url })
    papers.forEach((p) => updatePaper(p.id, (x) => ({ ...x, header: { ...x.header, logo: url } })))
  }

  return (
    <Modal open={open} onClose={() => setOpen(false)} title="Settings">
      <div className="space-y-6">
        <section aria-labelledby="ai-h" className="space-y-4">
          <div className="flex items-center gap-2">
            <KeyRound size={18} className="text-marigold" aria-hidden />
            <h3 id="ai-h" className="font-semibold">AI connection</h3>
          </div>
          {server.available ? (
            <>
              <div className="flex items-start gap-3 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-100 dark:ring-emerald-500/30">
                <CheckCircle2 size={18} className="mt-0.5 shrink-0" aria-hidden />
                <p><b>School AI is connected.</b> Nothing to set up. Just add photos and create papers.</p>
              </div>
              {server.needsCode && (
                <Field id="code" label="School code" hint="Ask the principal/administrator for this code. You only need to enter it once on this device.">
                  <input id="code" className={`${inputCls} font-mono tracking-widest`} autoComplete="off" spellCheck={false} placeholder="e.g. LFCS2026"
                    value={settings.accessCode ?? ''} onChange={(e) => setSettings({ accessCode: e.target.value.trim() })} aria-describedby="code-hint" />
                </Field>
              )}
              <details className="rounded-2xl ring-1 ring-ink-100 dark:ring-white/10">
                <summary className="cursor-pointer list-none rounded-2xl px-4 py-3 text-sm font-semibold hover:bg-ink-50 dark:hover:bg-white/5">
                  Advanced: use my own free key instead <span className="font-normal text-ink-500">· optional</span>
                </summary>
                <div className="space-y-4 px-4 pb-4">
          <ol className="list-decimal space-y-1 rounded-2xl bg-marigold-soft/70 p-4 pl-8 text-sm text-ink-900 dark:bg-marigold/10 dark:text-ink-50">
            <li>Open <a className="font-semibold underline underline-offset-2" href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">Google AI Studio <ExternalLink size={12} className="inline" aria-hidden /><span className="sr-only">(opens in new tab)</span></a> and sign in with any Gmail account.</li>
            <li>Click <b>“Create API key”</b>. No credit card is needed.</li>
            <li>Copy the key and paste it below. Done — it stays only in this browser.</li>
          </ol>
          <Field id="gkey" label="Google Gemini API key (recommended)" hint="Free tier. Used to read handwriting in English, Hindi and maths.">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  id="gkey" className={`${inputCls} pr-10 font-mono`} type={show ? 'text' : 'password'} autoComplete="off" spellCheck={false}
                  placeholder="AIza…" value={settings.geminiKey}
                  onChange={(e) => { setSettings({ geminiKey: e.target.value.trim() }); setModels([]) }}
                  aria-describedby="gkey-hint"
                />
                <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-ink-400 hover:text-ink-700" onClick={() => setShow(!show)} aria-label={show ? 'Hide key' : 'Show key'}>
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <Button onClick={test} disabled={!settings.geminiKey || testing} icon={testing ? <Loader2 size={16} className="animate-spin" /> : undefined}>Test</Button>
            </div>
          </Field>
          <Field id="gmodel" label="Gemini model" hint="“Automatic” picks the best free Flash model and switches if one hits its free limit.">
            <select id="gmodel" className={inputCls} value={settings.geminiModel} onChange={(e) => setSettings({ geminiModel: e.target.value })}>
              <option value="auto">Automatic (recommended)</option>
              {models.map((m) => <option key={m} value={m}>{prettyModel(m)}</option>)}
            </select>
          </Field>
          <details className="group rounded-2xl ring-1 ring-ink-100 dark:ring-white/10">
            <summary className="cursor-pointer list-none rounded-2xl px-4 py-3 text-sm font-semibold hover:bg-ink-50 dark:hover:bg-white/5">
              Backup AI — Groq (optional) <span className="font-normal text-ink-500">· used if Gemini’s free limit runs out</span>
            </summary>
            <div className="space-y-3 px-4 pb-4">
              <p className="text-sm text-ink-600 dark:text-ink-300">Create a free key at <a className="font-semibold underline" href="https://console.groq.com/keys" target="_blank" rel="noreferrer">console.groq.com/keys</a>. Max 5 photos per paper.</p>
              <Field id="groq" label="Groq API key">
                <input id="groq" className={`${inputCls} font-mono`} type={show ? 'text' : 'password'} autoComplete="off" placeholder="gsk_…" value={settings.groqKey} onChange={(e) => setSettings({ groqKey: e.target.value.trim() })} />
              </Field>
              <Field id="groqm" label="Groq vision model">
                <input id="groqm" className={`${inputCls} font-mono`} value={settings.groqModel} onChange={(e) => setSettings({ groqModel: e.target.value })} />
              </Field>
            </div>
          </details>
                </div>
              </details>
            </>
          ) : (
            <>
          <ol className="list-decimal space-y-1 rounded-2xl bg-marigold-soft/70 p-4 pl-8 text-sm text-ink-900 dark:bg-marigold/10 dark:text-ink-50">
            <li>Open <a className="font-semibold underline underline-offset-2" href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">Google AI Studio <ExternalLink size={12} className="inline" aria-hidden /><span className="sr-only">(opens in new tab)</span></a> and sign in with any Gmail account.</li>
            <li>Click <b>“Create API key”</b>. No credit card is needed.</li>
            <li>Copy the key and paste it below. Done — it stays only in this browser.</li>
          </ol>
          <Field id="gkey" label="Google Gemini API key (recommended)" hint="Free tier. Used to read handwriting in English, Hindi and maths.">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  id="gkey" className={`${inputCls} pr-10 font-mono`} type={show ? 'text' : 'password'} autoComplete="off" spellCheck={false}
                  placeholder="AIza…" value={settings.geminiKey}
                  onChange={(e) => { setSettings({ geminiKey: e.target.value.trim() }); setModels([]) }}
                  aria-describedby="gkey-hint"
                />
                <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-ink-400 hover:text-ink-700" onClick={() => setShow(!show)} aria-label={show ? 'Hide key' : 'Show key'}>
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <Button onClick={test} disabled={!settings.geminiKey || testing} icon={testing ? <Loader2 size={16} className="animate-spin" /> : undefined}>Test</Button>
            </div>
          </Field>
          <Field id="gmodel" label="Gemini model" hint="“Automatic” picks the best free Flash model and switches if one hits its free limit.">
            <select id="gmodel" className={inputCls} value={settings.geminiModel} onChange={(e) => setSettings({ geminiModel: e.target.value })}>
              <option value="auto">Automatic (recommended)</option>
              {models.map((m) => <option key={m} value={m}>{prettyModel(m)}</option>)}
            </select>
          </Field>
          <details className="group rounded-2xl ring-1 ring-ink-100 dark:ring-white/10">
            <summary className="cursor-pointer list-none rounded-2xl px-4 py-3 text-sm font-semibold hover:bg-ink-50 dark:hover:bg-white/5">
              Backup AI — Groq (optional) <span className="font-normal text-ink-500">· used if Gemini’s free limit runs out</span>
            </summary>
            <div className="space-y-3 px-4 pb-4">
              <p className="text-sm text-ink-600 dark:text-ink-300">Create a free key at <a className="font-semibold underline" href="https://console.groq.com/keys" target="_blank" rel="noreferrer">console.groq.com/keys</a>. Max 5 photos per paper.</p>
              <Field id="groq" label="Groq API key">
                <input id="groq" className={`${inputCls} font-mono`} type={show ? 'text' : 'password'} autoComplete="off" placeholder="gsk_…" value={settings.groqKey} onChange={(e) => setSettings({ groqKey: e.target.value.trim() })} />
              </Field>
              <Field id="groqm" label="Groq vision model">
                <input id="groqm" className={`${inputCls} font-mono`} value={settings.groqModel} onChange={(e) => setSettings({ groqModel: e.target.value })} />
              </Field>
            </div>
          </details>
            </>
          )}
          <p className="flex gap-2 text-xs text-ink-500 dark:text-ink-300">
            <ShieldCheck size={16} className="shrink-0" aria-hidden />
            {server.available && !settings.geminiKey && !settings.groqKey ? 'Papers are saved only on this device. Photos pass through the school’s own server to Google’s AI and are not stored; on Google’s free tier they may be used to improve Google’s products.' : 'Keys and papers are stored only on this device. Photos go straight from your browser to the AI provider; on Google’s free tier they may be used to improve Google’s products.'}
          </p>
        </section>

        <section aria-labelledby="school-h" className="space-y-4 border-t border-ink-100 pt-5 dark:border-white/10">
          <h3 id="school-h" className="font-semibold">School details</h3>
          <Field id="school" label="School name (used on every new paper)">
            <input id="school" className={inputCls} value={settings.schoolName} onChange={(e) => setSettings({ schoolName: e.target.value })} />
          </Field>
          <div className="flex items-center gap-4">
            <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-2xl bg-ink-50 ring-1 ring-ink-100 dark:bg-white/5 dark:ring-white/10">
              {settings.schoolLogo ? <img src={settings.schoolLogo} alt="School logo" className="h-full w-full object-contain" /> : <span className="text-xs text-ink-400">No logo</span>}
            </div>
            <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-white px-4 text-sm font-medium ring-1 ring-ink-200 hover:bg-ink-50 focus-within:ring-2 focus-within:ring-marigold dark:bg-white/5 dark:ring-white/15">
              <Upload size={16} aria-hidden /> Upload logo
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => onLogo(e.target.files?.[0])} />
            </label>
            {settings.schoolLogo && (
              <Button variant="danger" size="sm" icon={<Trash2 size={14} />} onClick={() => { setSettings({ schoolLogo: undefined }); papers.forEach((p) => updatePaper(p.id, (x) => ({ ...x, header: { ...x.header, logo: undefined } }))) }}>Remove</Button>
            )}
          </div>
        </section>

        <div className="flex justify-end">
          <Button variant="primary" onClick={() => setOpen(false)}>Done</Button>
        </div>
      </div>
    </Modal>
  )
}
