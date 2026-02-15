/**
 * Options Page
 *
 * Persists settings into `chrome.storage.sync` so they roam with the user's
 * Chrome profile (where supported).
 *
 * Important conventions:
 * - The "Toolbar Buttons" checkboxes are inverted:
 *   checked = disabled (stored in `disabledButtons`)
 * - Snippets are stored as up to 3 entries with `{ enabled, label, template }`.
 */
(function () {
  'use strict';

  /**
   * Storage schema defaults. Keep this aligned with `content/content.js`.
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

  // Load settings
  async function loadSettings() {
    try {
      const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);

      document.getElementById('enableOldReddit').checked = settings.enableOldReddit;
      document.getElementById('compactMode').checked = settings.compact;
      document.getElementById('debugLogging').checked = settings.debug;
      document.getElementById('rememberCollapsed').checked = settings.rememberCollapsed;
      document.getElementById('startCollapsed').checked = settings.collapsed;
      document.getElementById('headingLevel').value = String(settings.headingLevel || 3);

      // Custom snippets (up to 3)
      const snippets = Array.isArray(settings.snippets) ? settings.snippets : [];
      for (let i = 0; i < 3; i++) {
        const sn = snippets[i] || {};
        const enabledEl = document.getElementById(`snippetEnabled${i}`);
        const labelEl = document.getElementById(`snippetLabel${i}`);
        const tplEl = document.getElementById(`snippetTemplate${i}`);
        if (enabledEl) enabledEl.checked = !!sn.enabled;
        if (labelEl) labelEl.value = sn.label || '';
        if (tplEl) tplEl.value = sn.template || '';
      }

      // Load button toggles (checked = disabled)
      const buttonToggles = document.querySelectorAll('.button-toggle');
      buttonToggles.forEach(toggle => {
        const buttonId = toggle.getAttribute('data-button');
        toggle.checked = settings.disabledButtons.includes(buttonId);
      });
    } catch (error) {
      showStatus('Failed to load settings', 'error');
    }
  }

  // Save settings
  async function saveSettings() {
    const disabledButtons = [];
    const buttonToggles = document.querySelectorAll('.button-toggle');

    buttonToggles.forEach(toggle => {
      if (toggle.checked) {
        disabledButtons.push(toggle.getAttribute('data-button'));
      }
    });

    const settings = {
      enableOldReddit: document.getElementById('enableOldReddit').checked,
      compact: document.getElementById('compactMode').checked,
      disabledButtons: disabledButtons,
      debug: document.getElementById('debugLogging').checked,
      rememberCollapsed: document.getElementById('rememberCollapsed').checked,
      collapsed: document.getElementById('startCollapsed').checked,
      headingLevel: Math.max(1, Math.min(6, parseInt(document.getElementById('headingLevel').value, 10) || 3)),
      snippets: (() => {
        const out = [];
        for (let i = 0; i < 3; i++) {
          const enabled = document.getElementById(`snippetEnabled${i}`)?.checked;
          const label = (document.getElementById(`snippetLabel${i}`)?.value || '').trim();
          const template = document.getElementById(`snippetTemplate${i}`)?.value || '';
          if (!label && !template) continue;
          out.push({ enabled: !!enabled, label, template });
        }
        return out;
      })()
    };

    try {
      await chrome.storage.sync.set(settings);
      showStatus('Settings saved successfully!', 'success');
    } catch (error) {
      showStatus('Failed to save settings', 'error');
    }
  }

  // Reset to defaults
  async function resetSettings() {
    try {
      await chrome.storage.sync.set(DEFAULT_SETTINGS);
      await loadSettings();
      showStatus('Settings reset to defaults', 'success');
    } catch (error) {
      showStatus('Failed to reset settings', 'error');
    }
  }

  // Show status message
  function showStatus(message, type) {
    const status = document.getElementById('status');
    status.textContent = message;
    status.className = `status ${type}`;
    status.style.display = 'block';

    setTimeout(() => {
      status.style.display = 'none';
    }, 3000);
  }

  // Event listeners
  document.getElementById('save').addEventListener('click', saveSettings);
  document.getElementById('reset').addEventListener('click', resetSettings);

  // Load settings on page load
  loadSettings();
})();
