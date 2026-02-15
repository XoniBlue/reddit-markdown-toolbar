/**
 * RMT Content Orchestrator
 *
 * Responsibilities:
 * - Load settings from `chrome.storage.sync`
 * - Detect Reddit Markdown textareas (including nested shadow DOM)
 * - Inject the toolbar into each textarea (once)
 * - Re-scan on SPA navigation / dynamic composer mounts
 *
 * Notes:
 * - This file intentionally does NOT contain DOM heuristics. Those live in:
 *   - `content/detector.js` (finding the right textarea)
 *   - `content/toolbar.js`  (mounting and rendering the toolbar)
 */
(async () => {
  'use strict';

  /**
   * Settings schema (stored in `chrome.storage.sync`).
   *
   * - `enableOldReddit`: enables injection on old.reddit.com
   * - `disabledButtons`: list of toolbar button IDs to hide/disable
   * - `compact`: smaller toolbar UI
   * - `headingLevel`: default heading level for the Heading button / shortcut
   * - `rememberCollapsed`: whether collapsing/expanding is persisted
   * - `collapsed`: initial (or persisted) collapsed state
   * - `debug`: enable verbose console logging
   * - `snippets`: optional custom snippet buttons: `{ enabled, label, template }[]`
   */
  const DEFAULT_SETTINGS = {
    enableOldReddit: false,
    disabledButtons: [],
    compact: false,
    headingLevel: 3,
    rememberCollapsed: true,
    collapsed: false,
    debug: false,
    snippets: []
  };

  /** @type {typeof DEFAULT_SETTINGS} */
  let settings = { ...DEFAULT_SETTINGS };

  const log = (...args) => {
    if (settings.debug) console.log(...args);
  };

  // Load settings
  async function loadSettings() {
    try {
      const result = await chrome.storage.sync.get(DEFAULT_SETTINGS);
      settings = /** @type {typeof DEFAULT_SETTINGS} */ (result);
      log('RMT: settings loaded', settings);
    } catch (err) {
      // Errors are useful even when debug is off.
      console.error('RMT: failed to load settings:', err);
    }
  }

  await loadSettings();
  if (globalThis.TextareaDetector?.setDebugEnabled) {
    globalThis.TextareaDetector.setDebugEnabled(settings.debug);
  }

  // Check if we should run on this page
  const isOldReddit = window.location.hostname === 'old.reddit.com';
  if (isOldReddit && !settings.enableOldReddit) {
    log('RMT: disabled on old.reddit.com');
    return;
  }

  /**
   * Processes a single textarea
   */
  function processTextarea(textarea) {
    if (TextareaDetector.isProcessed(textarea)) {
      return;
    }

    // Inject toolbar and bind shortcuts. Pass a getter so shortcuts always
    // respect latest settings without re-binding listeners.
    const toolbar = ToolbarManager.inject(textarea, settings);
    ToolbarManager.attachKeyboardShortcuts(textarea, () => settings);
    TextareaDetector.markAsProcessed(textarea, toolbar);
    log('RMT: toolbar injected');
  }

  /**
   * Scans page for new textareas
   */
  async function scanPage() {
    const textareas = await TextareaDetector.findMarkdownTextareas();
    log('RMT: markdown textareas found', textareas.length);

    textareas.forEach(processTextarea);
  }

  // Initial scan
  setTimeout(() => {
    scanPage();
  }, 1000); // Delay to ensure DOM is ready

  // Watch for DOM changes (SPA navigation, dynamic content)
  const observer = new MutationObserver((mutations) => {
    let shouldScan = false;

    for (const mutation of mutations) {
      // Check if textareas or composers were added
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.tagName === 'TEXTAREA' ||
                node.querySelector && (
                  node.querySelector('textarea') ||
                  node.tagName === 'SHREDDIT-COMPOSER' ||
                  node.querySelector('shreddit-composer')
                )) {
              shouldScan = true;
              log('RMT: new textarea/composer detected');
              break;
            }
          }
        }
      }
      if (shouldScan) break;
    }

    if (shouldScan) {
      // Debounce scan to avoid doing heavy DOM traversal on every mutation.
      setTimeout(scanPage, 100);
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Watch for SPA navigation
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      log('RMT: URL changed', url);
      setTimeout(scanPage, 500); // Give React time to render
    }
  }).observe(document.querySelector('title') || document.head, {
    subtree: true,
    characterData: true,
    childList: true
  });

  // Listen for settings changes
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync') {
      loadSettings().then(() => {
        if (globalThis.TextareaDetector?.setDebugEnabled) {
          globalThis.TextareaDetector.setDebugEnabled(settings.debug);
        }
        log('RMT: settings updated');
      });
    }
  });

  log('RMT: init complete');
})();
