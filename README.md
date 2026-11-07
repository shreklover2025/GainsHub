# GainsHub

A mobile workout journal using HTML, CSS, JavaScript, and the existing Supabase backend. No framework or build step is required.

## Run locally

Install Node.js LTS, then run `npm start` from this folder and open http://127.0.0.1:8000. Restart the terminal if Node was just installed. Opening `index.html` directly cannot enable the service worker; use the local server or HTTPS hosting.

## Logging workouts

The Guide tab in the app provides step-by-step instructions for accounts, logging sets, Done and Skip today, saving, progress, backups, offline use, and updates. It is also available offline once the app shell is cached.

- Unfinished workouts save automatically on this device, separately for guests and each signed-in account. Reopen the Log workout tab to resume after a reload.
- Enter weight and reps, then check the set's completion box. Only checked sets are saved; existing sessions open for editing with their recorded sets checked.
- Checking a set starts the selected rest timer. Start and Stop also work independently. Time is calculated from a deadline, so returning from another tab shows the correct remaining time; no notification is promised while the app is closed.
- Select Done after checking off all sets for an exercise to collapse its card. Reopen expands it for review or changes. Collapsed cards keep their sets and remain collapsed when a draft is restored. Save workout still saves the full session, including collapsed exercises.
- Skip today collapses an exercise and leaves it out of the saved sets. Reopen restores its entered sets so you can change your mind. Skips are retained in drafts, backups, cloud data, and History.
- The finish bar shows completed, skipped, and remaining exercises and stays visible while logging. Finish & Save Workout saves checked sets; if some exercises remain unfinished, it asks before finishing a partial session. At least one completed set is required. A confirmation distinguishes device saving from cloud sync.
- The active account (or Guest) appears above the form and beside the finish button. Check it before logging, especially on shared devices.
- Saving highlights a new highest weight or more reps at the same weight compared with earlier history loaded for that account. Assisted pull-ups celebrate reduced assistance; standing and seated calf records stay separate. First logs establish a benchmark rather than a new record.
- Use last workout's sets copies weights and reps for exercises in the selected routine. Copied sets start unchecked.
- Changing routines or opening another workout asks before replacing an unfinished draft.
- Export backups from History. Imports validate the entire backup before merging new workout IDs. Existing IDs remain unchanged; invalid files are rejected.

## Sync and offline use

The app preserves the existing local history keys and Supabase `workout_sessions` table. No database migration is needed. `config.js` remains the public browser configuration; never put a service-role key in it. Existing row-level security must continue to restrict each user to their own rows.

Signed-in saves sync automatically. Failed requests retry with a delay, and the app retries when connectivity returns, when brought to the foreground, and periodically while visible. The queue remains on the device until acknowledged. Guest history stays separate from signed-in history; export/import it to transfer workouts.

Cloud updates compare the row's previous `updated_at` value. If another device changed it, the app keeps the remote version and creates a separate copy of the device edit with an explanatory note. Conflicting deletions are cancelled. Check History before removing duplicates. Open edits retain their original cloud version even if background sync downloads a newer version. All devices should run this version for conditional-write protection; older clients can still overwrite cloud rows.

Visit once online and wait for “Ready to reopen offline on this device.” The service worker caches the public app shell and bundled SDK, never account API responses. Workouts and drafts remain in device storage. Install from your browser's install menu or Add to Home Screen where supported. Signing in for the first time and cloud syncing require a connection. Device/browser storage can be cleared by the browser or user, so keep exported backups.

## Project layout

- `index.html`: page markup
- `styles.css`: appearance and mobile layout
- `assets/`: original artwork and app icons
- `js/app.js`: workout forms, draft storage, account UI, charts, and sync orchestration
- `js/records.js`: personal-record comparisons
- `js/updates.js`: update notices and draft preservation before reloads
- `js/data.js`: backup validation and normalization
- `js/sync.js`: paginated cloud reads and conditional writes
- `vendor/`: pinned Supabase SDK for offline startup
- `sw.js` and `manifest.webmanifest`: offline shell and installation
- `supabase.sql`: original schema reference; do not rerun against an existing database as part of this update

## Verification

`npm install` installs the pinned test dependency. Run `npm test` for backup validation and conditional-write tests. Run `npm run test:browser` for Microsoft Edge checks covering mobile logging, draft recovery, imports, sync conflicts, and offline reloads. Browser tests use isolated temporary browser storage and a simulated cloud API; they do not change production workouts. The browser executable path in `tests/browser.cjs` currently targets Edge on Windows.

## Deployment and updates

Deploy `index.html`, `styles.css`, `config.js`, `js/`, `assets/`, `vendor/`, `manifest.webmanifest`, and `sw.js` together to the same HTTPS path. Relative paths support repository subdirectory hosting. These changes have not been published automatically.

For future releases, change the cache version in `sw.js` whenever cached assets change. Once a new version is downloaded, an Update available notice offers Update now. It saves the unfinished draft before activating the new version and reloading into the same section. Other open tabs running this version also preserve their drafts on the controller change. If device storage fails, the tab stays open with an error instead of deliberately reloading. Versions older than the update notice still need all app tabs closed once to receive this functionality. Keep `sw.js` and HTML revalidated by the host (`Cache-Control: no-cache` is recommended). The original setup notes are retained in `README-original.md`.
