import { PiIndex, type Manifest, type RangeSource } from './reader';

export const INDEX_PREFIX = 'index/v1/';

export function r2Source(bucket: R2Bucket, prefix = INDEX_PREFIX): RangeSource {
  return {
    async read(object, offset, length) {
      const obj = await bucket.get(prefix + object, { range: { offset, length } });
      if (!obj) throw new Error(`missing index object ${prefix}${object}`);
      return new Uint8Array(await obj.arrayBuffer());
    },
  };
}

let cached: Promise<PiIndex> | undefined;

/** One index per isolate; the manifest is read once and reused across requests. */
export function openIndex(bucket: R2Bucket): Promise<PiIndex> {
  cached ??= (async () => {
    const obj = await bucket.get(INDEX_PREFIX + 'index.json');
    if (!obj) throw new Error('index manifest is missing');
    const manifest = (await obj.json()) as Manifest;
    return PiIndex.open(r2Source(bucket), manifest);
  })().catch((err) => {
    cached = undefined;
    throw err;
  });
  return cached;
}
