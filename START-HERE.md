# GainsHub

The app has since been updated with draft recovery, completed-set tracking, a rest timer, safer sync, validated imports, and offline support. Start with `README.md` for current run and deployment instructions. The notes below describe the original extracted snapshot; styles and scripts now live in separate files.

These are the latest saved project files from October 22, 2026. Later edits made directly on GitHub may not be included.

1. Extract the entire GainsHub folder.
2. In VS Code, choose File > Open Folder and select GainsHub.
3. index.html contains the interface, routines, and app logic. config.js contains the existing Supabase connection configuration.
4. Ask Codex to add Seated Calf Raises to both lower-body routines, preserving existing Calf Raises and workout history. This change has not yet been applied to these files.

README-original.md and supabase.sql are the original setup references. The original README describes the starter version; its preloaded baseline description does not describe the updated index.html. Your existing database is already set up, so you do not need to rerun supabase.sql. Workout records are stored separately in Supabase, not included in this source folder.

For local preview, run `python -m http.server 8000` in this folder if Python is installed, then visit http://localhost:8000.
