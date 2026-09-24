import { describe, expect, it } from 'vitest';
import { baseName, FileLoadError, readMarkdownFile, toFileName, validateFile } from './files';
import { computeStats } from './stats';

describe('validateFile', () => {
  it('accepts markdown and text files', () => {
    expect(validateFile({ name: 'README.md', size: 10, type: '' })).toBeNull();
    expect(validateFile({ name: 'notes.MARKDOWN', size: 10, type: '' })).toBeNull();
    expect(validateFile({ name: 'log', size: 10, type: 'text/plain' })).toBeNull();
  });

  it('rejects other types', () => {
    expect(validateFile({ name: 'photo.png', size: 10, type: 'image/png' })).toMatch(/isn’t a Markdown/);
  });

  it('rejects files over 2 MB', () => {
    expect(validateFile({ name: 'big.md', size: 3 * 1024 * 1024, type: '' })).toMatch(/3\.0 MB.*2\.0 MB/);
  });
});

describe('readMarkdownFile', () => {
  it('strips the BOM and normalises line endings', async () => {
    const file = new File(['﻿# Hi\r\nthere\r'], 'a.md');
    await expect(readMarkdownFile(file)).resolves.toBe('# Hi\nthere\n');
  });

  it('rejects binary content', async () => {
    const file = new File(['abc\u0000def'], 'a.md');
    await expect(readMarkdownFile(file)).rejects.toBeInstanceOf(FileLoadError);
  });
});

describe('file names', () => {
  it('derives safe names from titles', () => {
    expect(toFileName('My Notes: Draft #2')).toBe('my-notes-draft-2');
    expect(toFileName('Café résumé')).toBe('cafe-resume');
    expect(toFileName('!!!')).toBe('document');
  });

  it('strips only the last extension', () => {
    expect(baseName('notes.final.md')).toBe('notes.final');
    expect(baseName('.env')).toBe('.env');
  });
});

describe('computeStats', () => {
  it('counts words, characters, lines and reading time', () => {
    expect(computeStats('# Hello *world*\n\n- it’s 42')).toEqual({
      words: 4,
      characters: 26,
      lines: 3,
      readingMinutes: 1,
    });
  });

  it('handles empty documents', () => {
    expect(computeStats('')).toEqual({ words: 0, characters: 0, lines: 0, readingMinutes: 0 });
  });
});
