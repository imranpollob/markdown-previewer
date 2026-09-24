export const MAX_FILE_BYTES = 2 * 1024 * 1024;
export const MARKDOWN_EXTENSIONS = ['.md', '.markdown', '.mdown', '.mkd', '.mkdn', '.mdx', '.txt'];

export class FileLoadError extends Error {}

type FileInfo = Pick<File, 'name' | 'size' | 'type'>;

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot).toLowerCase();
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function isMarkdownFile(file: FileInfo): boolean {
  return MARKDOWN_EXTENSIONS.includes(extensionOf(file.name)) || file.type === 'text/markdown';
}

/** Returns a user-facing reason the file can't be opened, or null if it's fine. */
export function validateFile(file: FileInfo): string | null {
  if (!isMarkdownFile(file) && !file.type.startsWith('text/')) {
    return `“${file.name}” isn’t a Markdown or text file.`;
  }
  if (file.size > MAX_FILE_BYTES) {
    return `“${file.name}” is ${formatBytes(file.size)}. The limit is ${formatBytes(MAX_FILE_BYTES)}.`;
  }
  return null;
}

/** Reads a file entirely in the browser — nothing is uploaded anywhere. */
export async function readMarkdownFile(file: File): Promise<string> {
  const problem = validateFile(file);
  if (problem) throw new FileLoadError(problem);

  const text = await file.text();
  if (text.includes('\u0000')) {
    throw new FileLoadError(`“${file.name}” looks like a binary file.`);
  }
  return text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
}

/** "notes.final.md" -> "notes.final" */
export function baseName(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot > 0 ? fileName.slice(0, dot) : fileName;
}

/** A safe file name from a document title: "My Notes: Draft #2" -> "my-notes-draft-2". */
export function toFileName(title: string): string {
  const slug = title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug || 'document';
}

export function downloadFile(fileName: string, content: string, mimeType: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: `${mimeType};charset=utf-8` }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
