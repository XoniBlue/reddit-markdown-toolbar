/**
 * ToolbarManager
 *
 * Renders buttons and mounts the toolbar near Reddit's Markdown composer.
 *
 * Mount strategy (modern Reddit):
 * - Prefer mounting into the bottom action row near Cancel/Submit, aligned with
 *   the Rich Text Editor's layout.
 * - Fallback to the header row near "Switch to ..." controls.
 * - Last resort: insert directly before the textarea.
 *
 * Shadow DOM notes:
 * - Content-script CSS does not apply inside shadow roots.
 * - When injecting into a composer shadow root, we also inject a small `<style>`
 *   tag with toolbar styles (`SHADOW_CSS`).
 */
const ToolbarManager = globalThis.ToolbarManager = (() => {
  'use strict';

  const TOOLBAR_CLASS = 'rmt-toolbar';
  const TOOLBAR_BUTTON_CLASS = 'rmt-btn';
  const TOOLBAR_COLLAPSED_CLASS = 'rmt-collapsed';
  const TOGGLE_CLASS = 'rmt-toggle';
  const TOOLBAR_IN_HEADER_CLASS = 'rmt-in-header';
  const TOOLBAR_IN_ACTIONS_CLASS = 'rmt-in-actions';
  const ACTIONS_LEFT_CLASS = 'rmt-actions-left';
  const SHADOW_STYLE_ATTR = 'data-rmt-shadow-style';

  // Content-script CSS doesn't penetrate shadow roots, so we also inject a small
  // style tag when running inside Reddit's composer shadow DOM.
  const SHADOW_CSS = `
.rmt-toolbar{display:flex !important;flex-direction:row !important;align-items:center;gap:10px;padding:10px 12px;background:transparent;border:0;width:100%;box-sizing:border-box;flex-wrap:nowrap;overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch}
.rmt-toolbar.${TOOLBAR_IN_HEADER_CLASS}{padding:0 0;gap:18px;overflow:visible}
.${ACTIONS_LEFT_CLASS}{display:flex;align-items:center;gap:12px;margin-right:auto;min-width:0}
.rmt-toolbar.${TOOLBAR_IN_ACTIONS_CLASS}{padding:0;gap:18px;overflow:visible;width:auto;min-width:0}
.rmt-toolbar.${TOOLBAR_COLLAPSED_CLASS}{display:none !important}
.rmt-btn{appearance:none;-webkit-appearance:none;display:inline-flex !important;align-items:center;justify-content:center;min-width:32px;height:32px;padding:0 8px;background:transparent;border:0;border-radius:9999px;font-size:16px;font-weight:600;color:var(--color-neutral-content,rgba(255,255,255,.72));cursor:pointer;user-select:none;flex-shrink:0}
.rmt-btn svg{display:block}
.rmt-btn:hover{background:var(--color-neutral-background-hover,rgba(255,255,255,.08))}
.rmt-btn:active{transform:scale(.96)}
.rmt-separator{width:1px;height:18px;background:var(--color-neutral-border,rgba(255,255,255,.16));margin:0 2px;flex-shrink:0}
.rmt-toggle{position:static;width:44px;height:44px;border-radius:9999px;appearance:none;-webkit-appearance:none;border:0;background:var(--color-neutral-background,rgba(255,255,255,.10));color:var(--color-neutral-content,rgba(255,255,255,.72));font-weight:600;font-size:16px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;flex:0 0 auto}
.rmt-toggle[aria-pressed="true"]{background:var(--color-neutral-background,rgba(255,255,255,.14))}
.rmt-toggle:hover{background:var(--color-neutral-background-hover,rgba(255,255,255,.12))}
.rmt-toggle:active{transform:scale(.98)}
@media (prefers-color-scheme: light){
  .rmt-btn{color:var(--color-neutral-content-strong,rgba(0,0,0,.72))}
  .rmt-btn:hover{background:var(--color-neutral-background-hover,rgba(0,0,0,.06))}
  .rmt-separator{background:var(--color-neutral-border-weak,rgba(0,0,0,.12))}
  .rmt-toggle{background:var(--color-neutral-background-weak,rgba(0,0,0,.06));color:var(--color-neutral-content-strong,rgba(0,0,0,.72))}
  .rmt-toggle[aria-pressed="true"]{background:var(--color-neutral-background-hover,rgba(0,0,0,.10))}
  .rmt-toggle:hover{background:var(--color-neutral-background-hover,rgba(0,0,0,.10))}
}
`.trim();

  const LINK_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
  <path d="M10 13a5 5 0 0 1 0-7l1.5-1.5a5 5 0 0 1 7 7L17 13"/>
  <path d="M14 11a5 5 0 0 1 0 7L12.5 19.5a5 5 0 0 1-7-7L7 11"/>
</svg>
`.trim();

  /**
   * Built-in toolbar buttons.
   *
   * Each button's `action` signature:
   * - (textarea, showPrompt, settings, event) => void
   */
  const BUTTONS = [
    {
      id: 'bold',
      label: 'Bold',
      icon: 'B',
      title: 'Bold (Ctrl+B)',
      action: (ta) => MarkdownFormatter.bold(ta)
    },
    {
      id: 'italic',
      label: 'Italic',
      icon: 'I',
      title: 'Italic (Ctrl+I)',
      action: (ta) => MarkdownFormatter.italic(ta)
    },
    {
      id: 'strikethrough',
      label: 'Strikethrough',
      icon: 'S',
      title: 'Strikethrough (Ctrl+Shift+X)',
      action: (ta) => MarkdownFormatter.strikethrough(ta)
    },
    {
      id: 'separator-1',
      type: 'separator'
    },
    {
      id: 'code',
      label: 'Inline Code',
      icon: '</>',
      title: 'Inline code',
      action: (ta) => MarkdownFormatter.inlineCode(ta)
    },
    {
      id: 'codeblock',
      label: 'Code Block',
      icon: '{ }',
      title: 'Code block',
      action: (ta) => MarkdownFormatter.codeBlock(ta)
    },
    {
      id: 'separator-2',
      type: 'separator'
    },
    {
      id: 'link',
      label: 'Link',
      iconHtml: LINK_SVG,
      title: 'Insert link (Ctrl+K)',
      action: (ta, showPrompt) => MarkdownFormatter.link(ta, showPrompt)
    },
    {
      id: 'quote',
      label: 'Quote',
      icon: '"',
      title: 'Quote (Ctrl+Shift+Q)',
      action: (ta) => MarkdownFormatter.quote(ta)
    },
    {
      id: 'spoiler',
      label: 'Spoiler',
      icon: '!',
      title: 'Spoiler (Ctrl+Shift+S)',
      action: (ta) => MarkdownFormatter.spoiler(ta)
    },
    {
      id: 'separator-3',
      type: 'separator'
    },
    {
      id: 'bullet',
      label: 'Bullet List',
      icon: '•',
      title: 'Bullet list (Ctrl+Shift+8)',
      action: (ta) => MarkdownFormatter.bulletList(ta)
    },
    {
      id: 'numbered',
      label: 'Numbered List',
      icon: '1.',
      title: 'Numbered list (Ctrl+Shift+7)',
      action: (ta) => MarkdownFormatter.numberedList(ta)
    },
    {
      id: 'table',
      label: 'Table',
      icon: 'Tbl',
      title: 'Insert table',
      action: (ta) => MarkdownFormatter.table(ta)
    },
    {
      id: 'separator-4',
      type: 'separator'
    },
    {
      id: 'heading',
      label: 'Heading',
      icon: 'H',
      title: 'Heading (uses default level; Shift-click to pick level) (Ctrl+Shift+H)',
      action: (ta, showPrompt, settings, evt) => {
        const defaultLevel = Math.max(1, Math.min(6, (settings?.headingLevel | 0) || 3));
        if (evt && evt.shiftKey) {
          showPrompt('Heading level (1-6):', String(defaultLevel), (val) => {
            if (val === null) return;
            const n = Math.max(1, Math.min(6, parseInt(String(val), 10) || defaultLevel));
            MarkdownFormatter.heading(ta, n);
          });
          return;
        }
        MarkdownFormatter.heading(ta, defaultLevel);
      }
    },
    {
      id: 'hr',
      label: 'Horizontal Rule',
      icon: 'HR',
      title: 'Horizontal rule',
      action: (ta) => MarkdownFormatter.hr(ta)
    },
    {
      id: 'clear',
      label: 'Clear Formatting',
      icon: 'Tx',
      title: 'Clear formatting (selection)',
      action: (ta) => MarkdownFormatter.clear(ta)
    }
  ];

  function ensureShadowStyles(rootNode) {
    if (!rootNode || rootNode.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;
    // ShadowRoot is a DocumentFragment.
    const shadowRoot = rootNode;
    if (shadowRoot.querySelector(`style[${SHADOW_STYLE_ATTR}]`)) return;

    const style = document.createElement('style');
    style.setAttribute(SHADOW_STYLE_ATTR, 'true');
    style.textContent = SHADOW_CSS;
    shadowRoot.appendChild(style);
  }

  function findFirstElementByText(rootNode, textPredicate) {
    if (!rootNode) return null;
    const walker = document.createTreeWalker(rootNode, NodeFilter.SHOW_ELEMENT);
    let node = walker.nextNode();
    while (node) {
      const el = /** @type {Element} */ (node);
      const text = (el.textContent || '').trim();
      if (text && textPredicate(text, el)) return el;
      node = walker.nextNode();
    }
    return null;
  }

  function findHeaderMount(rootNode) {
    // Find the "Switch to ..." control and mount into its parent row, like RTE.
    const switchEl = findFirstElementByText(rootNode, (text, el) => {
      if (text.length > 64) return false;
      if (!/^Switch to\b/i.test(text)) return false;
      return el.tagName === 'A' || el.tagName === 'BUTTON' || el.getAttribute('role') === 'button';
    });
    if (!switchEl || !switchEl.parentElement) return null;
    return switchEl.parentElement;
  }

  function findActionsRow(rootNode) {
    // Find the *row* that actually lays out Cancel + submit side-by-side.
    // We start at the Cancel button and walk upward, selecting the smallest
    // ancestor that is a flex row and contains both buttons.
    const cancelEl = findFirstElementByText(rootNode, (text, el) => {
      if (text !== 'Cancel') return false;
      return el.tagName === 'BUTTON' || el.tagName === 'A' || el.getAttribute('role') === 'button';
    });
    if (!cancelEl) return null;

    let p = cancelEl.parentElement;
    for (let depth = 0; p && depth < 10; depth++) {
      const buttons = Array.from(p.querySelectorAll('button, a, [role="button"]'));
      let hasCancel = false;
      let hasSubmit = false;
      for (const b of buttons) {
        const t = (b.textContent || '').trim();
        if (t === 'Cancel') hasCancel = true;
        if (t === 'Comment' || t === 'Reply' || t === 'Post' || t === 'Submit') hasSubmit = true;
      }

      if (hasCancel && hasSubmit) {
        const cs = window.getComputedStyle(p);
        const isFlexRow =
          (cs.display === 'flex' || cs.display === 'inline-flex') &&
          (cs.flexDirection === 'row' || cs.flexDirection === 'row-reverse');
        if (isFlexRow) {
          return { rowEl: p, cancelEl };
        }
      }

      p = p.parentElement;
    }

    return null;
  }

  function hideMarkdownLabel(rootNode) {
    // Optional: hide "Markdown Editor" label so the header row looks like RTE.
    const labelEl = findFirstElementByText(rootNode, (text) => text === 'Markdown Editor');
    if (labelEl && labelEl instanceof HTMLElement) {
      labelEl.style.display = 'none';
    }
  }

  function ensureLeftGroupMount(rowEl, beforeEl) {
    if (!rowEl) return null;
    const existing = rowEl.querySelector(`.${ACTIONS_LEFT_CLASS}[data-rmt-left="true"]`);
    if (existing) return existing;

    const left = document.createElement('div');
    left.className = ACTIONS_LEFT_CLASS;
    left.setAttribute('data-rmt-left', 'true');
    // Force a stable horizontal layout even if Reddit applies odd defaults.
    left.style.display = 'flex';
    left.style.alignItems = 'center';
    left.style.gap = '12px';
    left.style.marginRight = 'auto';
    left.style.minWidth = '0';
    left.style.flexWrap = 'nowrap';

    if (beforeEl && beforeEl.parentElement === rowEl) {
      rowEl.insertBefore(left, beforeEl);
    } else {
      rowEl.insertBefore(left, rowEl.firstChild);
    }

    return left;
  }

  function ensureToggle(mountEl, toolbar) {
    if (!mountEl) return;
    // Avoid duplicates if Reddit re-renders around us.
    const existing = mountEl.querySelector(`button.${TOGGLE_CLASS}[data-rmt-toggle="true"]`);
    if (existing) return;

    const toggle = document.createElement('button');
    toggle.className = TOGGLE_CLASS;
    toggle.setAttribute('type', 'button');
    toggle.setAttribute('data-rmt-toggle', 'true');
    toggle.setAttribute('title', 'Toggle formatting toolbar');
    toggle.setAttribute('aria-label', 'Toggle formatting toolbar');

    // Match Reddit's "Aa" affordance.
    toggle.textContent = 'Aa';

    const updateA11y = () => {
      const collapsed = toolbar.classList.contains(TOOLBAR_COLLAPSED_CLASS);
      toggle.setAttribute('aria-pressed', collapsed ? 'false' : 'true');
    };

    toggle.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toolbar.classList.toggle(TOOLBAR_COLLAPSED_CLASS);
      updateA11y();

      const collapsed = toolbar.classList.contains(TOOLBAR_COLLAPSED_CLASS);
      // Persist state if requested. Guard for demo pages/tests where chrome is absent.
      try {
        if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
          chrome.storage.sync.get({ rememberCollapsed: true }, (res) => {
            if (res && res.rememberCollapsed) {
              chrome.storage.sync.set({ collapsed });
            }
          });
        }
      } catch (_) {
        // ignore
      }
    });

    updateA11y();
    mountEl.appendChild(toggle);
  }

  /**
   * Shows a simple prompt dialog
   */
  function showPrompt(message, defaultValue, callback) {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'rmt-modal-overlay';

    const modal = document.createElement('div');
    modal.className = 'rmt-modal';

    const label = document.createElement('label');
    label.textContent = message;
    label.className = 'rmt-modal-label';

    const input = document.createElement('input');
    input.type = 'text';
    input.value = defaultValue;
    input.className = 'rmt-modal-input';

    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'rmt-modal-buttons';

    const okButton = document.createElement('button');
    okButton.textContent = 'OK';
    okButton.className = 'rmt-modal-btn rmt-modal-btn-primary';

    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    cancelButton.className = 'rmt-modal-btn';

    buttonContainer.appendChild(cancelButton);
    buttonContainer.appendChild(okButton);

    modal.appendChild(label);
    modal.appendChild(input);
    modal.appendChild(buttonContainer);
    overlay.appendChild(modal);

    document.body.appendChild(overlay);
    input.focus();
    input.select();

    const cleanup = () => {
      document.body.removeChild(overlay);
    };

    okButton.addEventListener('click', () => {
      callback(input.value);
      cleanup();
    });

    cancelButton.addEventListener('click', () => {
      callback(null);
      cleanup();
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        callback(input.value);
        cleanup();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        callback(null);
        cleanup();
      }
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        callback(null);
        cleanup();
      }
    });
  }

  function buildSnippetButtons(settings) {
    const snippets = Array.isArray(settings.snippets) ? settings.snippets : [];
    const out = [];
    for (let i = 0; i < snippets.length; i++) {
      const sn = snippets[i] || {};
      if (!sn.enabled) continue;
      const label = String(sn.label || '').trim();
      const template = String(sn.template || '');
      if (!label || !template) continue;

      out.push({
        id: `snippet-${i}`,
        label,
        icon: label.length <= 3 ? label : label.slice(0, 3),
        title: `Snippet: ${label}`,
        action: (ta) => MarkdownFormatter.snippet(ta, template)
      });
    }
    return out;
  }

  /**
   * Creates and returns toolbar element
   */
  function createToolbar(textarea, settings = {}) {
    const toolbar = document.createElement('div');
    toolbar.className = TOOLBAR_CLASS;
    toolbar.setAttribute('data-rmt-toolbar', 'true');

    if (settings.compact) {
      toolbar.classList.add('rmt-compact');
    }

    // Apply persisted collapsed state (if enabled).
    if (settings.rememberCollapsed && settings.collapsed) {
      toolbar.classList.add(TOOLBAR_COLLAPSED_CLASS);
    }

    const snippetButtons = buildSnippetButtons(settings);
    const allButtons = snippetButtons.length
      ? BUTTONS.concat([{ id: 'separator-snippets', type: 'separator' }], snippetButtons)
      : BUTTONS;

    allButtons.forEach(btn => {
      if (btn.type === 'separator') {
        const sep = document.createElement('div');
        sep.className = 'rmt-separator';
        toolbar.appendChild(sep);
        return;
      }

      // Check if button is disabled in settings
      if (settings.disabledButtons && settings.disabledButtons.includes(btn.id)) {
        return;
      }

      const button = document.createElement('button');
      button.className = TOOLBAR_BUTTON_CLASS;
      button.setAttribute('type', 'button');
      button.setAttribute('title', btn.title);
      button.setAttribute('aria-label', btn.title);
      button.setAttribute('data-rmt-action', btn.id);
      if (btn.iconHtml) {
        button.innerHTML = btn.iconHtml;
      } else {
        button.textContent = btn.icon;
      }

      button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        // action(ta, showPrompt, settings, event)
        btn.action(textarea, showPrompt, settings, e);
      });

      toolbar.appendChild(button);
    });

    return toolbar;
  }

  /**
   * Injects toolbar above textarea
   */
  function inject(textarea, settings) {
    // For shadow DOM textarea, we need to inject into the shadow DOM
    // Find the shreddit-markdown-composer
    let container = textarea.getRootNode();

    if (container.host && container.host.tagName === 'SHREDDIT-MARKDOWN-COMPOSER') {
      // We're in the markdown composer's shadow DOM
      ensureShadowStyles(container);
      const toolbar = createToolbar(textarea, settings);

      // Primary mount: bottom action row aligned with Cancel/Comment (matches RTE layout).
      const actions = findActionsRow(container);
      if (actions) {
        const left = ensureLeftGroupMount(actions.rowEl, actions.cancelEl) || actions.rowEl;
        toolbar.classList.add(TOOLBAR_IN_ACTIONS_CLASS);
        left.appendChild(toolbar);
        ensureToggle(left, toolbar);
      } else {
        // Secondary mount: header row near "Switch to ...".
        const headerMount = findHeaderMount(container);
        if (headerMount) {
          toolbar.classList.add(TOOLBAR_IN_HEADER_CLASS);
          headerMount.insertBefore(toolbar, headerMount.firstChild);
          hideMarkdownLabel(container);
        } else {
          // Fallback: sibling immediately before textarea.
          const textareaParent = textarea.parentElement;
          if (textareaParent) {
            textareaParent.insertBefore(toolbar, textarea);
          } else {
            container.insertBefore(toolbar, container.firstChild);
          }
        }

        // In fallbacks, place toggle next to the toolbar so it doesn't cover placeholder text.
        const toggleMount = toolbar.parentElement || container;
        ensureToggle(toggleMount, toolbar);
      }

      return toolbar;
    }

    // Fallback for regular DOM
    const textareaParent = textarea.parentElement;
    const toolbar = createToolbar(textarea, settings);
    if (textareaParent) {
      textareaParent.insertBefore(toolbar, textarea);
      const toggleMount = toolbar.parentElement || textareaParent;
      ensureToggle(toggleMount, toolbar);
    }

    return toolbar;
  }

  /**
   * Keyboard shortcuts
   *
   * We bind a single keydown handler per textarea. To keep behavior consistent
   * across runtime settings changes, callers may pass either:
   * - an object of settings
   * - a function that returns the latest settings object
   */
  function attachKeyboardShortcuts(textarea, settingsOrGetter = {}) {
    const getSettings = (typeof settingsOrGetter === 'function')
      ? settingsOrGetter
      : () => settingsOrGetter;

    textarea.addEventListener('keydown', (e) => {
      const settings = getSettings() || {};
      const isMod = (e.ctrlKey || e.metaKey);
      if (!isMod) return;

      const disabled = settings.disabledButtons || [];
      const isDisabled = (id) => Array.isArray(disabled) && disabled.includes(id);

      // Ctrl/Cmd + B for bold
      if (!e.shiftKey && !e.altKey && e.key === 'b' && !isDisabled('bold')) {
        e.preventDefault();
        MarkdownFormatter.bold(textarea);
      }
      // Ctrl/Cmd + I for italic
      else if (!e.shiftKey && !e.altKey && e.key === 'i' && !isDisabled('italic')) {
        e.preventDefault();
        MarkdownFormatter.italic(textarea);
      }
      // Ctrl/Cmd + K for link
      else if (!e.shiftKey && !e.altKey && e.key === 'k' && !isDisabled('link')) {
        e.preventDefault();
        MarkdownFormatter.link(textarea, showPrompt);
      }
      // Ctrl/Cmd + Shift + 8 for bullets
      else if (e.shiftKey && !e.altKey && e.key === '8' && !isDisabled('bullet')) {
        e.preventDefault();
        MarkdownFormatter.bulletList(textarea);
      }
      // Ctrl/Cmd + Shift + 7 for numbered list
      else if (e.shiftKey && !e.altKey && e.key === '7' && !isDisabled('numbered')) {
        e.preventDefault();
        MarkdownFormatter.numberedList(textarea);
      }
      // Ctrl/Cmd + Shift + Q for quote
      else if (e.shiftKey && !e.altKey && e.key.toLowerCase() === 'q' && !isDisabled('quote')) {
        e.preventDefault();
        MarkdownFormatter.quote(textarea);
      }
      // Ctrl/Cmd + Shift + X for strikethrough
      else if (e.shiftKey && !e.altKey && e.key.toLowerCase() === 'x' && !isDisabled('strikethrough')) {
        e.preventDefault();
        MarkdownFormatter.strikethrough(textarea);
      }
      // Ctrl/Cmd + Shift + S for spoiler
      else if (e.shiftKey && !e.altKey && e.key.toLowerCase() === 's' && !isDisabled('spoiler')) {
        e.preventDefault();
        MarkdownFormatter.spoiler(textarea);
      }
      // Ctrl/Cmd + Shift + H for heading (default level)
      else if (e.shiftKey && !e.altKey && e.key.toLowerCase() === 'h' && !isDisabled('heading')) {
        e.preventDefault();
        const defaultLevel = Math.max(1, Math.min(6, (settings.headingLevel | 0) || 3));
        MarkdownFormatter.heading(textarea, defaultLevel);
      }
    });
  }

  return {
    inject,
    attachKeyboardShortcuts
  };
})();
