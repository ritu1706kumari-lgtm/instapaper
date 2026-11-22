# Instant Paper

Turns photos of handwritten exam papers into neatly typed, print-ready question papers.

**Workflow:** take photos of the paper → pick a template → free AI reads the handwriting and fills the template → fix anything by clicking on the page → **Print**, **PDF** or **Word**.

- Works in English, Hindi (Devanagari) and mixed papers; maths (`$\frac{3}{4}$`, `$\sqrt{49}$`) and chemistry (`$\ce{H2SO4}$`) are typeset properly
- 5 templates: **School Classic** (your Little Flower format), Board Exam, Junior/Primary, Compact Unit Test, हिंदी पारंपरिक
- Several papers at once (tabs), with a **Read all papers** button
- **Set A / B / C / D** versions, with shuffled questions, MCQ options and match columns
- Diagrams: crop them from the photo (cleaned to black & white) or upload them
- Checks that section marks add up to the maximum marks
- Print any number of copies; PDF with smart page breaks (a question is never split across pages); Word (.docx) export
- Teachers just open the link: the school's AI key stays hidden on the server (no login, no database)
- Autosaves in the browser
- Keyboard and screen-reader friendly, dark mode, reduced-motion support

---

## 1. Deploy it once, with your school's AI key hidden on the server (about 15 minutes)

After this, teachers just open your link. **They never see or enter an API key.**
The key is kept in Vercel's secret settings, not in the website code, so nobody can copy it from the page.

### a) Get the free AI key (2 min)
1. Open **https://aistudio.google.com/apikey** and sign in with the school's Gmail account.
2. Click **Create API key** (no credit card needed) and copy it.

### b) Put the code on GitHub (5 min)
1. Create a free account at **https://github.com** → **New repository** → name it `instant-paper` → **Create**.
2. On the new repository page click **uploading an existing file**, drag in **all files and folders from this project** (not `node_modules`), and click **Commit changes**.

### c) Deploy on Vercel (5 min, free Hobby plan)
1. Go to **https://vercel.com/signup** → **Continue with GitHub**.
2. **Add New… → Project** → pick `instant-paper` → **Import**.
3. Open **Environment Variables** and add:

   | Name | Value | Needed? |
   |---|---|---|
   | `GEMINI_API_KEY` | the key from step (a) | **Required** |
   | `ACCESS_CODE` | a school code, e.g. `LFCS2026` | Recommended: stops strangers with the link from using up your free AI limit. Teachers type it once per device. |
   | `GROQ_API_KEY` | free key from https://console.groq.com/keys | Optional backup if the Gemini daily limit runs out |
   | `RATE_LIMIT_PER_HOUR` | e.g. `60` | Optional: max papers per device per hour (default 60) |

4. Click **Deploy**. You get a link like `https://instant-paper.vercel.app`. Share that link with your teachers.

To change the key or code later: Vercel → your project → **Settings → Environment Variables** → edit → **Deployments → Redeploy**.

> Free limits: Google's free tier allows a limited number of AI requests per day for the whole school (one request = one paper). That is normally plenty for exam season. If it runs out, it resets the next day, or the Groq backup takes over.
> Privacy: photos pass through your own Vercel function to Google and are not stored. On Google's free tier they may be used to improve Google's products.

### Advanced options
- A teacher can still paste a personal free key under **Settings → Advanced**. Their own key is then used instead of the school's.
- The app also works as a plain static site (Netlify Drop, GitHub Pages), but then there is no hidden key, and each user must add their own key in Settings.

## 2. Run it on your computer (optional, for developers)

You need Node.js 20 or newer (https://nodejs.org).

```bash
npm install
npm run dev            # website only; add a personal key in Settings to test the AI
# or, to also run the hidden-key server function locally:
npm i -g vercel && vercel dev   # put GEMINI_API_KEY in a .env.local file first
```

## How to use

| Step | What to do |
|---|---|
| Photos | **New paper → Choose photos** (or **Take photo** on a phone). Add every page in order. Use the rotate buttons if a page is sideways. |
| Template & AI | Pick a template → **Create paper with AI**. This takes about 10–40 seconds. |
| Edit & print | Click any text on the preview to change it (Enter saves, Esc cancels). Use the left panel to add, delete or reorder questions, insert maths symbols (½, √, x², H₂O…), and attach diagrams. |
| Sets | **Sets A/B** tab → choose 2–4 sets. Print, PDF and Word will include every set. |
| Output | **Print** (choose the number of copies), **PDF** (one file you can send to the photocopy shop) or **Word**. |

Typing tips for the question boxes:
- `____` (four underscores) prints a blank line
- `$\frac{3}{4}$` prints a fraction, `$x^2$` a power, `$\sqrt{49}$` a square root
- `$\ce{H2SO4}$` prints a chemical formula

## Tech notes

React 19 + TypeScript + Vite, Tailwind CSS 4, Motion (animations), Zustand + IndexedDB (autosave), KaTeX + mhchem (maths), `docx` (Word), `html-to-image` + `jsPDF` (PDF), browser print with A4 `@page` rules.
The AI logic is in `src/lib/aiCore.ts` (shared) and `src/lib/ai.ts` (browser). The hidden-key server function is `api/extract.ts`. The app lists the Flash models your key can use, picks the best free one, and falls back to other models (or Groq) when it hits a free-tier limit.
Templates live in `src/lib/templates.ts` (labels and numbering) and `src/paper.css` (look). To add a template, add an entry plus a `.t-yourname` CSS block.
