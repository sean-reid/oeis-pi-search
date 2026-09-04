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
pnpm seed
pnpm dev
```

`pnpm seed` loads a small fixture (the first 20,000 digits of pi and thirteen sequences) into wrangler's local D1 and R2 state so every page works offline. `pnpm test` runs unit tests, `pnpm e2e` runs Playwright against a built bundle, `pnpm build` produces it.

Routes: `/A000045` for a sequence, `/digits/31415` for a digit string, `/terms/1,1,2,3` for terms, each with an optional `/N` to select a row of the staircase. `/search?q=` resolves any of those from the search box or searches names.

## Deploying

Pushes to `main` build and deploy through `.github/workflows/deploy.yml` with one repository secret, `CLOUDFLARE_API_TOKEN`, an account token with Workers Scripts, Workers KV, Workers R2, and D1 edit on the account plus Workers Routes, DNS, and SSL edit on the zone. Wrangler takes the account from the token. The Worker serves `oeis-pi-search.dwainosaur.com` as a custom domain and its `workers.dev` subdomain. Set the repository variable `CF_BEACON_TOKEN` to a Cloudflare Web Analytics token to enable the beacon; without it no analytics script is emitted.

`refresh-oeis.yml` runs on the first of each month: it downloads the current OEIS dumps and the index from R2, recomputes every staircase, loads the result into whichever of the two D1 databases is not serving traffic, and flips the `live-db` key in KV to point at it. D1 blocks every query on a database while it imports, so the live one is never touched. It can also be started by hand from the Actions tab.

## Data

The digits and the index live in R2 and are built once with the Rust tools under `tools/`:

```
cd tools && cargo build --release
./target/release/pisearch pack pi-billion.txt out/      # packs the digits after the decimal point
./target/release/pisearch build out/                     # writes the lookup tables and buckets
./target/release/pisearch lookup out/ 31415 112358       # positions print one-based
./target/release/pisearch oeis stripped.gz names.gz out/ sequences.sql --snapshot 2026-09-04
```

`oeis` reads the OEIS `stripped` and `names` dumps, computes every sequence's staircase against the index, and writes SQL that `node scripts/import-standby.mjs sequences.sql` loads into the standby D1 database before switching traffic to it. The index files upload with `wrangler r2 object put` under `index/v1/`.

`pack` accepts any text file of pi with or without the leading `3.`. The billion digit source was the MIT SIPB mirror, spot checked against pi.delivery. The layout is documented in `tools/src/format.rs` and read by `src/lib/index/reader.ts`; both are tested against the fixture in `src/lib/index/fixtures`.

Sequence data comes from the [OEIS](https://oeis.org) under CC BY-SA 4.0. This site is not affiliated with the OEIS Foundation.
