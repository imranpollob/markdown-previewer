import '@fontsource/plus-jakarta-sans/400.css';
import '@fontsource/plus-jakarta-sans/400-italic.css';
import '@fontsource/plus-jakarta-sans/500.css';
import '@fontsource/plus-jakarta-sans/600.css';
import '@fontsource/plus-jakarta-sans/700.css';
import '@fontsource/outfit/700.css';
import './styles/brand.css';
import './styles/app.css';
import './styles/markdown.css';
import './styles/highlight.css';

import {
  continueList,
  cycleHeading,
  indent,
  insertCodeBlock,
  insertLink,
  insertRule,
  insertTable,
  toggleInline,
  toggleLinePrefix,
  type Edit,
  type Selection,
} from './lib/editor-commands';
import { buildStandaloneHtml } from './lib/export-html';
import { baseName, downloadFile, FileLoadError, isMarkdownFile, readMarkdownFile, toFileName } from './lib/files';
import { loadHighlighter, onHighlighterReady } from './lib/highlight';
import { firstHeading, renderMarkdown } from './lib/markdown';
import { computeStats } from './lib/stats';
import { readSetting, writeSetting } from './lib/storage';
import { SAMPLE_DOCUMENT } from './sample';
import { hydrateIcons, icon, type IconName } from './ui/icons';
import { patchChildren } from './ui/patch';
import { createScrollSync } from './ui/scroll-sync';
import { initThemeToggle } from './ui/theme';
import { toast } from './ui/toast';

const byId = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const editor = byId<HTMLTextAreaElement>('editor');
const preview = byId('preview');
const previewScroll = byId('preview-scroll');
const workspace = byId('workspace');
const fileInput = byId<HTMLInputElement>('file-input');
const saveStatus = byId('save-status');

const isMac = /Mac|iPhone|iPad/.test(navigator.userAgent);
const shortcutLabel = (keys: string) => (isMac ? `⌘${keys.replace('Shift+', '⇧')}` : `Ctrl+${keys}`);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

hydrateIcons();
initThemeToggle(byId<HTMLButtonElement>('btn-theme'));

/* ---------------------------------------------------------------- document */

/** Base name of the file the user opened, used for downloads. */
let openedFileName = readSetting('filename');
editor.value = readSetting('document') ?? SAMPLE_DOCUMENT;

function documentName(): string {
  return openedFileName ?? toFileName(firstHeading(editor.value) ?? 'document');
}

function selection(): Selection {
  return { value: editor.value, start: editor.selectionStart, end: editor.selectionEnd };
}

/** Applies an edit through the browser's editing pipeline so Ctrl+Z still works. */
function applyEdit(edit: Edit | null): void {
  if (!edit) return;
  editor.focus();
  editor.setSelectionRange(edit.from, edit.to);

  if (edit.insert !== '' || edit.from !== edit.to) {
    let applied = false;
    try {
      applied = edit.insert === ''
        ? document.execCommand('delete')
        : document.execCommand('insertText', false, edit.insert);
    } catch {
      applied = false;
    }
    if (!applied) {
      editor.setRangeText(edit.insert, edit.from, edit.to, 'end');
      editor.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
  editor.setSelectionRange(edit.selStart, edit.selEnd);
}

function replaceDocument(text: string): void {
  applyEdit({ from: 0, to: editor.value.length, insert: text, selStart: 0, selEnd: 0 });
  editor.scrollTop = 0;
  previewScroll.scrollTop = 0;
}

/* --------------------------------------------------------------- rendering */

const scrollSync = createScrollSync(editor, previewScroll);
const EMPTY_PREVIEW = '<p class="preview-empty">Nothing to preview yet. Start typing in the editor.</p>';

function render(): void {
  const html = renderMarkdown(editor.value);
  patchChildren(preview, html.trim() ? html : EMPTY_PREVIEW);
  scrollSync.invalidatePreview();
  updateStats();
}

let renderTimer = 0;
function scheduleRender(): void {
  clearTimeout(renderTimer);
  // Keep typing smooth on very large documents.
  const size = editor.value.length;
  const delay = size > 200_000 ? 300 : size > 50_000 ? 80 : 0;
  renderTimer = window.setTimeout(() => {
    render();
    scrollSync.syncPreviewToEditor();
  }, delay);
}

onHighlighterReady(render);

const statOutputs = {
  words: byId('stat-words'),
  characters: byId('stat-chars'),
  lines: byId('stat-lines'),
  readingMinutes: byId('stat-reading'),
};

function updateStats(): void {
  const stats = computeStats(editor.value);
  for (const key of Object.keys(statOutputs) as (keyof typeof statOutputs)[]) {
    statOutputs[key].textContent = stats[key].toLocaleString();
  }
}

/* ---------------------------------------------------------------- autosave */

const SAVE_MESSAGES = {
  saved: 'Saved in this browser',
  pending: 'Saving…',
  error: 'Not saved: browser storage is unavailable or full',
};

function setSaveState(state: keyof typeof SAVE_MESSAGES): void {
  saveStatus.dataset.state = state;
  saveStatus.textContent = SAVE_MESSAGES[state];
}

let saveTimer = 0;
function saveNow(): void {
  clearTimeout(saveTimer);
  setSaveState(writeSetting('document', editor.value) ? 'saved' : 'error');
}

function scheduleSave(): void {
  setSaveState('pending');
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(saveNow, 400);
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && saveStatus.dataset.state === 'pending') saveNow();
});

editor.addEventListener('input', () => {
  scrollSync.invalidateEditor();
  scheduleRender();
  scheduleSave();
});

/* ----------------------------------------------------------------- toolbar */

interface Tool {
  icon: IconName;
  label: string;
  keys?: string;
  run: (sel: Selection) => Edit;
}

const TOOLS: (Tool | 'separator')[] = [
  { icon: 'heading', label: 'Heading', run: cycleHeading },
  { icon: 'bold', label: 'Bold', keys: 'B', run: (s) => toggleInline(s, 'bold') },
  { icon: 'italic', label: 'Italic', keys: 'I', run: (s) => toggleInline(s, 'italic') },
  { icon: 'strikethrough', label: 'Strikethrough', keys: 'Shift+X', run: (s) => toggleInline(s, 'strikethrough') },
  'separator',
  { icon: 'link', label: 'Link', keys: 'K', run: (s) => insertLink(s) },
  { icon: 'image', label: 'Image', run: (s) => insertLink(s, true) },
  { icon: 'code', label: 'Inline code', keys: 'E', run: (s) => toggleInline(s, 'code') },
  { icon: 'codeBlock', label: 'Code block', run: insertCodeBlock },
  'separator',
  { icon: 'bulletList', label: 'Bulleted list', run: (s) => toggleLinePrefix(s, 'bullet') },
  { icon: 'orderedList', label: 'Numbered list', run: (s) => toggleLinePrefix(s, 'ordered') },
  { icon: 'taskList', label: 'Task list', run: (s) => toggleLinePrefix(s, 'task') },
  { icon: 'quote', label: 'Quote', run: (s) => toggleLinePrefix(s, 'quote') },
  'separator',
  { icon: 'table', label: 'Table', run: insertTable },
  { icon: 'rule', label: 'Horizontal rule', run: insertRule },
];

const toolbar = byId('toolbar');
const shortcutCommands = new Map<string, Tool['run']>();

for (const tool of TOOLS) {
  if (tool === 'separator') {
    toolbar.insertAdjacentHTML('beforeend', '<span class="toolbar-sep" aria-hidden="true"></span>');
    continue;
  }
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'tool';
  button.innerHTML = icon(tool.icon);
  button.setAttribute('aria-label', tool.label);
  button.title = tool.keys ? `${tool.label} (${shortcutLabel(tool.keys)})` : tool.label;
  if (tool.keys) {
    button.setAttribute('aria-keyshortcuts', `${isMac ? 'Meta' : 'Control'}+${tool.keys}`);
    shortcutCommands.set(tool.keys.toLowerCase(), tool.run);
  }
  button.addEventListener('click', () => applyEdit(tool.run(selection())));
  toolbar.append(button);
}

// Keep the textarea focused (and its selection intact) when clicking tools.
toolbar.addEventListener('mousedown', (event) => event.preventDefault());

// One tab stop for the whole toolbar; arrow keys move between tools.
const toolButtons = [...toolbar.querySelectorAll<HTMLButtonElement>('button')];
toolButtons.forEach((button, i) => { button.tabIndex = i === 0 ? 0 : -1; });
toolbar.addEventListener('keydown', (event) => {
  const index = toolButtons.indexOf(document.activeElement as HTMLButtonElement);
  if (index === -1) return;
  const targets: Record<string, number> = {
    ArrowRight: (index + 1) % toolButtons.length,
    ArrowLeft: (index - 1 + toolButtons.length) % toolButtons.length,
    Home: 0,
    End: toolButtons.length - 1,
  };
  const target = targets[event.key];
  if (target === undefined) return;
  event.preventDefault();
  toolButtons[index]!.tabIndex = -1;
  toolButtons[target]!.tabIndex = 0;
  toolButtons[target]!.focus();
});

/* -------------------------------------------------------- editor keyboard */

// Tab indents inside the editor; Escape then Tab moves focus on (no keyboard trap).
let tabEscapes = false;

editor.addEventListener('keydown', (event) => {
  if (event.isComposing) return;
  const mod = isMac ? event.metaKey : event.ctrlKey;

  if (event.key === 'Escape') {
    tabEscapes = true;
    return;
  }
  if (event.key === 'Tab' && !mod && !event.altKey) {
    if (tabEscapes) {
      tabEscapes = false;
      return;
    }
    event.preventDefault();
    applyEdit(indent(selection(), event.shiftKey));
    return;
  }
  tabEscapes = false;

  if (event.key === 'Enter' && !mod && !event.shiftKey && !event.altKey) {
    const edit = continueList(selection());
    if (edit) {
      event.preventDefault();
      applyEdit(edit);
    }
    return;
  }

  if (mod && !event.altKey) {
    const key = (event.shiftKey ? 'shift+' : '') + event.key.toLowerCase();
    const command = shortcutCommands.get(key);
    if (command) {
      event.preventDefault();
      applyEdit(command(selection()));
    }
  }
});

/* ------------------------------------------------------------ file actions */

async function openFile(file: File): Promise<void> {
  try {
    const text = await readMarkdownFile(file);
    replaceDocument(text);
    openedFileName = baseName(file.name);
    writeSetting('filename', openedFileName);
    toast(`Opened ${file.name}. Press ${shortcutLabel('Z')} to undo.`);
  } catch (error) {
    toast(error instanceof FileLoadError ? error.message : `Couldn’t read “${file.name}”.`, 'error');
  }
}

function openFilePicker(): void {
  fileInput.value = '';
  fileInput.click();
}

fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  if (file) void openFile(file);
});

function downloadMarkdown(): void {
  const name = `${documentName()}.md`;
  downloadFile(name, editor.value, 'text/markdown');
  toast(`Downloaded ${name}`);
}

async function exportedHtml(): Promise<string> {
  await loadHighlighter().catch(() => {}); // highlight code if we can, export anyway if not
  return renderMarkdown(editor.value, { sourceLines: false });
}

async function exportHtml(): Promise<void> {
  const title = firstHeading(editor.value) ?? documentName();
  const name = `${documentName()}.html`;
  downloadFile(name, buildStandaloneHtml(title, await exportedHtml()), 'text/html');
  toast(`Downloaded ${name}`);
}

async function copyHtml(): Promise<void> {
  try {
    await navigator.clipboard.writeText(await exportedHtml());
    toast('HTML copied to clipboard');
  } catch {
    toast('Couldn’t copy. Your browser blocked clipboard access.', 'error');
  }
}

const headerButtons: [string, string, () => void][] = [
  ['btn-open', `Open a Markdown file (${shortcutLabel('O')})`, openFilePicker],
  ['btn-save', `Download as .md (${shortcutLabel('S')})`, downloadMarkdown],
  ['btn-export-html', 'Download as a standalone HTML page', () => void exportHtml()],
  ['btn-copy-html', 'Copy the rendered HTML', () => void copyHtml()],
];
for (const [id, title, action] of headerButtons) {
  const button = byId(id);
  button.title = title;
  button.addEventListener('click', action);
}

document.addEventListener('keydown', (event) => {
  const mod = isMac ? event.metaKey : event.ctrlKey;
  if (!mod || event.altKey || event.shiftKey) return;
  const key = event.key.toLowerCase();
  if (key === 's') {
    event.preventDefault();
    downloadMarkdown();
  } else if (key === 'o') {
    event.preventDefault();
    openFilePicker();
  }
});

/* ---------------------------------------------------------- drag and paste */

let dragDepth = 0;
const carriesFiles = (event: DragEvent) => event.dataTransfer?.types.includes('Files') ?? false;

function endDrag(): void {
  dragDepth = 0;
  document.body.classList.remove('is-dragging');
}

window.addEventListener('dragenter', (event) => {
  if (!carriesFiles(event)) return;
  event.preventDefault();
  dragDepth++;
  document.body.classList.add('is-dragging');
});
window.addEventListener('dragover', (event) => {
  if (!carriesFiles(event)) return;
  event.preventDefault();
  event.dataTransfer!.dropEffect = 'copy';
});
window.addEventListener('dragleave', (event) => {
  if (!carriesFiles(event)) return;
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) endDrag();
});
window.addEventListener('drop', (event) => {
  if (!carriesFiles(event)) return;
  event.preventDefault();
  endDrag();
  const file = event.dataTransfer?.files[0];
  if (file) void openFile(file);
});

editor.addEventListener('paste', (event) => {
  const file = event.clipboardData?.files[0];
  if (file && isMarkdownFile(file)) {
    event.preventDefault();
    void openFile(file);
  }
});

/* ------------------------------------------------------------------ preview */

// In-document links (#heading, footnotes) scroll the preview instead of the page.
preview.addEventListener('click', (event) => {
  const link = (event.target as Element).closest('a[href^="#"]');
  if (!link) return;
  let id = link.getAttribute('href')!.slice(1);
  try {
    id = decodeURIComponent(id);
  } catch {
    // keep the raw fragment
  }
  const target = document.getElementById(id);
  if (target && preview.contains(target)) {
    event.preventDefault();
    target.scrollIntoView({ block: 'start', behavior: reducedMotion.matches ? 'auto' : 'smooth' });
  }
});

const syncButton = byId<HTMLButtonElement>('btn-sync');
function setScrollSync(enabled: boolean): void {
  syncButton.setAttribute('aria-pressed', String(enabled));
  scrollSync.setEnabled(enabled);
}
setScrollSync(readSetting('scroll-sync') !== 'off');
syncButton.addEventListener('click', () => {
  const enabled = syncButton.getAttribute('aria-pressed') !== 'true';
  writeSetting('scroll-sync', enabled ? 'on' : 'off');
  setScrollSync(enabled);
});

/* --------------------------------------------------- mobile write/preview */

const tabs = { editor: byId('tab-editor'), preview: byId('tab-preview') };

function showView(view: keyof typeof tabs): void {
  workspace.dataset.view = view;
  for (const [name, tab] of Object.entries(tabs)) {
    const selected = name === view;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
  }
}

tabs.editor.addEventListener('click', () => showView('editor'));
tabs.preview.addEventListener('click', () => showView('preview'));
tabs.editor.parentElement!.addEventListener('keydown', (event) => {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
  const next = workspace.dataset.view === 'editor' ? 'preview' : 'editor';
  showView(next);
  tabs[next].focus();
});

/* --------------------------------------------------------------------- boot */

render();
document.fonts?.ready.then(() => {
  scrollSync.invalidateEditor();
  scrollSync.invalidatePreview();
});
