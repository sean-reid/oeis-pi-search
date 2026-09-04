//! Reference reader. The Worker implements the same steps against R2 range reads, so any
//! change here changes the Worker too.

use crate::digits::DIGITS_FILE;
use crate::format::*;
use anyhow::{bail, Context, Result};
use std::fs::File;
use std::os::unix::fs::FileExt;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Hit {
    /// Zero-based offset of the first occurrence, if any.
    pub first: Option<u64>,
    pub count: u64,
}

pub struct Index {
    dir: PathBuf,
    pub manifest: Manifest,
}

impl Index {
    pub fn open(dir: &Path) -> Result<Self> {
        let manifest = Manifest::load(dir)?;
        if manifest.version != FORMAT_VERSION {
            bail!("index version {} is not {FORMAT_VERSION}", manifest.version);
        }
        Ok(Self {
            dir: dir.to_path_buf(),
            manifest,
        })
    }

    fn read_range(&self, file: &str, offset: u64, len: usize) -> Result<Vec<u8>> {
        let mut buf = Vec::with_capacity(len);
        for (shard, within, take) in shard_ranges(offset, len, self.manifest.shard_bytes) {
            let name = shard_name(file, shard);
            let path = self.dir.join(&name);
            let f = File::open(&path).with_context(|| format!("open {}", path.display()))?;
            let start = buf.len();
            buf.resize(start + take, 0);
            f.read_exact_at(&mut buf[start..], within)
                .with_context(|| format!("read {name}@{within}+{take}"))?;
        }
        Ok(buf)
    }

    fn table_entry(&self, digits: &[u8]) -> Result<TableEntry> {
        let idx = digits_to_index(digits) as u64;
        let bytes = self.read_range(
            &table_file(digits.len()),
            idx * TABLE_ENTRY_BYTES as u64,
            TABLE_ENTRY_BYTES,
        )?;
        Ok(TableEntry::from_bytes(&bytes))
    }

    pub fn lookup(&self, digits: &[u8]) -> Result<Hit> {
        let m = &self.manifest;
        if digits.is_empty() || digits.len() > m.max_query {
            bail!("query length must be 1..={}", m.max_query);
        }
        if digits.iter().any(|&d| d > 9) {
            bail!("query must be decimal digits");
        }
        if digits.len() <= m.table_max {
            let e = self.table_entry(digits)?;
            return Ok(Hit {
                first: (e.first != NONE).then_some(e.first as u64),
                count: e.count as u64,
            });
        }
        let (prefix, rest) = digits.split_at(m.bucket_prefix);
        let e = self.table_entry(prefix)?;
        if e.count == 0 {
            return Ok(Hit {
                first: None,
                count: 0,
            });
        }
        let idx = digits_to_index(prefix) as u64;
        let off = u32::from_le_bytes(
            self.read_range(OFFSETS_FILE, idx * 4, 4)?[..]
                .try_into()
                .unwrap(),
        );
        let bytes = self.read_range(
            BUCKETS_FILE,
            off as u64 * BUCKET_ENTRY_BYTES as u64,
            e.count as usize * BUCKET_ENTRY_BYTES,
        )?;
        let mut first = None;
        let mut count = 0u64;
        for chunk in bytes.as_chunks::<BUCKET_ENTRY_BYTES>().0 {
            let b = BucketEntry::from_bytes(chunk);
            if next_matches(b.next, rest) {
                count += 1;
                if first.is_none() {
                    first = Some(b.position as u64);
                }
            }
        }
        Ok(Hit { first, count })
    }

    /// Digits at a zero-based offset, clipped to the end of the expansion.
    pub fn digits_at(&self, start: u64, len: usize) -> Result<Vec<u8>> {
        let n = self.manifest.digits;
        if start >= n {
            return Ok(Vec::new());
        }
        let end = (start + len as u64).min(n);
        let byte_start = start / 2;
        let byte_end = end.div_ceil(2);
        let bytes = self.read_range(DIGITS_FILE, byte_start, (byte_end - byte_start) as usize)?;
        let mut out = Vec::with_capacity((end - start) as usize);
        for i in start..end {
            let b = bytes[(i / 2 - byte_start) as usize];
            out.push(if i % 2 == 0 { b >> 4 } else { b & 0x0f });
        }
        Ok(out)
    }
}
