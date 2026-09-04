import { ImageResponse } from 'workers-og';
import { ogTree, type OgModel } from './og-html';

type Font = { name: string; data: ArrayBuffer; weight: 400 | 500; style: 'normal' };

let fonts: Promise<Font[]> | undefined;

/** Fonts come from the static assets binding, read once per isolate. */
export function loadFonts(assets: Fetcher, origin: string): Promise<Font[]> {
  fonts ??= Promise.all(
    (
      [
        ['Newsreader', 'newsreader-400.ttf', 400],
        ['Newsreader', 'newsreader-500.ttf', 500],
        ['JetBrains Mono', 'jetbrainsmono-400.ttf', 400],
        ['JetBrains Mono', 'jetbrainsmono-500.ttf', 500],
      ] as const
    ).map(async ([name, file, weight]) => {
      const res = await assets.fetch(new URL(`/fonts/og/${file}`, origin));
      if (!res.ok) throw new Error(`font ${file} missing from assets`);
      return { name, data: await res.arrayBuffer(), weight, style: 'normal' as const };
    }),
  ).catch((err) => {
    fonts = undefined;
    throw err;
  });
  return fonts;
}

export type { OgModel } from './og-html';

export async function ogImage(model: OgModel, assets: Fetcher, origin: string): Promise<Response> {
  const res = new ImageResponse(
    ogTree(model) as unknown as ConstructorParameters<typeof ImageResponse>[0],
    {
      width: 1200,
      height: 630,
      fonts: await loadFonts(assets, origin),
    },
  );
  res.headers.set('Cache-Control', 'public, max-age=86400, s-maxage=604800');
  return res;
}
