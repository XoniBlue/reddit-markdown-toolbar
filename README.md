<div align="center">

# Reddit Markdown Toolbar

Formatting buttons for Reddit’s Markdown editor, injected directly into the composer.

`v0.1.0` (early development) | `Manifest v3`

![Version](https://img.shields.io/badge/version-0.1.0-blue)
![Manifest](https://img.shields.io/badge/manifest-v3-brightgreen)
![License](https://img.shields.io/github/license/XoniBlue/reddit-markdown-toolbar?color=black)
![Stars](https://img.shields.io/github/stars/XoniBlue/reddit-markdown-toolbar?style=flat)
![Issues](https://img.shields.io/github/issues/XoniBlue/reddit-markdown-toolbar)

</div>

---

> [!CAUTION]
> Reddit changes DOM structure often. If the toolbar “disappears” or misaligns after a Reddit update, the fix is usually in `content/toolbar.js` (mount discovery) or `content/detector.js` (textarea discovery).

> [!NOTE]
> This project is intentionally in early SemVer (`0.x.y`) while injection heuristics stabilize.

---

## Quick Start

### Prerequisites

- Chrome / Chromium-based browser (Chrome, Edge, Brave, etc.)
- Access to Reddit’s Markdown editor (post/comment in Markdown mode)

### Install (Unpacked)

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this repository folder
5. Visit `https://www.reddit.com/` and open a Markdown composer

Tip: Open the extension options page to toggle buttons, enable compact mode, or turn on debug logging.

---

## Requirements

| Requirement | Details |
| --- | --- |
| Browser | Chrome / Chromium-based browser |
| Target | `www.reddit.com` Markdown composer; `old.reddit.com` optional |
| Storage | `chrome.storage.sync` for settings |
| Permissions | `storage` only |

---

## ✨ Features & Compatibility

### What it does

- ✅ Adds a toolbar to Markdown textareas (including nested shadow DOM on modern Reddit)
- ✅ One-click formatting: bold/italic/strike/code/code block/link/quote/spoiler/lists/table/heading/hr
- ✅ “Aa” toggle to collapse/expand the toolbar (optionally persisted)
- ✅ Keyboard shortcuts for common actions
- ✅ Per-button disable toggles, compact mode, default heading level
- ✅ Up to 3 custom snippet buttons using templates (supports `{selection}`)

### What it does not do

- ❌ Does not touch Reddit’s Rich Text Editor
- ❌ Does not require a backend or external services
- ❌ Does not request broad permissions beyond `storage`

---

## ⌨️ Keyboard Shortcuts

- Ctrl/Cmd + B: Bold
- Ctrl/Cmd + I: Italic
- Ctrl/Cmd + K: Link
- Ctrl/Cmd + Shift + 7: Numbered list
- Ctrl/Cmd + Shift + 8: Bullet list
- Ctrl/Cmd + Shift + Q: Quote
- Ctrl/Cmd + Shift + X: Strikethrough
- Ctrl/Cmd + Shift + S: Spoiler
- Ctrl/Cmd + Shift + H: Heading (default level)

---

## ⚙️ Options

The options page persists settings in `chrome.storage.sync`:

- Enable on old.reddit.com
- Compact toolbar
- Remember collapsed state / start collapsed
- Default heading level (H1-H6)
- Disable individual buttons
- Custom snippet buttons (templates can include `{selection}`)

---

## ❓ FAQ

### Why doesn’t the toolbar show up?

- Ensure you are using **Markdown mode** (not Rich Text).
- Reddit may have restructured their composer DOM. Turn on **Debug logging** and check the DevTools console for `RMT:` messages.

### Why is the toolbar misaligned?

Modern Reddit uses nested shadow DOM and frequently changes layout. Mount discovery lives in `content/toolbar.js` and chooses between:

1. “actions row” near Cancel/Submit (preferred)
2. header row near “Switch to ...”
3. fallback insertion near textarea

If it’s mounting into the wrong row, adjust the heuristics there.

---

## Development

High-level architecture:

- `docs/ARCHITECTURE.md`
- `docs/DEVELOPMENT.md`

Demo page (isolated formatting testing, not a Reddit DOM replica):

- `chrome-extension://<extension-id>/demo/demo.html`

---

## License

MIT (see `LICENSE`).
