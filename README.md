<!--
  Keep this README "repo-agnostic":
  - Badges use generic shields (no dependency on org/repo name).
  - Install instructions assume local unpacked extension during early development.
-->

# Reddit Markdown Toolbar

![Version](https://img.shields.io/badge/version-0.1.0-blue)
![Manifest](https://img.shields.io/badge/manifest-v3-brightgreen)
![License](https://img.shields.io/badge/license-MIT-black)

Chrome extension that adds a formatting toolbar to Reddit's Markdown editor (new Reddit and optional old Reddit).

This project is intentionally in early SemVer (`0.x.y`) while the UX and DOM hooks stabilize.

## Features

- Toolbar buttons: Bold, Italic, Strikethrough, Inline code, Code block, Link, Quote, Spoiler, Bullet list, Numbered list, Table, Heading, Horizontal rule, Clear formatting.
- Keyboard shortcuts:
  - Ctrl/Cmd+B: Bold
  - Ctrl/Cmd+I: Italic
  - Ctrl/Cmd+K: Link
  - Ctrl/Cmd+Shift+7: Numbered list
  - Ctrl/Cmd+Shift+8: Bullet list
  - Ctrl/Cmd+Shift+Q: Quote
  - Ctrl/Cmd+Shift+X: Strikethrough
  - Ctrl/Cmd+Shift+S: Spoiler
  - Ctrl/Cmd+Shift+H: Heading (default level)
- Options:
  - Enable on old.reddit.com
  - Compact toolbar
  - Remember collapsed state / start collapsed
  - Default heading level
  - Disable individual buttons
  - Up to 3 custom snippet buttons (templates can include `{selection}`)

## Install (Unpacked)

1. Open `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select this repository folder

## Development Notes

- The toolbar is injected by `content/content.js` after `TextareaDetector` finds the Markdown textarea(s).
- Reddit's modern composer uses nested shadow DOM; the extension includes shadow-root probing and optional shadow-root CSS injection.
- If Reddit updates their DOM, the mount-point discovery in `content/toolbar.js` is the usual place to adjust.

## Demo Page

For local manual testing, open:

`chrome-extension://<extension-id>/demo/demo.html`

## License

MIT (see `LICENSE`).
