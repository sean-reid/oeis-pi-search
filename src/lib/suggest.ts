import { concatTerms, parseInput } from './parse-input';

export interface Suggestion {
  /** Main text, e.g. an A-number or a digit string. */
  label: string;
  /** Secondary text, e.g. the sequence name or what will happen. */
  detail: string;
  href: string;
}

/** The action a non-name input resolves to, shown as the first suggestion. */
export function describeInput(raw: string, maxDigits: number): Suggestion | null {
  const parsed = parseInput(raw);
  switch (parsed.kind) {
    case 'anumber':
      return { label: parsed.anumber, detail: 'Open this sequence', href: `/${parsed.anumber}` };
    case 'digits': {
      const over = parsed.digits.length > maxDigits;
      return {
        label: parsed.digits,
        detail: over
          ? `Only the first ${maxDigits} digits can be searched`
          : 'Find these digits in pi',
        href: `/digits/${over ? parsed.digits.slice(0, maxDigits) : parsed.digits}`,
      };
    }
    case 'terms':
      return {
        label: parsed.terms.join(', '),
        detail: `Search for ${concatTerms(parsed.terms)}`,
        href: `/terms/${parsed.terms.join(',')}`,
      };
    default:
      return null;
  }
}
