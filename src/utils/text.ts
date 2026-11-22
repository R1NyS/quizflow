import {
  CardDelimiterOption,
  ParsedCardPreview,
  TermDelimiterOption,
} from '../types';

export function normalizeAnswer(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.!?,;:…]+$/g, '')
    .trim();
}

export function resolveTermDelimiter(
  option: TermDelimiterOption,
  customValue: string
): string {
  switch (option) {
    case 'tab':
      return '\t';
    case 'dash':
      return ' - ';
    case 'comma':
      return ',';
    case 'custom':
      return customValue || '\t';
  }
}

export function resolveCardDelimiter(
  option: CardDelimiterOption,
  customValue: string
): string {
  switch (option) {
    case 'newline':
      return '\n';
    case 'semicolon':
      return ';';
    case 'custom':
      return customValue || '\n';
  }
}

export function parseBulkImportText(
  rawText: string,
  termDelimiter: string,
  cardDelimiter: string
): ParsedCardPreview[] {
  if (!rawText.trim()) return [];

  const normalized = rawText.replace(/\r\n/g, '\n');
  const rawEntries = cardDelimiter
    ? normalized.split(cardDelimiter)
    : [normalized];

  const results: ParsedCardPreview[] = [];

  for (const entry of rawEntries) {
    const trimmedEntry = entry.trim();
    if (!trimmedEntry) continue;

    let separatorIndex = -1;
    let separatorLength = termDelimiter.length;

    if (termDelimiter === ' - ') {
      const dashMatch = trimmedEntry.match(/\s[-–—]\s/);
      if (dashMatch && dashMatch.index !== undefined) {
        separatorIndex = dashMatch.index;
        separatorLength = dashMatch[0].length;
      } else {
        separatorIndex = trimmedEntry.indexOf('-');
        separatorLength = 1;
      }
    } else if (termDelimiter.length > 0) {
      separatorIndex = trimmedEntry.indexOf(termDelimiter);
    }

    if (separatorIndex === -1) {
      results.push({ term: trimmedEntry, definition: '' });
      continue;
    }

    const term = trimmedEntry.slice(0, separatorIndex).trim();
    const definition = trimmedEntry
      .slice(separatorIndex + separatorLength)
      .trim();

    if (term || definition) {
      results.push({ term, definition });
    }
  }

  return results;
}

export function formatDurationMs(ms: number): string {
  const seconds = ms / 1000;
  return `${seconds.toFixed(1)} сек`;
}

export function pluralizeCards(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} термин`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${count} термина`;
  }
  return `${count} терминов`;
}