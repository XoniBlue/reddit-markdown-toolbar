/**
 * MarkdownFormatter
 *
 * "Pure-ish" markdown transformations for textareas:
 * - Wrap selection with markers (bold/italic/code/spoiler)
 * - Prefix lines (quote/lists/heading)
 * - Insert templates (table/hr/code block/snippets)
 *
 * Important behavior:
 * - After every modification we dispatch a bubbling `input` event so React-
 *   controlled editors notice the change.
 */
const MarkdownFormatter = globalThis.MarkdownFormatter = (() => {
  'use strict';

  /**
   * Dispatch a bubbling input event so React-controlled inputs update.
   */
  function triggerInput(textarea) {
    const event = new Event('input', { bubbles: true });
    textarea.dispatchEvent(event);
  }

  /**
   * Replace the current selection range with `replacement`.
   *
   * If `selectReplacement` is true, the inserted text remains selected.
   * This makes it easier to immediately type over placeholders.
   */
  function replaceSelection(textarea, replacement, selectReplacement = true) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const beforeText = textarea.value.substring(0, start);
    const afterText = textarea.value.substring(end);
    textarea.value = beforeText + replacement + afterText;
    if (selectReplacement) {
      textarea.setSelectionRange(start, start + replacement.length);
    } else {
      textarea.setSelectionRange(start + replacement.length, start + replacement.length);
    }
    textarea.focus();
    triggerInput(textarea);
  }

  /**
   * Wraps selected text with prefix and suffix
   * If no selection, inserts template and positions cursor
   */
  function wrapText(textarea, prefix, suffix, placeholder = 'text') {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);
    const beforeText = textarea.value.substring(0, start);
    const afterText = textarea.value.substring(end);

    let newText, newCursorPos, newCursorEnd;

    if (selectedText) {
      // Check if already wrapped (simple toggle)
      const alreadyWrapped =
        beforeText.endsWith(prefix) &&
        afterText.startsWith(suffix);

      if (alreadyWrapped && prefix === suffix) {
        // Remove wrapping
        const unwrapped = beforeText.slice(0, -prefix.length) +
                         selectedText +
                         afterText.slice(suffix.length);
        textarea.value = unwrapped;
        newCursorPos = start - prefix.length;
        newCursorEnd = end - prefix.length;
      } else {
        // Wrap selection
        newText = beforeText + prefix + selectedText + suffix + afterText;
        textarea.value = newText;
        newCursorPos = start + prefix.length;
        newCursorEnd = end + prefix.length;
      }
    } else {
      // No selection: insert template
      newText = beforeText + prefix + placeholder + suffix + afterText;
      textarea.value = newText;
      newCursorPos = start + prefix.length;
      newCursorEnd = newCursorPos + placeholder.length;
    }

    textarea.setSelectionRange(newCursorPos, newCursorEnd);
    textarea.focus();

    triggerInput(textarea);
  }

  /**
   * Applies prefix to each line in selection
   */
  function prefixLines(textarea, prefix, toggleable = true) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const fullText = textarea.value;

    // Find line boundaries
    const beforeCursor = fullText.substring(0, start);
    const selection = fullText.substring(start, end);
    const afterCursor = fullText.substring(end);

    const lineStart = beforeCursor.lastIndexOf('\n') + 1;
    const lineEndPos = end + afterCursor.indexOf('\n');
    const lineEnd = lineEndPos === end - 1 ? fullText.length : lineEndPos;

    const fullSelection = fullText.substring(lineStart, lineEnd);
    const lines = fullSelection.split('\n');

    // Check if all lines already have prefix
    const allPrefixed = toggleable && lines.every(line =>
      line.trim().startsWith(prefix.trim())
    );

    let newLines;
    if (allPrefixed) {
      // Remove prefix
      newLines = lines.map(line => {
        const trimmed = line.trimStart();
        if (trimmed.startsWith(prefix.trim())) {
          const spaces = line.length - trimmed.length;
          return ' '.repeat(spaces) + trimmed.substring(prefix.trim().length);
        }
        return line;
      });
    } else {
      // Add prefix
      newLines = lines.map(line => {
        if (line.trim() === '') return line;
        return prefix + line;
      });
    }

    const newSelection = newLines.join('\n');
    const newText = fullText.substring(0, lineStart) + newSelection + fullText.substring(lineEnd);

    textarea.value = newText;
    textarea.setSelectionRange(lineStart, lineStart + newSelection.length);
    textarea.focus();

    triggerInput(textarea);
  }

  /**
   * Inserts numbered list
   */
  function insertNumberedList(textarea) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const fullText = textarea.value;

    const beforeCursor = fullText.substring(0, start);
    const selection = fullText.substring(start, end);
    const afterCursor = fullText.substring(end);

    if (!selection) {
      // No selection: insert template
      const newText = beforeCursor + '1. item' + afterCursor;
      textarea.value = newText;
      textarea.setSelectionRange(start + 3, start + 7);
      textarea.focus();

      triggerInput(textarea);
      return;
    }

    // Multi-line numbered list
    const lineStart = beforeCursor.lastIndexOf('\n') + 1;
    const lineEndPos = end + afterCursor.indexOf('\n');
    const lineEnd = lineEndPos === end - 1 ? fullText.length : lineEndPos;

    const fullSelection = fullText.substring(lineStart, lineEnd);
    const lines = fullSelection.split('\n');

    // Check if already numbered
    const alreadyNumbered = lines.every(line => /^\d+\.\s/.test(line.trim()));

    let newLines;
    if (alreadyNumbered) {
      // Remove numbering
      newLines = lines.map(line => line.replace(/^\s*\d+\.\s/, ''));
    } else {
      // Add numbering
      let counter = 1;
      newLines = lines.map(line => {
        if (line.trim() === '') return line;
        return `${counter++}. ${line}`;
      });
    }

    const newSelection = newLines.join('\n');
    const newText = fullText.substring(0, lineStart) + newSelection + fullText.substring(lineEnd);

    textarea.value = newText;
    textarea.setSelectionRange(lineStart, lineStart + newSelection.length);
    textarea.focus();

    triggerInput(textarea);
  }

  /**
   * Inserts link with modal prompt
   */
  function insertLink(textarea, onPrompt) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);

    // Check if selection looks like a URL
    const urlRegex = /^https?:\/\/.+/i;
    const isUrl = urlRegex.test(selectedText.trim());

    if (isUrl) {
      // Selection is URL: use it as href, prompt for text
      onPrompt('Link text:', 'link text', (text) => {
        if (text !== null) {
          const markdown = `[${text}](${selectedText.trim()})`;
          const beforeText = textarea.value.substring(0, start);
          const afterText = textarea.value.substring(end);
          textarea.value = beforeText + markdown + afterText;
          textarea.setSelectionRange(start, start + markdown.length);
          textarea.focus();

          triggerInput(textarea);
        }
      });
    } else {
      // Prompt for URL
      const linkText = selectedText || 'link text';
      onPrompt('Enter URL:', 'https://', (url) => {
        if (url !== null && url.trim()) {
          const markdown = `[${linkText}](${url.trim()})`;
          const beforeText = textarea.value.substring(0, start);
          const afterText = textarea.value.substring(end);
          textarea.value = beforeText + markdown + afterText;

          if (!selectedText) {
            // Select the placeholder text
            textarea.setSelectionRange(start + 1, start + 1 + linkText.length);
          } else {
            textarea.setSelectionRange(start, start + markdown.length);
          }
          textarea.focus();

          triggerInput(textarea);
        }
      });
    }
  }

  function insertHorizontalRule(textarea) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const fullText = textarea.value;
    const before = fullText.substring(0, start);
    const after = fullText.substring(end);

    // Ensure HR is surrounded by blank lines (Markdown friendliness).
    let insertion = '---';
    if (!before.endsWith('\n\n') && before.length > 0) {
      insertion = (before.endsWith('\n') ? '\n' : '\n\n') + insertion;
    }
    if (!after.startsWith('\n\n') && after.length > 0) {
      insertion = insertion + (after.startsWith('\n') ? '\n' : '\n\n');
    } else if (after.length === 0) {
      insertion = insertion + '\n';
    }

    replaceSelection(textarea, insertion, false);
  }

  function insertTable(textarea, cols = 2, rows = 2) {
    cols = Math.max(2, Math.min(6, cols | 0));
    rows = Math.max(2, Math.min(10, rows | 0));

    const headers = Array.from({ length: cols }, (_, i) => `Header ${i + 1}`);
    const aligns = Array.from({ length: cols }, () => '---');
    const body = Array.from({ length: rows }, (_, r) =>
      Array.from({ length: cols }, (_, c) => `Cell ${r + 1}.${c + 1}`)
    );

    const lines = [];
    lines.push(`| ${headers.join(' | ')} |`);
    lines.push(`| ${aligns.join(' | ')} |`);
    for (const row of body) lines.push(`| ${row.join(' | ')} |`);

    replaceSelection(textarea, lines.join('\n'), true);
  }

  function clearFormatting(textarea) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const fullText = textarea.value;
    const selected = fullText.substring(start, end);

    if (!selected) return;

    let out = selected;

    // Code fences first (so inline patterns don't eat them).
    out = out.replace(/```[^\n]*\n([\s\S]*?)\n```/g, '$1');
    out = out.replace(/`([^`]+)`/g, '$1');
    out = out.replace(/\*\*([^*]+)\*\*/g, '$1');
    out = out.replace(/\*([^*\n]+)\*/g, '$1');
    out = out.replace(/~~([^~]+)~~/g, '$1');
    out = out.replace(/>!([\s\S]*?)!</g, '$1'); // matches >!spoiler!<
    out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1');

    // Line-based prefixes.
    out = out.replace(/^(\s*)#{1,6}\s+/gm, '$1');
    out = out.replace(/^(\s*)>\s+/gm, '$1');
    out = out.replace(/^(\s*)-\s+/gm, '$1');
    out = out.replace(/^(\s*)\d+\.\s+/gm, '$1');

    replaceSelection(textarea, out, true);
  }

  function insertSnippet(textarea, template) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.substring(start, end);

    let out = String(template || '');
    if (!out) return;

    out = out.split('{selection}').join(selected || '');
    replaceSelection(textarea, out, true);
  }

  /**
   * Inserts heading
   */
  function insertHeading(textarea, level = 3) {
    const prefix = '#'.repeat(level) + ' ';
    prefixLines(textarea, prefix, false);
  }

  return {
    bold: (ta) => wrapText(ta, '**', '**', 'bold text'),
    italic: (ta) => wrapText(ta, '*', '*', 'italic text'),
    strikethrough: (ta) => wrapText(ta, '~~', '~~', 'strikethrough'),
    inlineCode: (ta) => wrapText(ta, '`', '`', 'code'),
    codeBlock: (ta) => wrapText(ta, '```\n', '\n```', 'code block'),
    quote: (ta) => prefixLines(ta, '> '),
    bulletList: (ta) => prefixLines(ta, '- '),
    numberedList: (ta) => insertNumberedList(ta),
    link: (ta, promptCallback) => insertLink(ta, promptCallback),
    heading: (ta, level) => insertHeading(ta, level),
    spoiler: (ta) => wrapText(ta, '>!', '!<', 'spoiler'),
    hr: (ta) => insertHorizontalRule(ta),
    table: (ta) => insertTable(ta),
    clear: (ta) => clearFormatting(ta),
    snippet: (ta, template) => insertSnippet(ta, template)
  };
})();
