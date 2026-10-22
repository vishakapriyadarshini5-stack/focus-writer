(() => {
  const editor = document.getElementById('editor');
  const page = document.querySelector('.page');
  const toolbar = document.querySelector('.toolbar');
  const ZWSP = '\u200B';
  let hideTimer = null;
  let nearTop = false;

  /* ---------- Auto-hiding toolbar ---------- */
  // Shows when the mouse is near the top of the page, or when text is selected.
  // Hides about 1 second after you stop moving the mouse or start typing.
  function showBar() {
    clearTimeout(hideTimer);
    page.classList.remove('bar-hidden');
  }

  function hasSelection() {
    const s = window.getSelection();
    return !!s && !s.isCollapsed && editor.contains(s.anchorNode);
  }

  function scheduleHide() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (nearTop || hasSelection() || toolbar.matches(':hover') || toolbar.contains(document.activeElement)) return;
      page.classList.add('bar-hidden');
    }, 1000);
  }

  document.addEventListener('mousemove', (e) => {
    const r = page.getBoundingClientRect();
    nearTop = e.clientX >= r.left && e.clientX <= r.right && e.clientY - r.top < 150;
    if (nearTop) showBar();
    else scheduleHide();
  });

  document.addEventListener('selectionchange', () => {
    if (hasSelection()) showBar();
    else scheduleHide();
  });

  editor.addEventListener('input', scheduleHide);
  toolbar.addEventListener('focusin', showBar);
  toolbar.addEventListener('focusout', scheduleHide);
  scheduleHide();

  /* ---------- Find the line the caret is on ---------- */
  function lineBeforeCaret() {
    const sel = window.getSelection();
    if (!sel.rangeCount || !sel.isCollapsed) return null;
    const { startContainer, startOffset } = sel.getRangeAt(0);
    if (!editor.contains(startContainer) || startContainer === editor) return null;

    let el = startContainer;
    while (el.parentNode && el.parentNode !== editor) el = el.parentNode;
    if (el.parentNode !== editor || el.nodeName === 'TABLE' || el.nodeName === 'HR') return null;

    const pre = document.createRange();
    pre.setStart(el, 0);
    pre.setEnd(startContainer, startOffset);
    return { pre, text: pre.toString() };
  }

  /* ---------- Line shortcuts: type the marker, then Space ---------- */
  // "- " or "+ " or "* "  -> bullet list
  // "1. "                 -> numbered list
  // "# " / "## " / "### " -> headings
  editor.addEventListener('keydown', (e) => {
    if (e.key !== ' ' || e.ctrlKey || e.altKey || e.metaKey) return;
    const line = lineBeforeCaret();
    if (!line) return;

    const t = line.text;
    let action = null;
    if (/^[-+*]$/.test(t)) action = 'ul';
    else if (/^\d{1,2}\.$/.test(t)) action = 'ol';
    else if (/^#{1,3}$/.test(t)) action = t.length === 1 ? 'h2' : t.length === 2 ? 'h3' : 'h4';
    if (!action) return;

    e.preventDefault();
    line.pre.deleteContents();
    if (action === 'ul') document.execCommand('insertUnorderedList');
    else if (action === 'ol') document.execCommand('insertOrderedList');
    else document.execCommand('formatBlock', false, action);
  });

  /* ---------- Inline shortcuts: close the pair, and the text converts ---------- */
  // **bold**   *italic*   ~~strike~~   ==highlight==
  const INLINE = [
    { re: /\*\*([^*\n]+)\*\*$/, tag: 'b' },
    { re: /(?<!\*)\*([^*\n]+)\*$/, tag: 'i' },
    { re: /~~([^~\n]+)~~$/, tag: 's' },
    { re: /==([^=\n]+)==$/, tag: 'mark' },
  ];

  editor.addEventListener('input', (e) => {
    if (e.inputType !== 'insertText' || !['*', '~', '='].includes(e.data)) return;
    const sel = window.getSelection();
    if (!sel.rangeCount || !sel.isCollapsed) return;
    const node = sel.anchorNode;
    if (!node || node.nodeType !== 3 || !editor.contains(node)) return;

    const offset = sel.anchorOffset;
    const before = node.textContent.slice(0, offset);

    for (const { re, tag } of INLINE) {
      const m = before.match(re);
      if (!m) continue;

      const range = document.createRange();
      range.setStart(node, offset - m[0].length);
      range.setEnd(node, offset);
      range.deleteContents();

      const el = document.createElement(tag);
      el.textContent = m[1];
      range.insertNode(el);

      // Put the caret after the formatted text so typing continues normally
      const after = document.createTextNode(ZWSP);
      el.after(after);
      const c = document.createRange();
      c.setStart(after, 1);
      c.collapse(true);
      sel.removeAllRanges();
      sel.addRange(c);
      break;
    }
  });
})();