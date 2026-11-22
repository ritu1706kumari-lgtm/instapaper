export const uid = () =>
  (globalThis.crypto && 'randomUUID' in globalThis.crypto)
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10)
