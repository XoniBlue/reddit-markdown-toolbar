(() => {
  'use strict';

  // Demo harness:
  // This page is not used by the extension on Reddit; it's for manual testing
  // of toolbar behavior without depending on Reddit DOM details.
  const textarea = document.getElementById('demoTextarea');
  if (!textarea) return;

  const settings = {
    enableOldReddit: false,
    disabledButtons: [],
    compact: false,
    headingLevel: 3,
    rememberCollapsed: false,
    collapsed: false,
    debug: false,
    snippets: []
  };

  ToolbarManager.inject(textarea, settings);
  ToolbarManager.attachKeyboardShortcuts(textarea, settings);
})();
