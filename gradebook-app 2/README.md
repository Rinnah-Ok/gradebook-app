# Gradebook

A teacher's gradebook: overview analytics, a spreadsheet-style grades grid,
per-student reports, and class management. Data is stored in the browser
(`localStorage`) — no sign-in, no backend.

## Run it locally

You need [Node.js](https://nodejs.org) 18+ installed.

```bash
npm install
npm run dev
```

This starts a local dev server (usually at `http://localhost:5173`) with
hot-reload. Open that URL in your browser.

To build an optimized production version:

```bash
npm run build
npm run preview   # preview the production build locally
```

The build output goes to `dist/`.

## Put it on the web

Any of these will get you a real, shareable URL in a few minutes.

### Option A — Vercel (easiest)

1. Push this folder to a GitHub repo (see below).
2. Go to [vercel.com](https://vercel.com), sign in with GitHub, click
   **Add New → Project**, and select the repo.
3. Vercel auto-detects Vite — leave the defaults and click **Deploy**.
4. You'll get a URL like `gradebook-yourname.vercel.app`.

### Option B — Netlify

1. Run `npm run build` locally to generate the `dist/` folder.
2. Go to [app.netlify.com/drop](https://app.netlify.com/drop) and drag the
   `dist` folder in. It deploys instantly with a shareable URL.
   (Or connect the GitHub repo for auto-deploys on every push, same as Vercel.)

### Option C — GitHub Pages

1. `npm run build`
2. Push the contents of `dist/` to a `gh-pages` branch (or use the
   `gh-pages` npm package: `npm i -D gh-pages`, add
   `"deploy": "gh-pages -d dist"` to `package.json` scripts, then
   `npm run build && npm run deploy`).
3. Enable GitHub Pages on that branch in the repo settings.

## Getting this into GitHub (if you haven't already)

```bash
cd gradebook-app
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
```

Then point Vercel/Netlify at that repo as in Option A/B above.

## Notes

- **Data storage**: everything (classes, students, marks, comments) is saved
  to the browser's `localStorage` on the device being used. It does not sync
  across devices or browsers. If you want real accounts and cloud sync
  (so a class's grades follow the teacher between a laptop and a phone),
  that's a separate step — ask and it can be added (e.g. via Supabase or
  Firebase) instead of localStorage.
- **Styling**: Tailwind is loaded via the CDN `<script>` tag in `index.html`
  for zero-config setup. That's fine for a project this size; if you later
  want faster load times, swap it for a proper Tailwind build step
  (`npm install -D tailwindcss postcss autoprefixer` + config files).
- **Reset demo data**: the Classes page has a "Reset demo data" button that
  restores the three seeded classes if you want to start over.
