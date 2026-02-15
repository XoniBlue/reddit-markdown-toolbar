# Development

## Quick Start

1. Load the extension as unpacked:
   - `chrome://extensions` -> Developer mode -> Load unpacked -> select the repo folder.
2. Open Reddit in Markdown mode and verify the toolbar appears.
3. Use the Options page to toggle features and debug logging.

## Debugging

- Enable "Debug logging" in options.
- Inspect the Reddit page, then filter the console for `RMT:`.

## Common Failure Modes

- Toolbar doesn't show:
  - Reddit changed DOM / shadow DOM structure: update `content/detector.js` probing.
  - Reddit isn't in Markdown mode: the detector intentionally targets Markdown composers.

- Toolbar shows but is misaligned:
  - Mount discovery in `content/toolbar.js` may be selecting the wrong row; adjust the action-row/header heuristics.

