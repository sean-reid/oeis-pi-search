/** Sequences shown on the home and browse pages, in display order. */
export const EXAMPLES = [
  'A000045',
  'A000040',
  'A000290',
  'A000079',
  'A000108',
  'A000217',
  'A000142',
  'A000796',
  'A005132',
  'A005150',
] as const;

/** A short label for well known sequences; everything else uses the OEIS name. */
export const SHORT_NAMES: Record<string, string> = {
  A000045: 'Fibonacci numbers',
  A000040: 'Prime numbers',
  A000290: 'Squares',
  A000079: 'Powers of 2',
  A000108: 'Catalan numbers',
  A000217: 'Triangular numbers',
  A000142: 'Factorials',
  A000796: 'Digits of pi',
  A005132: 'Recamán’s sequence',
  A005150: 'Look and say',
};
