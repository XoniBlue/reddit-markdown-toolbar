/**
 * TextareaDetector
 *
 * Reddit uses multiple editor implementations over time. In modern Reddit,
 * Markdown mode lives inside nested shadow DOM (e.g. `shreddit-composer` and
 * `shreddit-markdown-composer`). Extension CSS cannot pierce shadow DOM, so the
 * toolbar module injects shadow-root styles when needed.
 *
 * This module focuses on:
 * - Finding textarea nodes that correspond to the Markdown editor.
 * - Avoiding utility textareas (e.g. reCAPTCHA).
 * - Ensuring we only inject once per textarea/composer instance.
 */
const TextareaDetector = globalThis.TextareaDetector = (() => {
  'use strict';

  // WeakMap to track processed textareas
  const processedTextareas = new WeakMap();
  const processedComposers = new WeakSet();

  // Debug logging is controlled from the main content script by toggling this.
  let debug = false;
  function setDebugEnabled(v) {
    debug = !!v;
  }
  const log = (...args) => {
    if (debug) console.log(...args);
  };

  /**
   * Waits for element's shadow DOM to be ready
   */
  async function waitForShadowRoot(element, maxAttempts = 10) {
    for (let i = 0; i < maxAttempts; i++) {
      if (element.shadowRoot) {
        return element.shadowRoot;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return null;
  }

  /**
   * Recursively finds textarea in nested shadow DOMs
   */
  async function findTextareaInShadowDOM(element) {
    const shadowRoot = await waitForShadowRoot(element);
    if (!shadowRoot) {
      log('RMT: no shadow root found after waiting');
      return null;
    }

    // Try to find textarea directly
    let textarea = shadowRoot.querySelector('textarea');
    if (textarea) {
      log('RMT: found textarea in shadow DOM');
      return textarea;
    }

    // Check for shreddit-markdown-composer (nested shadow DOM)
    const markdownComposer = shadowRoot.querySelector('shreddit-markdown-composer');
    if (markdownComposer) {
      log('RMT: found nested shreddit-markdown-composer');

      const nestedShadowRoot = await waitForShadowRoot(markdownComposer);
      if (nestedShadowRoot) {
        textarea = nestedShadowRoot.querySelector('textarea');
        if (textarea) {
          log('RMT: found textarea in nested shadow DOM');
          return textarea;
        }
      }
    }

    return null;
  }

  /**
   * Checks if element is a markdown textarea (not rich text editor)
   */
  function isMarkdownTextarea(element, fromShadowDOM = false) {
    if (element.tagName !== 'TEXTAREA') return false;

    // Skip if already processed
    if (processedTextareas.has(element)) return false;

    // Skip reCAPTCHA and other utility textareas
    const name = element.name || '';
    const id = element.id || '';
    if (name.includes('recaptcha') ||
        name.includes('g-recaptcha') ||
        id.includes('recaptcha')) {
      log('RMT: skipping reCAPTCHA textarea');
      return false;
    }

    // For shadow DOM textareas, skip visibility check
    // (they can have dimensions of 0 initially but will expand)
    if (fromShadowDOM) {
      log('RMT: valid markdown textarea (shadow DOM)');
      return true;
    }

    // For regular DOM textareas, check visibility
    if (element.offsetParent === null ||
        element.style.display === 'none' ||
        element.style.visibility === 'hidden') {
      log('RMT: skipping hidden textarea');
      return false;
    }

    log('RMT: valid markdown textarea');
    return true;
  }

  /**
   * Finds all markdown textareas on page, including nested shadow DOM
   */
  async function findMarkdownTextareas() {
    const markdown = [];

    // First, check regular DOM textareas
    const textareas = document.querySelectorAll('textarea');
    textareas.forEach(ta => {
      if (isMarkdownTextarea(ta, false)) {
        markdown.push(ta);
      }
    });

    // Second, check shreddit-composer elements (nested shadow DOM).
    // We only target those in `mode="markdown"`, to avoid RTE.
    const composers = document.querySelectorAll('shreddit-composer[mode="markdown"]');
    log('RMT: shreddit-composer[mode=\"markdown\"] found', composers.length);

    for (const composer of composers) {
      // Skip if already processed
      if (processedComposers.has(composer)) {
        log('RMT: composer already processed');
        continue;
      }

      const textarea = await findTextareaInShadowDOM(composer);
      if (textarea && isMarkdownTextarea(textarea, true)) { // Pass true for shadow DOM
        markdown.push(textarea);
        processedComposers.add(composer);
      }
    }

    return markdown;
  }

  /**
   * Marks textarea as processed
   */
  function markAsProcessed(textarea, toolbar) {
    processedTextareas.set(textarea, toolbar);
  }

  /**
   * Checks if textarea is processed
   */
  function isProcessed(textarea) {
    return processedTextareas.has(textarea);
  }

  return {
    findMarkdownTextareas,
    isMarkdownTextarea,
    markAsProcessed,
    isProcessed,
    setDebugEnabled
  };
})();
