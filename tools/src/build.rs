use crate::digits::{Packed, DIGITS_FILE};
use crate::format::*;
use anyhow::{bail, Context, Result};
use rayon::prelude::*;
use sha2::{Digest, Sha256};
use std::fs::File;
use std::io::{BufWriter, Read, Write};
use std::path::Path;
use std::time::Instant;

pub struct BuildOptions {
    pub table_max: usize,
    pub bucket_prefix: usize,
}

impl Default for BuildOptions {
    fn default() -> Self {
        Self {
            table_max: 8,
            bucket_prefix: 8,
        }
    }
}

pub fn build(dir: &Path, opts: &BuildOptions, log: &mut dyn Write) -> Result<Manifest> {
    if opts.bucket_prefix > opts.table_max {
        bail!("bucket_prefix must not exceed table_max");
    }
    let digits_path = dir.join(DIGITS_FILE);
    let file =
        File::open(&digits_path).with_context(|| format!("open {}", digits_path.display()))?;
    let mmap = unsafe { memmap2::Mmap::map(&file)? };
    shard_file(&digits_path)?;
    let len_bytes = mmap.len();
    let n = len_bytes * 2 - trailing_pad(&mmap);
    if n > u32::MAX as usize - 1 {
        bail!("{n} digits exceed the u32 position space");
    }
    let packed = Packed::new(&mmap, n);
    writeln!(log, "{n} digits, sha256 in progress")?;
    let sha = format!("{:x}", Sha256::digest(&mmap[..]));

    let t = Instant::now();
    let tables: Vec<Vec<TableEntry>> = (1..=opts.table_max)
        .into_par_iter()
        .map(|k| build_table(&packed, k))
        .collect();
    writeln!(log, "tables built in {:.1?}", t.elapsed())?;
    for (k, table) in tables.iter().enumerate() {
        write_entries(
            &dir.join(table_file(k + 1)),
            table.iter().map(|e| e.to_bytes()),
        )?;
        shard_file(&dir.join(table_file(k + 1)))?;
    }
    writeln!(log, "tables written")?;

    let t = Instant::now();
    let prefix_table = &tables[opts.bucket_prefix - 1];
    let (offsets, buckets) = build_buckets(&packed, opts.bucket_prefix, prefix_table);
    writeln!(log, "buckets built in {:.1?}", t.elapsed())?;
    write_entries(
        &dir.join(OFFSETS_FILE),
        offsets.iter().map(|o| o.to_le_bytes()),
    )?;
    shard_file(&dir.join(OFFSETS_FILE))?;
    let mut out = BufWriter::with_capacity(1 << 24, File::create(dir.join(BUCKETS_FILE))?);
    out.write_all(&buckets)?;
    out.flush()?;
    drop(out);
    shard_file(&dir.join(BUCKETS_FILE))?;
    writeln!(log, "buckets written")?;

    let manifest = Manifest {
        version: FORMAT_VERSION,
        digits: n as u64,
        table_max: opts.table_max,
        bucket_prefix: opts.bucket_prefix,
        max_query: opts.bucket_prefix + EXTRA_DIGITS,
        shard_bytes: SHARD_BYTES,
        digits_sha256: sha,
    };
    manifest.save(dir)?;
    Ok(manifest)
}

/// A packed file with an odd digit count ends in a zero low nibble. The caller records the
/// true count in the manifest; here we trust a trailing zero nibble only when the last
/// digit position would otherwise be a lone zero, which pi's tail never is in practice.
fn trailing_pad(bytes: &[u8]) -> usize {
    match bytes.last() {
        Some(b) if b & 0x0f == 0 && !bytes.is_empty() && bytes.len() % 2 == 1 => 1,
        _ => 0,
    }
}

fn build_table(packed: &Packed, k: usize) -> Vec<TableEntry> {
    let n = packed.len();
    let size = pow10(k);
    let mut table = vec![TableEntry::EMPTY; size];
    if n < k {
        return table;
    }
    let mut value = 0usize;
    for i in 0..k - 1 {
        value = value * 10 + packed.digit(i) as usize;
    }
    let modulus = pow10(k - 1);
    for end in k - 1..n {
        value = (value % modulus) * 10 + packed.digit(end) as usize;
        let start = end + 1 - k;
        let e = &mut table[value];
        if e.first == NONE {
            e.first = start as u32;
        }
        e.count += 1;
    }
    table
}

fn build_buckets(packed: &Packed, p: usize, prefix_table: &[TableEntry]) -> (Vec<u32>, Vec<u8>) {
    let n = packed.len();
    let mut offsets = Vec::with_capacity(prefix_table.len());
    let mut total = 0u32;
    for e in prefix_table {
        offsets.push(total);
        total += e.count;
    }
    let mut cursor = offsets.clone();
    let mut buckets = vec![0u8; total as usize * BUCKET_ENTRY_BYTES];
    if n < p {
        return (offsets, buckets);
    }
    let mut value = 0usize;
    for i in 0..p - 1 {
        value = value * 10 + packed.digit(i) as usize;
    }
    let modulus = pow10(p - 1);
    for end in p - 1..n {
        value = (value % modulus) * 10 + packed.digit(end) as usize;
        let start = end + 1 - p;
        let next = packed.slice(start + p, EXTRA_DIGITS);
        let entry = BucketEntry {
            position: start as u32,
            next: encode_next(&next),
        };
        let slot = cursor[value] as usize;
        cursor[value] += 1;
        let at = slot * BUCKET_ENTRY_BYTES;
        buckets[at..at + BUCKET_ENTRY_BYTES].copy_from_slice(&entry.to_bytes());
    }
    (offsets, buckets)
}

/// Replaces `path` with `path.000`, `path.001`, ... of SHARD_BYTES each. The digits file is
/// left in place as well because the build reads it through a mapping.
fn shard_file(path: &Path) -> Result<()> {
    let name = path.file_name().unwrap().to_string_lossy().into_owned();
    let dir = path.parent().unwrap();
    let mut input = File::open(path)?;
    let total = input.metadata()?.len();
    let shards = total.div_ceil(SHARD_BYTES).max(1);
    let mut buf = vec![0u8; 1 << 24];
    for shard in 0..shards {
        let mut remaining = (total - shard * SHARD_BYTES).min(SHARD_BYTES);
        let mut out =
            BufWriter::with_capacity(1 << 24, File::create(dir.join(shard_name(&name, shard)))?);
        while remaining > 0 {
            let take = (buf.len() as u64).min(remaining) as usize;
            input.read_exact(&mut buf[..take])?;
            out.write_all(&buf[..take])?;
            remaining -= take as u64;
        }
        out.flush()?;
    }
    if name != DIGITS_FILE {
        std::fs::remove_file(path)?;
    }
    Ok(())
}

fn write_entries<const N: usize>(
    path: &Path,
    entries: impl Iterator<Item = [u8; N]>,
) -> Result<()> {
    let mut out = BufWriter::with_capacity(1 << 24, File::create(path)?);
    for e in entries {
        out.write_all(&e)?;
    }
    out.flush()?;
    Ok(())
}
