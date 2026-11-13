# GainsHub

A mobile workout journal using HTML, CSS, JavaScript, and the existing Supabase backend. No framework or build step is required.

## Run locally

Install Node.js LTS, then run `npm start` from this folder and open http://127.0.0.1:8000. Restart the terminal if Node was just installed. Opening `index.html` directly cannot enable the service worker; use the local server or HTTPS hosting.

## Logging workouts

The Guide tab in the app provides step-by-step instructions for accounts, logging sets, Done and Skip today, saving, progress, backups, offline use, and updates. It is also available offline once the app shell is cached.

History uses compact expandable cards grouped by month, newest first. Filter by routine, then select View workout to see a set-by-set table, notes, skipped exercises, and Edit/Delete controls. Expanded cards stay open during background syncing in the same account.

- Unfinished workouts save automatically on this device, separately for guests and each signed-in account. Reopen the Log workout tab to resume after a reload.
- Once you enter a set in a new workout, History shows an In progress draft log with a Resume workout button. It survives reloads and keeps checked sets, incomplete entries, and collapsed/skipped exercises. Finish & Save Workout removes the draft entry and creates the finalized workout. There is one active draft per account on each device; unfinished drafts are not included in finalized workout counts or backups.
- Delete draft in History removes the current account's unfinished draft from this device after confirmation, clears the logger, and stops the rest timer. Saved workout history stays unchanged.
- New exercises start with the weight from the last recorded set in your own saved history, or blank if there is no history. No preset starting weights are used. Cloud history can update untouched suggestions without replacing entered values. Existing drafts keep their entries; start a new workout to replace values carried over from an older draft.
- Assisted Pull-Ups and Chest Dips use signed loads: negative means assistance, zero means bodyweight, and positive means added weight. Other exercises still require nonnegative loads. Older unversioned pull-up assistance records/drafts are converted from positive assistance amounts to negatives once. New sessions/backups carry `weightConvention: signed-v1` so positive added loads are preserved. Progression and records treat a higher signed value as harder. Signed exercise charts show load/assistance only; volume and estimated 1RM are disabled because bodyweight is not recorded. Update all devices before logging with the new convention.
- Pull-Ups (formerly Assisted Pull-Ups) and Chest Dips have per-set +/− buttons: choose + for added load or − for assistance, then enter a positive amount. For example, + and 45 stores +45 lb; − and 40 stores −40 lb. Zero means bodyweight. Legacy exercise names, history, and drafts map to Pull-Ups automatically. The selected sign is saved with the draft and is locked until the set is unchecked.
- Enter weight and reps, then check the set's completion box. Only checked sets are saved; existing sessions open for editing with their recorded sets checked.
- The dark logger grid shows set number, previous performance, weight, reps, and a completion checkmark. Completed rows turn green; uncheck a row to edit its locked inputs. The three-dot exercise menu provides Add set, Skip exercise, and individual set removal.
- The plate guide below each configured set explains the total starting weight and exact plate counts per side. Barbells start at 45 lb, Seated Calf Raises at 60 lb, and Belt Squat Machine at 68 lb. All are loaded evenly on two sides and logged totals include starting weight. Available plates are 45, 35, 25, 10, 5, and 2.5 lb; 35 lb plates are allowed only for Back Squat, Romanian Deadlift, Conventional Deadlift, Bulgarian Split Squat, Bent-Over Row, and Overhead Press. The guide minimizes plate count, preferring larger plates for ties, and assumes sufficient quantities of the configured sizes. Unreachable totals show nearby loadable totals without changing your input. Other equipment stays unconfigured until its loading details are supplied.
- Signed-in, online checkmark changes save an account-scoped live workout checkpoint through the Supabase SDK in the existing `workout_sessions` table. Checkpoints use `session.kind = 'live-workout'` and are excluded from finalized History and progression. A spinner appears only after 150 ms. Failed writes undo the completion change while retaining weight and reps, and show an error. Guests and offline users keep local drafts; Finish & Save Workout still finalizes the session and queues it for normal sync.
- Checking a set opens the rest timer inside that exercise card. Stop or expiry collapses it; completing another set opens it again. The most recently completed exercise owns the single active rest period. Choose the duration above the exercise list. Switching routines, skipping the active exercise, or deleting the draft stops the timer. Time is calculated from a deadline, so returning from another tab shows the correct remaining time; no notification is promised while the app is closed.
- Completing set 3 does not start a rest timer and closes any timer still running for that exercise. Other set numbers retain the automatic timer behavior.
- Select Done after checking off all sets for an exercise to collapse its card. Reopen expands it for review or changes. Collapsed cards keep their sets and remain collapsed when a draft is restored. Save workout still saves the full session, including collapsed exercises.
- Skip today collapses an exercise and leaves it out of the saved sets. Reopen restores its entered sets so you can change your mind. Skips are retained in drafts, backups, cloud data, and History.
- Finish & Save Workout is at the bottom of the workout form. It saves checked sets; if some exercises remain unfinished, it asks before finishing a partial session. At least one completed set is required. A confirmation distinguishes device saving from cloud sync.
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
- `js/history.js`: expandable workout history, month grouping, and routine filtering
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
