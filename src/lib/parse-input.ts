export const MAX_DIGITS = 12;

export type ParsedInput =
  | { kind: 'anumber'; anumber: string }
  | { kind: 'digits'; digits: string }
  | { kind: 'terms'; terms: string[] }
  | { kind: 'name'; query: string }
  | { kind: 'empty' };

const anumberPattern = /^a?\s*0*(\d{1,6})$/i;
const digitsPattern = /^\d+$/;
const termsPattern = /^-?\d+(\s*[,;\s]\s*-?\d+)+$/;

export function normalizeAnumber(n: string | number): string {
  return 'A' + String(n).padStart(6, '0');
}

export function parseInput(raw: string): ParsedInput {
  const text = raw.trim().replace(/\s+/g, ' ');
  if (text === '') return { kind: 'empty' };

  const a = anumberPattern.exec(text);
  if (a && /^a/i.test(text)) return { kind: 'anumber', anumber: normalizeAnumber(a[1]) };

  if (digitsPattern.test(text)) return { kind: 'digits', digits: text };

  if (termsPattern.test(text)) {
    const terms = text.split(/[,;\s]+/).filter(Boolean);
    return { kind: 'terms', terms };
  }

  return { kind: 'name', query: text };
}

export function concatTerms(terms: readonly string[]): string {
  return terms.map((t) => t.replace(/^-/, '')).join('');
}
