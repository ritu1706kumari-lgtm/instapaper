/** Read a File into a data URL, downscaled & JPEG-compressed so AI calls stay small and fast. */
export async function fileToCompressedDataUrl(file: File, maxSide = 2000, quality = 0.85): Promise<string> {
  const src = await new Promise<string>((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result as string)
    r.onerror = () => rej(r.error)
    r.readAsDataURL(file)
  })
  return compressDataUrl(src, maxSide, quality)
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image()
    img.onload = () => res(img)
    img.onerror = () => rej(new Error('Could not read this image. Try a JPG or PNG photo.'))
    img.src = src
  })
}

export async function compressDataUrl(src: string, maxSide = 2000, quality = 0.85): Promise<string> {
  const img = await loadImage(src)
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
  const c = document.createElement('canvas')
  c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale)
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height)
  ctx.drawImage(img, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', quality)
}

export async function rotateDataUrl(src: string, deg: 90 | -90): Promise<string> {
  const img = await loadImage(src)
  const c = document.createElement('canvas')
  c.width = img.height; c.height = img.width
  const ctx = c.getContext('2d')!
  ctx.translate(c.width / 2, c.height / 2)
  ctx.rotate((deg * Math.PI) / 180)
  ctx.drawImage(img, -img.width / 2, -img.height / 2)
  return c.toDataURL('image/jpeg', 0.9)
}

/** Crop using fractions (0..1) of the image, optionally boosting contrast for line drawings. */
export async function cropDataUrl(src: string, r: { x: number; y: number; w: number; h: number }, clean = true): Promise<string> {
  const img = await loadImage(src)
  const sx = r.x * img.width, sy = r.y * img.height, sw = r.w * img.width, sh = r.h * img.height
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(sw)); c.height = Math.max(1, Math.round(sh))
  const ctx = c.getContext('2d')!
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height)
  if (clean) {
    // Turn grey phone-photo paper into white and ink into black so diagrams print cleanly.
    const d = ctx.getImageData(0, 0, c.width, c.height)
    const p = d.data
    for (let i = 0; i < p.length; i += 4) {
      const l = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2]
      const v = l > 150 ? 255 : l < 90 ? 0 : Math.round(((l - 90) / 60) * 255)
      p[i] = p[i + 1] = p[i + 2] = v
    }
    ctx.putImageData(d, 0, 0)
    // Trim empty white margins so the diagram sits snugly under its question.
    let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
      if (p[(y * c.width + x) * 4] < 200) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
    }
    if (x1 > x0 && y1 > y0) {
      const pad = 8
      x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(c.width - 1, x1 + pad); y1 = Math.min(c.height - 1, y1 + pad)
      const t = document.createElement('canvas')
      t.width = x1 - x0 + 1; t.height = y1 - y0 + 1
      t.getContext('2d')!.drawImage(c, x0, y0, t.width, t.height, 0, 0, t.width, t.height)
      return t.toDataURL('image/png')
    }
  }
  return c.toDataURL('image/png')
}
