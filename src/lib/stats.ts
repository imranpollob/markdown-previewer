export interface DocumentStats {
  words: number;
  characters: number;
  lines: number;
  readingMinutes: number;
}

const WORD = /[\p{L}\p{N}][\p{L}\p{N}\p{M}'’_-]*/gu;
const WORDS_PER_MINUTE = 225;

export function computeStats(text: string): DocumentStats {
  const words = text.match(WORD)?.length ?? 0;
  return {
    words,
    characters: [...text].length,
    lines: text === '' ? 0 : text.split('\n').length,
    readingMinutes: words === 0 ? 0 : Math.max(1, Math.round(words / WORDS_PER_MINUTE)),
  };
}
