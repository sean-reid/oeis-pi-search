import { formatNumber } from './format';
import type { StairRow } from './staircase';

export interface OgModel {
  eyebrow: string;
  title: string;
  rows: StairRow[];
  totalDigits: number;
  noun?: 'terms' | 'digits';
}

const TITLE_LIMIT = 72;

/** Cuts at a word boundary so the title fits on two lines of the image. */
export function clampTitle(title: string, limit = TITLE_LIMIT): string {
  if (title.length <= limit) return title;
  const cut = title.slice(0, limit - 1);
  const space = cut.lastIndexOf(' ');
  return (space > limit / 2 ? cut.slice(0, space) : cut).replace(/[\s,;:]+$/, '') + '…';
}

const escape = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);

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

export function ogHtml(model: OgModel): string {
  const shown = model.rows.slice(0, 6);
  const rowsHtml = shown
    .map(
      (r) => `
      <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #d8d6cf;font-family:'JetBrains Mono';font-size:26px;">
        <span style="display:flex;gap:28px;"><span style="display:flex;color:#5a5a5a;width:36px;">${r.k}</span><span>${escape(r.digits)}</span></span>
        <span style="${r.first === null ? 'color:#5a5a5a;' : ''}">${r.first === null ? 'not found' : formatNumber(r.first)}</span>
      </div>`,
    )
    .join('');
  return `
  <div style="display:flex;flex-direction:column;width:1200px;height:630px;padding:64px 72px;background:#fdfdfb;color:#1a1a1a;font-family:'Newsreader';">
    <div style="display:flex;font-family:'JetBrains Mono';font-size:26px;color:#5a5a5a;">${escape(model.eyebrow)}</div>
    <div style="display:flex;font-size:44px;font-weight:500;line-height:1.15;margin-top:8px;">${escape(clampTitle(model.title))}</div>
    <div style="display:flex;font-size:34px;margin-top:22px;">${escape(headline(model.rows, model.totalDigits, model.noun))}<span style="color:#b3261e;">.</span></div>
    <div style="display:flex;flex-direction:column;margin-top:26px;border-top:1px solid #1a1a1a;">${rowsHtml}</div>
    <div style="display:flex;margin-top:auto;font-size:22px;color:#5a5a5a;">oeis-pi-search.dwainosaur.com</div>
  </div>`.replace(/>\s+</g, '><');
}
