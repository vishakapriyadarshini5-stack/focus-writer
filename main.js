const STORE_KEY = 'focusWriter.docs';
const $ = (id) => document.getElementById(id);
const app = $('app'), editor = $('editor'), title = $('title');
const list = $('docList'), themeSel = $('theme');
const fontSel = $('fontFamily'), sizeInput = $('fontSize');
const menu = $('contextMenu');

let docs = {};
try { docs = JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); } catch (e) { docs = {}; }

let currentId = null;
let saveTimer = null;
let baseline = 0;
let lastCell = null;

/* ---------- Session timer (starts on open, display only) ---------- */
let elapsed = 0;
const pad = (n) => String(n).padStart(2, '0');

function renderTimer() {
  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  $('sessionTime').textContent = h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

setInterval(() => { elapsed++; renderTimer(); }, 1000);
renderTimer();

/* ---------- Helpers ---------- */
const countWords = (s) => (s.trim().match(/\S+/g) || []).length;

function updateStats() {
  const total = countWords(editor.innerText);
  $('wordCount').textContent = `${total} words`;
  $('goalText').textContent = `${Math.max(0, total - baseline)} written this session`;
}

// Older plain-text notes are converted to HTML so they still display
function toHTML(body) {
  if (!body) return '';
  if (/<[a-z][\s\S]*>/i.test(body)) return body;
  return body.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
}

function persist() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(docs)); }
  catch (e) { console.error('Could not save:', e); }
}

function sortedIds() {
  return Object.keys(docs).sort((a, b) => docs[b].updated - docs[a].updated);
}

/* ---------- Saving ---------- */
function saveNow() {
  clearTimeout(saveTimer);
  if (!currentId || !docs[currentId]) return;
  docs[currentId] = {
    title: title.value || 'Untitled',
    body: editor.innerHTML,
    updated: Date.now(),
  };
  persist();
}

function queueSave() {
  updateStats();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 800);
}

/* ---------- Note list ---------- */
function refreshList() {
  list.innerHTML = '';
  for (const id of sortedIds()) {
    const li = document.createElement('li');
    const name = document.createElement('span');
    name.className = 'doc-name';
    name.textContent = docs[id].title || 'Untitled';

    const del = document.createElement('button');
    del.className = 'doc-del';
    del.textContent = '×';
    del.title = 'Delete note';
    del.onclick = (e) => { e.stopPropagation(); deleteDoc(id); };

    li.append(name, del);
    if (id === currentId) li.classList.add('active');
    li.onclick = () => openDoc(id);
    list.appendChild(li);
  }
}

function openDoc(id) {
  if (!docs[id]) return;
  saveNow();
  currentId = id;
  const d = docs[id];
  title.value = d.title;
  editor.innerHTML = toHTML(d.body);
  baseline = countWords(editor.innerText);
  updateStats();
  refreshList();
}

function newDoc() {
  saveNow();
  const id = Date.now().toString();
  docs[id] = { title: 'Untitled', body: '', updated: Date.now() };
  persist();
  openDoc(id);
  title.select();
}

function deleteDoc(id = currentId) {
  if (!docs[id] || !confirm('Delete this note?')) return;
  clearTimeout(saveTimer);
  delete docs[id];
  persist();

  if (id === currentId) {
    currentId = null;
    const next = sortedIds()[0];
    if (next) openDoc(next);
    else newDoc();
  } else {
    refreshList();
  }
}

/* ---------- Selection helpers ---------- */
function placeCursor(el) {
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(true);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

function cellFromSelection() {
  const sel = window.getSelection();
  if (!sel.rangeCount) return null;
  const n = sel.anchorNode;
  const el = n.nodeType === 1 ? n : n.parentElement;
  const cell = el ? el.closest('td') : null;
  return cell && editor.contains(cell) ? cell : null;
}

/* ---------- Tables ---------- */
function emptyCell() {
  const td = document.createElement('td');
  td.innerHTML = '<br>';
  return td;
}

function insertTable(rows = 3, cols = 3) {
  let html = '<table class="rt"><tbody>';
  for (let r = 0; r < rows; r++) html += '<tr>' + '<td><br></td>'.repeat(cols) + '</tr>';
  html += '</tbody></table><p><br></p>';
  editor.focus();
  document.execCommand('insertHTML', false, html);
  queueSave();
}

function tableOp(op) {
  const cell = lastCell || cellFromSelection();
  lastCell = null;
  if (!cell || !editor.contains(cell)) return;

  const tr = cell.parentElement;
  const table = cell.closest('table');
  const col = cell.cellIndex;

  if (op === 'rowAbove' || op === 'rowBelow') {
    const row = document.createElement('tr');
    for (let i = 0; i < tr.cells.length; i++) row.appendChild(emptyCell());
    if (op === 'rowAbove') tr.before(row);
    else tr.after(row);
  } else if (op === 'colRight') {
    for (const row of table.rows) {
      const ref = row.cells[col];
      if (ref) ref.after(emptyCell());
    }
  } else if (op === 'deleteRow') {
    if (table.rows.length > 1) tr.remove();
    else table.remove();
  } else if (op === 'deleteCol') {
    if (tr.cells.length > 1) {
      for (const row of table.rows) if (row.cells[col]) row.cells[col].remove();
    } else {
      table.remove();
    }
  } else if (op === 'deleteTable') {
    table.remove();
  }
  queueSave();
}

// Tab moves to the next cell; Tab in the last cell adds a row
function handleTab(e) {
  const cell = cellFromSelection();
  if (!cell) {
    e.preventDefault();
    if (!e.shiftKey) document.execCommand('insertText', false, '\u00a0\u00a0\u00a0\u00a0');
    return;
  }
  e.preventDefault();
  const table = cell.closest('table');
  const cells = [...table.querySelectorAll('td')];
  const i = cells.indexOf(cell);
  let target;
  if (e.shiftKey) {
    target = cells[i - 1];
  } else if (i < cells.length - 1) {
    target = cells[i + 1];
  } else {
    const row = document.createElement('tr');
    for (let k = 0; k < cell.parentElement.cells.length; k++) row.appendChild(emptyCell());
    table.tBodies[0].appendChild(row);
    target = row.cells[0];
  }
  if (target) placeCursor(target);
  queueSave();
}

/* ---------- Horizontal line: type --- then press Enter ---------- */
function handleEnter(e) {
  const sel = window.getSelection();
  if (!sel.rangeCount || !sel.isCollapsed) return;
  const node = sel.anchorNode;
  if (node.nodeType !== 3) return;
  if (node.textContent.replace(/\u00a0/g, ' ').trim() !== '---') return;

  e.preventDefault();
  const hr = document.createElement('hr');
  const p = document.createElement('p');
  p.innerHTML = '<br>';
  const block = node.parentElement === editor ? node : node.parentElement;
  block.replaceWith(hr, p);
  placeCursor(p);
  queueSave();
}

/* ---------- Formatting actions (toolbar + right-click menu) ---------- */
function runAction(act) {
  editor.focus();
  switch (act) {
    case 'bold':
    case 'italic':
    case 'underline':
    case 'strikeThrough':
    case 'insertUnorderedList':
    case 'insertOrderedList':
    case 'removeFormat':
      document.execCommand(act, false, null);
      break;
    case 'highlight':
      document.execCommand('hiliteColor', false, '#fff0a6');
      break;
    case 'heading':
      document.execCommand('formatBlock', false, 'h2');
      break;
    case 'quote':
      document.execCommand('formatBlock', false, 'blockquote');
      break;
    case 'normal':
      document.execCommand('formatBlock', false, 'p');
      break;
    case 'table':
      insertTable();
      return;
    case 'divider':
      document.execCommand('insertHTML', false, '<hr><p><br></p>');
      break;
    case 'rowAbove':
    case 'rowBelow':
    case 'colRight':
    case 'deleteRow':
    case 'deleteCol':
    case 'deleteTable':
      tableOp(act);
      return;
  }
  queueSave();
}

document.querySelectorAll('[data-act]').forEach((btn) => {
  // Keeps the text selection when a toolbar button is clicked
  btn.addEventListener('mousedown', (e) => e.preventDefault());
  btn.onclick = () => runAction(btn.dataset.act);
});

/* ---------- Right-click menu ---------- */
const FORMAT_ITEMS = [
  ['Bold', 'bold'],
  ['Italic', 'italic'],
  ['Underline', 'underline'],
  ['Strikethrough', 'strikeThrough'],
  ['Highlight', 'highlight'],
  ['Clear formatting', 'removeFormat'],
  '-',
  ['Heading', 'heading'],
  ['Quote', 'quote'],
  ['Normal text', 'normal'],
  '-',
  ['Bullet list', 'insertUnorderedList'],
  ['Numbered list', 'insertOrderedList'],
  '-',
  ['Insert table', 'table'],
  ['Divider line', 'divider'],
];

const TABLE_ITEMS = [
  ['Insert row above', 'rowAbove'],
  ['Insert row below', 'rowBelow'],
  ['Insert column right', 'colRight'],
  '-',
  ['Delete row', 'deleteRow'],
  ['Delete column', 'deleteCol'],
  ['Delete table', 'deleteTable'],
];

function addItems(items) {
  for (const it of items) {
    if (it === '-') {
      const sep = document.createElement('div');
      sep.className = 'ctx-sep';
      menu.appendChild(sep);
      continue;
    }
    const b = document.createElement('button');
    b.className = 'ctx-item';
    b.textContent = it[0];
    b.onmousedown = (e) => e.preventDefault();
    b.onclick = () => { hideMenu(); runAction(it[1]); };
    menu.appendChild(b);
  }
}

function buildMenu(inTable) {
  menu.innerHTML = '';
  addItems(FORMAT_ITEMS);
  if (inTable) {
    const sep = document.createElement('div');
    sep.className = 'ctx-sep';
    menu.appendChild(sep);
    addItems(TABLE_ITEMS);
  }
}

function hideMenu() { menu.hidden = true; }

editor.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  lastCell = e.target.closest ? e.target.closest('td') : null;
  buildMenu(!!lastCell);
  menu.hidden = false;
  const w = menu.offsetWidth, h = menu.offsetHeight;
  menu.style.left = `${Math.max(4, Math.min(e.clientX, innerWidth - w - 8))}px`;
  menu.style.top = `${Math.max(4, Math.min(e.clientY, innerHeight - h - 8))}px`;
});

document.addEventListener('mousedown', (e) => { if (!menu.contains(e.target)) hideMenu(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideMenu(); });
window.addEventListener('blur', hideMenu);

/* ---------- Font and size ---------- */
fontSel.onchange = () => {
  localStorage.setItem('font', fontSel.value);
  const sel = window.getSelection();
  if (sel.rangeCount && !sel.isCollapsed && editor.contains(sel.anchorNode)) {
    editor.focus();
    document.execCommand('fontName', false, fontSel.value);
    queueSave();
  } else {
    editor.style.fontFamily = `"${fontSel.value}", "Segoe UI", sans-serif`;
  }
};

sizeInput.oninput = () => {
  const size = Number(sizeInput.value);
  if (!size) return;
  localStorage.setItem('fontSize', size);
  editor.style.fontSize = `${size}px`;
};

/* ---------- Editor events ---------- */
editor.addEventListener('input', queueSave);
editor.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') handleTab(e);
  else if (e.key === 'Enter') handleEnter(e);
});

// Paste plain text so web formatting doesn't come along
editor.addEventListener('paste', (e) => {
  e.preventDefault();
  document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
});

/* ---------- Focus mode ---------- */
async function toggleFocus() {
  const on = !app.classList.contains('focus');
  app.classList.toggle('focus', on);
  try {
    if (on) await document.documentElement.requestFullscreen?.();
    else await document.exitFullscreen?.();
  } catch (e) { /* fullscreen not available */ }
}

document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement) app.classList.remove('focus');
});

/* ---------- Theme ---------- */
function applyTheme(t) {
  app.dataset.theme = t;
  localStorage.setItem('theme', t);
}
themeSel.onchange = () => applyTheme(themeSel.value);

/* ---------- Buttons and shortcuts ---------- */
$('newDoc').onclick = newDoc;

title.oninput = () => {
  if (currentId && docs[currentId]) docs[currentId].title = title.value || 'Untitled';
  queueSave();
};
title.onchange = refreshList;

document.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  if (e.ctrlKey && e.shiftKey && key === 'f') { e.preventDefault(); toggleFocus(); }
  if (e.ctrlKey && key === 's') { e.preventDefault(); saveNow(); }
  if (e.ctrlKey && key === 'n') { e.preventDefault(); newDoc(); }
});

window.addEventListener('beforeunload', saveNow);

/* ---------- Start ---------- */
themeSel.value = localStorage.getItem('theme') || 'dark';
applyTheme(themeSel.value);

fontSel.value = localStorage.getItem('font') || 'Segoe UI Light';
editor.style.fontFamily = `"${fontSel.value}", "Segoe UI", sans-serif`;
if (localStorage.getItem('fontSize')) {
  sizeInput.value = localStorage.getItem('fontSize');
  editor.style.fontSize = `${sizeInput.value}px`;
}

const startIds = sortedIds();
if (startIds.length) openDoc(startIds[0]);
else newDoc();