# Gradebook 📒

A little gradebook for teachers: overview stats, a spreadsheet-style grades grid, individual student reports, and a place to manage your classes. Everything saves right in your browser (`localStorage`), so there's no sign-in and no backend to deal with.

## Try it out on your computer

You'll need [Node.js](https://nodejs.org) 18 or newer.

```bash
npm install
npm run dev
```

That starts a local server, usually at `http://localhost:5173`. Just open that link in your browser and you're good to go. It updates live as you make changes.

When you want a polished version ready to share:

```bash
npm run build
npm run preview   # take a peek at the finished build
```

The finished files end up in the `dist/` folder.

## Share it online

Pick whichever feels easiest. Any of these gets you a real link in a few minutes.

### Option A: Vercel (the easiest one)

1. Push this folder to a GitHub repo (steps are below).
2. Head to [vercel.com](https://vercel.com), sign in with GitHub, click **Add New → Project**, and choose your repo.
3. Vercel figures out it's a Vite project on its own, so just leave the settings alone and hit **Deploy**.
4. You'll get a link like `gradebook-yourname.vercel.app`.

### Option B: Netlify

1. Run `npm run build` on your computer to make the `dist/` folder.
2. Go to [app.netlify.com/drop](https://app.netlify.com/drop) and drag the `dist` folder onto the page. It goes live right away with a link you can share.
   (You can also connect your GitHub repo so it updates every time you push, just like Vercel.)

### Option C: GitHub Pages

1. Run `npm run build`.
2. Push what's inside `dist/` to a `gh-pages` branch. Or use the `gh-pages` package: run `npm i -D gh-pages`, add `"deploy": "gh-pages -d dist"` to the scripts in `package.json`, then `npm run build && npm run deploy`.
3. Turn on GitHub Pages for that branch in your repo settings.

## Getting it onto GitHub (if you haven't yet)

```bash
cd gradebook-app
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
```

After that, connect Vercel or Netlify to the repo like in Option A or B.

## Good to know

- **Where your data lives:** classes, students, marks, and comments are all saved in your browser's `localStorage` on whatever device you're using. They won't sync between devices or browsers. If you'd like real accounts and cloud sync, so your grades follow you from laptop to phone, that's a separate add-on. You could use something like Supabase or Firebase instead of `localStorage`.
- **Styling:** Tailwind loads through a CDN `<script>` tag in `index.html`, so there's nothing to set up. That works great for a project this size. If you want it to load faster later, you can switch to a proper Tailwind build (`npm install -D tailwindcss postcss autoprefixer`, plus the config files).
- **Starting fresh:** the Classes page has a "Reset demo data" button that brings back the three starter classes if you want to wipe everything and begin again.
