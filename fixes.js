(() => {
  const editor = document.getElementById('editor');

  // Find the closest matching ancestor of a node, stopping at the boundary
  function closestIn(node, selector, boundary) {
    if (!node) return null;
    let el = node.nodeType === 1 ? node : node.parentElement;
    while (el && el !== boundary) {
      if (el.matches(selector)) return el;
      el = el.parentElement;
    }
    return null;
  }

  function place(el) {
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(true);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  const isBlank = (el) => el.textContent.replace(/\u200B/g, '').trim() === '';

  editor.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.shiftKey) return;
    const sel = window.getSelection();
    if (!sel.rangeCount || !sel.isCollapsed) return;
    const node = sel.anchorNode;
    if (!node || !editor.contains(node)) return;

    /* 1) Empty bullet or numbered item: Enter leaves the list */
    const li = closestIn(node, 'li', editor);
    if (li && isBlank(li)) {
      e.preventDefault();
      const cmd = li.parentElement.tagName === 'OL' ? 'insertOrderedList' : 'insertUnorderedList';
      document.execCommand(cmd); // toggles the list off for this line
      return;
    }

    /* 2) Block quote: Enter adds a new line inside the quote.
          Enter on an empty last line leaves the quote. */
    const bq = closestIn(node, 'blockquote', editor);
    if (!bq) return;
    e.preventDefault();

    // Wrap loose text in a paragraph so each line can be handled on its own
    if (!bq.querySelector(':scope > p')) {
      const p = document.createElement('p');
      p.append(...bq.childNodes);
      bq.append(p);
    }

    const caretNode = window.getSelection().anchorNode;
    const cur = closestIn(caretNode, 'p', bq) || bq.lastElementChild;

    if (isBlank(cur) && cur === bq.lastElementChild) {
      cur.remove();
      const out = document.createElement('p');
      out.innerHTML = '<br>';
      bq.after(out);
      if (isBlank(bq) && !bq.querySelector('img, hr, table')) bq.remove();
      place(out);
    } else {
      const np = document.createElement('p');
      np.innerHTML = '<br>';
      cur.after(np);
      place(np);
    }

    // Tell the app this text changed so it saves
    editor.dispatchEvent(new Event('input', { bubbles: true }));
  });
})();