import { useState, useRef, useEffect, Fragment } from 'react';
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.js?url';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import Tesseract from 'tesseract.js';
import { FileText, Upload, Undo2, Redo2, ZoomIn, ZoomOut, Eye, RotateCcw, Trash2, Download, Sun, Moon, ChevronLeft, ChevronRight, Bold, Italic, AlignLeft, AlignCenter, AlignRight, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Loader2, X } from 'lucide-react';
import { B, FAM, CSS, rgbOf, sample, download } from './lib.js';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
const MAX = 50 * 2 ** 20;
const cls = 'inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none transition';
const Btn = ({ icon: I, children, primary, className = '', ...p }) => (
  <button {...p} className={`${cls} ${primary ? '!bg-indigo-600 !text-white !border-indigo-600 hover:!bg-indigo-500' : ''} ${className}`}>{I && <I size={16} />}{children}</button>
);

export default function App() {
  const [dark, setDark] = useState(matchMedia('(prefers-color-scheme: dark)').matches);
  const [doc, setDoc] = useState(null);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [dim, setDim] = useState({ w: 0, h: 0, fit: 1 });
  const [boxes, setBoxes] = useState([]);
  const [h, setH] = useState({ past: [], cur: [], future: [] });
  const [sel, setSel] = useState(null);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [preview, setPreview] = useState(false);
  const [fmt, setFmt] = useState('png');
  const cv = useRef();
  const edits = h.cur, s = dim.fit * zoom, ed = edits.find((e) => e.id === sel);

  useEffect(() => { document.documentElement.classList.toggle('dark', dark); }, [dark]);

  const commit = (next) => setH((x) => ({ past: [...x.past, x.cur], cur: next, future: [] }));
  const undo = () => setH((x) => (x.past.length ? { past: x.past.slice(0, -1), cur: x.past.at(-1), future: [x.cur, ...x.future] } : x));
  const redo = () => setH((x) => (x.future.length ? { past: [...x.past, x.cur], cur: x.future[0], future: x.future.slice(1) } : x));
  const wipe = () => { setDoc(null); setBoxes([]); setH({ past: [], cur: [], future: [] }); setSel(null); setPage(1); setZoom(1); setBusy(''); };

  async function load(file) {
    setErr('');
    if (!file) return;
    if (!/^(application\/pdf|image\/(jpeg|png|webp))$/.test(file.type)) return setErr('Unsupported file. Use PDF, JPG, PNG or WEBP.');
    if (file.size > MAX) return setErr('File is larger than 50 MB.');
    try {
      setBusy('Opening file…');
      const bytes = await file.arrayBuffer();
      wipe();
      if (file.type === 'application/pdf') {
        const pdf = await pdfjs.getDocument({ data: bytes.slice(0) }).promise;
        setDoc({ kind: 'pdf', name: file.name, bytes, pdf, pages: pdf.numPages, type: file.type });
      } else {
        const img = new Image();
        img.src = URL.createObjectURL(new Blob([bytes], { type: file.type }));
        await img.decode();
        setDoc({ kind: 'img', name: file.name, bytes, img, pages: 1, type: file.type });
      }
    } catch (e) { setErr('Could not open file: ' + e.message); wipe(); }
    setBusy('');
  }

  // Render page + detect text boxes (PDF.js text layer for PDFs)
  useEffect(() => {
    if (!doc) return;
    let dead = false, task;
    (async () => {
      const c = cv.current, W = Math.min(820, innerWidth - 48);
      if (doc.kind === 'pdf') {
        const pg = await doc.pdf.getPage(page), v1 = pg.getViewport({ scale: 1 });
        const fit = W / v1.width, v = pg.getViewport({ scale: fit * zoom });
        c.width = v.width; c.height = v.height;
        task = pg.render({ canvasContext: c.getContext('2d', { willReadFrequently: true }), viewport: v });
        await task.promise;
        const tc = await pg.getTextContent();
        if (dead) return;
        setDim({ w: v1.width, h: v1.height, fit });
        setBoxes(tc.items.map((it, i) => {
          const size = Math.hypot(it.transform[2], it.transform[3]) || it.height;
          return { key: page + ':' + i, x: it.transform[4], top: v1.height - it.transform[5] - size * B, w: it.width, h: size * 1.15, size, text: it.str };
        }).filter((b) => b.text.trim() && b.w > 0));
      } else {
        const { naturalWidth: w, naturalHeight: ht } = doc.img, fit = W / w;
        c.width = w * fit * zoom; c.height = ht * fit * zoom;
        const x = c.getContext('2d', { willReadFrequently: true });
        x.drawImage(doc.img, 0, 0, c.width, c.height);
        setDim({ w, h: ht, fit });
      }
    })().catch((e) => { if (e?.name !== 'RenderingCancelledException') setErr('Render failed: ' + e.message); });
    return () => { dead = true; task?.cancel(); };
  }, [doc, page, zoom]);

  // OCR for images
  useEffect(() => {
    if (doc?.kind !== 'img') return;
    let dead = false;
    (async () => {
      setBusy('Detecting text… 0%');
      const r = await Tesseract.recognize(doc.img.src, 'eng', { logger: (m) => m.status === 'recognizing text' && !dead && setBusy(`Detecting text… ${Math.round(m.progress * 100)}%`) });
      if (dead) return;
      setBoxes(r.data.lines.filter((l) => l.text.trim() && l.confidence > 30).map((l, i) => {
        const ht = l.bbox.y1 - l.bbox.y0;
        return { key: '1:' + i, x: l.bbox.x0, top: l.bbox.y0, w: l.bbox.x1 - l.bbox.x0, h: ht, size: ht * 0.9, text: l.text.trim() };
      }));
      setBusy('');
    })().catch((e) => { if (!dead) { setBusy(''); setErr('Text detection failed: ' + e.message); } });
    return () => { dead = true; };
  }, [doc]);

  const pick = (b) => {
    const ex = edits.find((e) => e.key === b.key);
    if (ex) return setSel(ex.id);
    const { bg, fg } = sample(cv.current, b, s);
    const e = { id: crypto.randomUUID(), key: b.key, page, text: b.text, x: b.x, top: b.top, w: b.w, h: b.h, ox: b.x, ot: b.top, ow: b.w, oh: b.h, size: Math.round(b.size * 10) / 10, family: 'Helvetica', bold: false, italic: false, color: fg, bg, align: 'left', dirty: false };
    commit([...edits, e]); setSel(e.id);
  };
  const upd = (patch) => commit(edits.map((e) => (e.id === sel ? { ...e, ...patch, dirty: true } : e)));
  const nudge = (dx, dy) => upd({ x: ed.x + dx, top: ed.top + dy });
  const revert = () => { commit(edits.filter((e) => e.id !== sel)); setSel(null); };

  async function exportFile() {
    const d = edits.filter((e) => e.dirty);
    if (!d.length) return setErr('Nothing to export yet. Select some text and change it first.');
    setBusy('Exporting…'); setErr('');
    try {
      const base = doc.name.replace(/\.[^.]+$/, '') + '-edited';
      if (doc.kind === 'pdf') {
        const pdf = await PDFDocument.load(doc.bytes.slice(0)), cache = {};
        for (const e of d) {
          const pg = pdf.getPage(e.page - 1), H = pg.getHeight(), nm = FAM[e.family][(e.bold ? 1 : 0) + (e.italic ? 2 : 0)];
          const f = (cache[nm] ||= await pdf.embedFont(StandardFonts[nm]));
          const tw = f.widthOfTextAtSize(e.text, e.size);
          pg.drawRectangle({ x: e.ox, y: H - e.ot - e.oh, width: e.ow, height: e.oh, color: rgbOf(e.bg) });
          const x = e.align === 'center' ? e.x + (e.w - tw) / 2 : e.align === 'right' ? e.x + e.w - tw : e.x;
          pg.drawText(e.text, { x, y: H - e.top - e.size * B, size: e.size, font: f, color: rgbOf(e.color) });
        }
        download(new Blob([await pdf.save()], { type: 'application/pdf' }), base + '.pdf');
      } else {
        const c = document.createElement('canvas'); c.width = dim.w; c.height = dim.h;
        const x = c.getContext('2d'); x.drawImage(doc.img, 0, 0);
        for (const e of d) {
          x.fillStyle = e.bg; x.fillRect(e.ox, e.ot, e.ow, e.oh);
          x.font = `${e.italic ? 'italic ' : ''}${e.bold ? 'bold ' : ''}${e.size}px ${CSS[e.family]}`;
          x.fillStyle = e.color; x.textBaseline = 'alphabetic';
          const tw = x.measureText(e.text).width;
          x.fillText(e.text, e.align === 'center' ? e.x + (e.w - tw) / 2 : e.align === 'right' ? e.x + e.w - tw : e.x, e.top + e.size * B);
        }
        const blob = await new Promise((r) => c.toBlob(r, fmt === 'png' ? 'image/png' : 'image/jpeg', 0.95));
        download(blob, base + '.' + fmt);
      }
    } catch (e) {
      setErr(/WinAnsi|encode/i.test(e.message) ? 'This text has characters the built-in PDF fonts cannot encode (only Latin characters are supported).' : 'Export failed: ' + e.message);
    }
    setBusy('');
  }

  const field = 'w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-sm';
  const Lbl = ({ t, children }) => <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-3">{t}<div className="mt-1">{children}</div></label>;

  return (
    <div className="h-screen flex flex-col bg-slate-50 text-slate-800 dark:bg-slate-950 dark:text-slate-100">
      <header className="flex items-center gap-2 px-3 h-14 shrink-0 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <FileText className="text-indigo-600" size={22} /><b className="mr-auto">TextEdit Studio</b>
        <Btn icon={Undo2} onClick={undo} disabled={!h.past.length} aria-label="Undo" title="Undo" />
        <Btn icon={Redo2} onClick={redo} disabled={!h.future.length} aria-label="Redo" title="Redo" />
        <Btn icon={dark ? Sun : Moon} onClick={() => setDark(!dark)} aria-label="Toggle theme" title="Theme" />
        {doc?.kind === 'img' && <select value={fmt} onChange={(e) => setFmt(e.target.value)} className={field + ' !w-auto'} aria-label="Export format"><option value="png">PNG</option><option value="jpg">JPG</option></select>}
        <Btn icon={Download} primary onClick={exportFile} disabled={!doc || !!busy}>Export</Btn>
      </header>
      {err && <div role="alert" className="flex items-center gap-2 px-4 py-2 text-sm bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-200"><span className="flex-1">{err}</span><button onClick={() => setErr('')} aria-label="Dismiss"><X size={16} /></button></div>}
      {busy && <div className="flex items-center gap-2 px-4 py-2 text-sm bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200"><Loader2 className="animate-spin" size={16} />{busy}</div>}

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        <aside className="shrink-0 lg:w-52 p-3 flex lg:flex-col flex-wrap gap-2 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <label className={cls + ' cursor-pointer'}><Upload size={16} />Open file<input type="file" hidden accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(e) => { load(e.target.files[0]); e.target.value = ''; }} /></label>
          {doc?.kind === 'pdf' && <div className="flex items-center gap-1 text-sm">
            <Btn icon={ChevronLeft} onClick={() => setPage(page - 1)} disabled={page < 2} aria-label="Previous page" />
            <span className="px-1 whitespace-nowrap">{page} / {doc.pages}</span>
            <Btn icon={ChevronRight} onClick={() => setPage(page + 1)} disabled={page >= doc.pages} aria-label="Next page" /></div>}
          <div className="flex items-center gap-1">
            <Btn icon={ZoomOut} onClick={() => setZoom(Math.max(0.5, +(zoom - 0.25).toFixed(2)))} disabled={!doc} aria-label="Zoom out" />
            <span className="text-sm w-12 text-center">{Math.round(zoom * 100)}%</span>
            <Btn icon={ZoomIn} onClick={() => setZoom(Math.min(3, +(zoom + 0.25).toFixed(2)))} disabled={!doc} aria-label="Zoom in" /></div>
          <Btn icon={Eye} onClick={() => setPreview(!preview)} disabled={!doc}>{preview ? 'Back to edit' : 'Preview'}</Btn>
          <Btn icon={RotateCcw} onClick={() => { commit([]); setSel(null); }} disabled={!edits.length}>Reset edits</Btn>
          {doc && <Btn icon={Download} onClick={() => download(new Blob([doc.bytes], { type: doc.type }), doc.name)}>Original file</Btn>}
          <Btn icon={Trash2} onClick={wipe} disabled={!doc} className="lg:mt-auto">Clear workspace</Btn>
        </aside>

        <main className="flex-1 overflow-auto p-4 flex" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); load(e.dataTransfer.files[0]); }}>
          {!doc ? (
            <label className="m-auto w-full max-w-lg cursor-pointer rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 p-10 text-center hover:border-indigo-500 transition">
              <Upload className="mx-auto mb-3 text-indigo-600" size={36} />
              <p className="font-semibold">Drop a PDF or photo here, or click to browse</p>
              <p className="text-sm text-slate-500 mt-1">PDF · JPG · PNG · WEBP · up to 50 MB. Processed locally in your browser, never stored.</p>
              <p className="text-xs text-slate-500 mt-3">For your own and authorized creative documents. Not for altering official, financial or identity documents.</p>
              <input type="file" hidden accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(e) => { load(e.target.files[0]); e.target.value = ''; }} />
            </label>
          ) : (
            <div className="m-auto relative shadow-xl bg-white" style={{ width: dim.w * s, height: dim.h * s }}>
              <canvas ref={cv} className="block" />
              {edits.filter((e) => e.page === page && e.dirty).map((e) => (
                <Fragment key={e.id}>
                  <div className="absolute" style={{ left: e.ox * s, top: e.ot * s, width: e.ow * s, height: e.oh * s, background: e.bg }} />
                  <div className="absolute whitespace-nowrap overflow-visible" style={{ left: e.x * s, top: e.top * s, width: e.w * s, height: e.h * s, fontSize: e.size * s, lineHeight: `${e.size * 1.15 * s}px`, fontFamily: CSS[e.family], fontWeight: e.bold ? 700 : 400, fontStyle: e.italic ? 'italic' : 'normal', color: e.color, textAlign: e.align }}>{e.text}</div>
                </Fragment>
              ))}
              {!preview && boxes.map((b) => {
                const on = edits.find((e) => e.key === b.key)?.id === sel && sel;
                return <button key={b.key} onClick={() => pick(b)} title={b.text} aria-label={'Edit: ' + b.text} className={`absolute border ${on ? 'border-indigo-600 bg-indigo-500/20' : 'border-indigo-400/50 hover:bg-indigo-400/20'}`} style={{ left: b.x * s, top: b.top * s, width: b.w * s, height: b.h * s }} />;
              })}
            </div>
          )}
        </main>

        <aside className="shrink-0 lg:w-72 max-h-72 lg:max-h-none overflow-auto p-4 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <h2 className="font-semibold mb-3">Text properties</h2>
          {!ed ? <p className="text-sm text-slate-500">{doc ? 'Click a highlighted text box on the page to edit it.' : 'Open a file to begin.'}</p> : (<>
            <Lbl t="Text"><input className={field} value={ed.text} onChange={(e) => upd({ text: e.target.value })} /></Lbl>
            <Lbl t="Font family"><select className={field} value={ed.family} onChange={(e) => upd({ family: e.target.value })}><option value="Helvetica">Sans (Helvetica)</option><option value="Times">Serif (Times)</option><option value="Courier">Mono (Courier)</option></select></Lbl>
            <Lbl t="Font size"><input type="number" min="4" max="300" step="0.5" className={field} value={ed.size} onChange={(e) => upd({ size: Math.max(4, +e.target.value || 4) })} /></Lbl>
            <div className="flex gap-2 mb-3">
              <Btn icon={Bold} onClick={() => upd({ bold: !ed.bold })} className={ed.bold ? '!bg-indigo-100 dark:!bg-indigo-900' : ''} aria-label="Bold" />
              <Btn icon={Italic} onClick={() => upd({ italic: !ed.italic })} className={ed.italic ? '!bg-indigo-100 dark:!bg-indigo-900' : ''} aria-label="Italic" />
              {[['left', AlignLeft], ['center', AlignCenter], ['right', AlignRight]].map(([a, I]) => <Btn key={a} icon={I} onClick={() => upd({ align: a })} className={ed.align === a ? '!bg-indigo-100 dark:!bg-indigo-900' : ''} aria-label={'Align ' + a} />)}
            </div>
            <div className="flex gap-3">
              <Lbl t="Text colour"><input type="color" value={ed.color} onChange={(e) => upd({ color: e.target.value })} className="h-9 w-full" /></Lbl>
              <Lbl t="Cover colour"><input type="color" value={ed.bg} onChange={(e) => upd({ bg: e.target.value })} className="h-9 w-full" /></Lbl>
            </div>
            <p className="text-xs font-medium text-slate-500 mb-1">Position (1 unit steps)</p>
            <div className="grid grid-cols-4 gap-2 mb-4">
              <Btn icon={ArrowLeft} onClick={() => nudge(-1, 0)} aria-label="Move left" /><Btn icon={ArrowUp} onClick={() => nudge(0, -1)} aria-label="Move up" />
              <Btn icon={ArrowDown} onClick={() => nudge(0, 1)} aria-label="Move down" /><Btn icon={ArrowRight} onClick={() => nudge(1, 0)} aria-label="Move right" />
            </div>
            <Btn icon={RotateCcw} onClick={revert} className="w-full">Revert this text</Btn>
            <p className="text-xs text-slate-500 mt-4">Fonts are approximated with Helvetica, Times or Courier; the original font is not reproduced. The cover colour is sampled from the page, so busy backgrounds may show a patch.{doc.kind === 'pdf' && ' Original PDF text is covered, not deleted from the file.'}</p>
          </>)}
        </aside>
      </div>
    </div>
  );
}
