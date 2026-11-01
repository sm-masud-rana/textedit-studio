import { rgb } from 'pdf-lib';
export const B = 0.92; // baseline offset (fraction of font size from box top)
export const FAM = {
  Helvetica: ['Helvetica', 'HelveticaBold', 'HelveticaOblique', 'HelveticaBoldOblique'],
  Times: ['TimesRoman', 'TimesRomanBold', 'TimesRomanItalic', 'TimesRomanBoldItalic'],
  Courier: ['Courier', 'CourierBold', 'CourierOblique', 'CourierBoldOblique'],
};
export const CSS = { Helvetica: 'Helvetica, Arial, sans-serif', Times: '"Times New Roman", Times, serif', Courier: '"Courier New", monospace' };
export const hex = (a) => '#' + a.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
export const rgbOf = (h) => rgb(...[1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255));
export function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
// Estimate background (most common colour) and text colour (farthest from background) inside a box.
export function sample(c, b, s) {
  const x = Math.max(0, Math.floor(b.x * s)), y = Math.max(0, Math.floor(b.top * s));
  const w = Math.max(1, Math.min(c.width - x, Math.ceil(b.w * s))), h = Math.max(1, Math.min(c.height - y, Math.ceil(b.h * s)));
  const d = c.getContext('2d').getImageData(x, y, w, h).data, bins = {};
  for (let i = 0; i < d.length; i += 4) {
    const k = (d[i] >> 4) + ',' + (d[i + 1] >> 4) + ',' + (d[i + 2] >> 4);
    const o = (bins[k] ||= [0, 0, 0, 0]); o[0]++; o[1] += d[i]; o[2] += d[i + 1]; o[3] += d[i + 2];
  }
  const top = Object.values(bins).sort((a, b) => b[0] - a[0])[0];
  const bg = [top[1] / top[0], top[2] / top[0], top[3] / top[0]];
  let fg = [0, 0, 0], best = -1;
  for (let i = 0; i < d.length; i += 4) {
    const dist = (d[i] - bg[0]) ** 2 + (d[i + 1] - bg[1]) ** 2 + (d[i + 2] - bg[2]) ** 2;
    if (dist > best) { best = dist; fg = [d[i], d[i + 1], d[i + 2]]; }
  }
  return { bg: hex(bg), fg: hex(fg) };
}
