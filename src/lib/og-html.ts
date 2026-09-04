import { formatNumber } from './format';
import type { StairRow } from './staircase';

export interface OgModel {
  eyebrow: string;
  title: string;
  rows: StairRow[];
  totalDigits: number;
  noun?: 'terms' | 'digits';
}

/** The element shape satori renders; a plain object so no HTML parsing or escaping is involved. */
export interface OgElement {
  type: 'div' | 'span';
  props: { style?: Record<string, string | number>; children?: (OgElement | string)[] | string };
}

const TITLE_LIMIT = 72;
const ROWS_SHOWN = 5;
const INK = '#1a1a1a';
const SOFT = '#5a5a5a';
const RULE = '#d8d6cf';
const MARK = '#b3261e';
const MONO = 'JetBrains Mono';

/** Cuts at a word boundary so the title fits on two lines of the image. */
export function clampTitle(title: string, limit = TITLE_LIMIT): string {
  if (title.length <= limit) return title;
  const cut = title.slice(0, limit - 1);
  const space = cut.lastIndexOf(' ');
  return (space > limit / 2 ? cut.slice(0, space) : cut).replace(/[\s,;:]+$/, '') + '…';
}

export function headline(
  rows: readonly StairRow[],
  totalDigits: number,
  noun: 'terms' | 'digits' = 'terms',
): string {
  let best: StairRow | undefined;
  for (const r of rows) if (r.first !== null) best = r;
  if (!best) return `Not in the first ${formatNumber(totalDigits)} digits of pi`;
  const one = noun === 'digits' ? 'The first digit appears' : 'The first term appears';
  const many = `The first ${best.k} ${noun} appear`;
  return `${best.k === 1 ? one : many} at position ${formatNumber(best.first as number)}`;
}

const el = (
  type: OgElement['type'],
  style: Record<string, string | number>,
  children: (OgElement | string)[] | string,
): OgElement => ({ type, props: { style, children } });

export function ogTree(model: OgModel): OgElement {
  const rows = model.rows.slice(0, ROWS_SHOWN).map((r) =>
    el(
      'div',
      {
        display: 'flex',
        justifyContent: 'space-between',
        padding: '10px 0',
        borderBottom: `1px solid ${RULE}`,
        fontFamily: MONO,
        fontSize: 26,
      },
      [
        el('div', { display: 'flex', gap: 28 }, [
          el('span', { color: SOFT, width: 36 }, String(r.k)),
          el('span', {}, r.digits),
        ]),
        el(
          'span',
          r.first === null ? { color: SOFT } : {},
          r.first === null ? 'not found' : formatNumber(r.first),
        ),
      ],
    ),
  );
  return el(
    'div',
    {
      display: 'flex',
      flexDirection: 'column',
      width: 1200,
      height: 630,
      padding: '64px 72px',
      background: '#fdfdfb',
      color: INK,
      fontFamily: 'Newsreader',
    },
    [
      el(
        'div',
        { display: 'flex', flexShrink: 0, fontFamily: MONO, fontSize: 26, color: SOFT },
        model.eyebrow,
      ),
      el(
        'div',
        {
          display: 'flex',
          flexShrink: 0,
          fontSize: 44,
          fontWeight: 500,
          lineHeight: 1.15,
          marginTop: 8,
        },
        clampTitle(model.title),
      ),
      el('div', { display: 'flex', flexShrink: 0, fontSize: 34, marginTop: 22 }, [
        el('span', {}, headline(model.rows, model.totalDigits, model.noun)),
        el('span', { color: MARK }, '.'),
      ]),
      el(
        'div',
        {
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 1,
          minHeight: 0,
          overflow: 'hidden',
          marginTop: 26,
          borderTop: `1px solid ${INK}`,
        },
        rows,
      ),
      el(
        'div',
        {
          display: 'flex',
          flexShrink: 0,
          marginTop: 'auto',
          paddingTop: 16,
          fontSize: 22,
          color: SOFT,
        },
        'oeis-pi-search.dwainosaur.com',
      ),
    ],
  );
}
