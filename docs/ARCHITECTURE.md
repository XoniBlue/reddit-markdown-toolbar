# Architecture

This extension is a "content-script only" Markdown toolbar that targets Reddit's Markdown composer on:

- `https://www.reddit.com/*` (modern Reddit)
- `https://old.reddit.com/*` (optional via settings)

## Key Modules

- `content/content.js`
  - Orchestrator: loads settings, watches DOM changes, asks `TextareaDetector` for Markdown textareas, then injects toolbars via `ToolbarManager`.
  - Owns runtime settings and the debug logger toggle.

- `content/detector.js`
  - Finds the correct Markdown textarea(s) and avoids non-editor textareas.
  - Handles nested shadow DOM, which modern Reddit uses.

- `content/toolbar.js`
  - Renders the toolbar, mounts it into the best available location, and provides the "Aa" toggle.
  - Contains keyboard shortcut bindings.
  - Injects a small CSS payload into shadow roots because extension CSS cannot pierce shadow DOM.

- `content/markdown.js`
  - Pure-ish transformations of textarea content (wrap selection, prefix lines, insert templates, etc.).
  - Always dispatches an `input` event after changes so React-controlled editors update properly.

- `options/`
  - A simple options page that reads/writes `chrome.storage.sync`.

## Data Flow

1. `content/content.js` loads settings from `chrome.storage.sync`.
2. It calls `TextareaDetector.findMarkdownTextareas()`.
3. For each textarea:
   - `ToolbarManager.inject(textarea, settings)` creates/mounts the toolbar.
   - `ToolbarManager.attachKeyboardShortcuts(textarea, getSettings)` binds keyboard shortcuts.

## Settings Schema (Sync Storage)

See the `DEFAULT_SETTINGS` object in `options/options.js`.

