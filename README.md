# oeis-pi-search

How far into pi do you have to go before the first N terms of an OEIS sequence appear?

Type an A-number, a sequence name, a few comma-separated terms, or a string of digits. The site concatenates the terms and reports where that digit string first appears in the first billion digits of pi, one row per prefix length.

Live at https://oeis-pi-search.dwainosaur.com

## Conventions

- Position 1 is the first digit after the decimal point. The leading 3 is not searched.
- Terms are concatenated exactly as OEIS lists them, leading zeros included. Minus signs are dropped.
- Searches cover the first 1,000,000,000 digits and digit strings up to 12 digits long.

## Development

```
pnpm install
pnpm dev
```

`pnpm test` runs unit tests, `pnpm e2e` runs Playwright against a built bundle, `pnpm build` produces it.

## Data

The digits and the index live in R2 and are built once with the Rust tools under `tools/`:

```
cd tools && cargo build --release
./target/release/pisearch pack pi-billion.txt out/      # packs the digits after the decimal point
./target/release/pisearch build out/                     # writes the lookup tables and buckets
./target/release/pisearch lookup out/ 31415 112358       # positions print one-based
```

`pack` accepts any text file of pi with or without the leading `3.`. The billion digit source was the MIT SIPB mirror, spot checked against pi.delivery. The layout is documented in `tools/src/format.rs` and read by `src/lib/index/reader.ts`; both are tested against the fixture in `src/lib/index/fixtures`.

Sequence data comes from the [OEIS](https://oeis.org) under CC BY-SA 4.0. This site is not affiliated with the OEIS Foundation.
