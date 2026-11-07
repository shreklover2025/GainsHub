# Strength Tracker — GitHub Pages + Supabase

## 1. Supabase
1. Create a project at https://supabase.com.
2. In **SQL Editor**, run `supabase.sql`.
3. In **Authentication → Providers → Email**, enable email/password sign-in. Email confirmation is recommended.
4. In **Project Settings → API**, copy the Project URL and the **publishable** key (or legacy anon key).
5. Paste them into `config.js`. Never use a secret or service-role key in client files.
6. Under **Authentication → URL Configuration**, set **Site URL** to your GitHub Pages address and add it under **Redirect URLs** as well (including a wildcard for subpaths if needed).

## 2. GitHub Pages
1. Create a repository `strength-tracker` in your GitHub account.
2. Upload `index.html`, `config.js`, and `supabase.sql` is **not necessary** for hosting (upload just index.html and config.js; README optional).
3. In repository **Settings → Pages**, choose **Deploy from a branch**, `main`, `/ (root)`.
4. Visit `https://YOUR-USERNAME.github.io/strength-tracker/`.
5. On iPhone Safari, Share → Add to Home Screen.

## 3. Sign in and sync
Create an account in the app. If email confirmation is enabled, confirm your email before signing in.
When signed in, sessions are stored in the cloud. The app merges locally cached per-account workouts with cloud records by unique session ID. The October 21 baseline is preloaded. Use **Sync now** to fetch changes made on another device; reload the page to sync on launch.

## 4. Existing workouts / backups
Your older app may have saved workouts under a different local storage key. Use **Export backup** in the old app, then **Import backup** in this version after signing in. The same ID is not duplicated. Keep backup JSON files.

## Notes and limitations
- Requires internet for cloud sync; local writes are retained if sync fails and can be retried with **Sync now**.
- This starter is not a fully offline-first multi-device conflict resolution engine. Avoid editing/deleting the same workout simultaneously on two devices.
- Cloud data is isolated by Supabase row-level security; GitHub Pages hosts only public frontend files.
- Data is not automatically shared with ChatGPT.
- The October 21 baseline includes exact sets only where reported.
