const numberFormat = new Intl.NumberFormat('en-US');

export const formatNumber = (n: number) => numberFormat.format(n);

export const ANUMBER = /^A\d{6}$/;

/** Accepts A45, a000045, 45 and returns A000045, or null. */
export function canonicalAnumber(raw: string): string | null {
  const m = /^a?\s*(\d{1,6})$/i.exec(raw.trim());
  return m ? 'A' + m[1].padStart(6, '0') : null;
}

export function pluralTerms(k: number): string {
  return k === 1 ? 'the first term' : `the first ${k} terms`;
}
