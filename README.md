# TextEdit Studio

Browser-based PDF and photo text editor. Files are processed **locally in your browser** and never stored or uploaded.

## Features
- PDF (multi-page): click text, edit, restyle, move, export edited PDF. Original file is never modified.
- JPG / PNG / WEBP: OCR (Tesseract.js) detects text lines; edit selected lines; export PNG or JPG.
- Font family/size, bold/italic, text + cover colour, alignment, nudge position, undo/redo, zoom, preview, reset, clear workspace, dark/light mode.

## Honest limitations
- Fonts: PDF export uses standard fonts (Helvetica / Times / Courier, Latin characters only). Original embedded fonts are **not** reproduced.
- PDF: the old text is covered by a coloured rectangle, not removed from the file. It may still be selectable/extractable.
- Images: background behind edited text is a flat colour sampled from the image. Gradients/textures will show a visible patch.
- OCR language data (English) and the OCR engine are downloaded from a public CDN on first use; your file itself is not uploaded.
- Rotated PDF pages are not supported.
- Do not use this tool to falsify official documents, financial records, receipts or identity documents.

## Run locally
```bash
npm install
npm run dev
```

## Deploy to GitHub Pages
1. Create a GitHub repo and push this project to the `main` branch.
2. Repo **Settings → Pages → Source: GitHub Actions**.
3. Every push to `main` runs `.github/workflows/deploy.yml` and publishes to `https://<user>.github.io/<repo>/`.

`vite.config.js` uses `base: './'`, so it works under any repo name.
