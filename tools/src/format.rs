//! On-disk layout shared with the Worker's reader. Every number is little endian.
//!
//! - `digits.bin`: pi after the decimal point, two digits per byte, high nibble first.
//! - `table{k}.bin` for k in 1..=table_max: 10^k entries of `TableEntry` indexed by the
//!   k-digit string read as an integer.
//! - `offsets.bin`: 10^bucket_prefix entries of u32, the start of each bucket in `buckets.bin`.
//! - `buckets.bin`: one `BucketEntry` per position that starts a full bucket_prefix-digit
//!   string, grouped by that prefix and ordered by position within a group.
//! - `index.json`: the `Manifest`.
//!
//! Every file is stored as fixed size shards named `{file}.{000}`, `{file}.{001}`, ... so no
//! single object exceeds what the upload tooling accepts. A range read that crosses a shard
//! boundary reads two shards. SHARD_BYTES is a multiple of every entry size.

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::path::Path;

pub const MANIFEST_FILE: &str = "index.json";
pub const OFFSETS_FILE: &str = "offsets.bin";
pub const BUCKETS_FILE: &str = "buckets.bin";
pub const FORMAT_VERSION: u32 = 1;
pub const NONE: u32 = u32::MAX;
pub const TABLE_ENTRY_BYTES: usize = 8;
pub const BUCKET_ENTRY_BYTES: usize = 6;
/// Digits stored past the bucket prefix, so the longest query is bucket_prefix + EXTRA_DIGITS.
pub const EXTRA_DIGITS: usize = 4;
pub const SHARD_BYTES: u64 = 240 * 1024 * 1024;

pub fn shard_name(file: &str, shard: u64) -> String {
    format!("{file}.{shard:03}")
}

/// Splits a byte range into (shard, offset within shard, length) pieces.
pub fn shard_ranges(offset: u64, len: usize, shard_bytes: u64) -> Vec<(u64, u64, usize)> {
    let mut out = Vec::with_capacity(2);
    let mut offset = offset;
    let mut remaining = len;
    while remaining > 0 {
        let shard = offset / shard_bytes;
        let within = offset % shard_bytes;
        let take = ((shard_bytes - within) as usize).min(remaining);
        out.push((shard, within, take));
        offset += take as u64;
        remaining -= take;
    }
    out
}

pub fn table_file(k: usize) -> String {
    format!("table{k}.bin")
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Manifest {
    pub version: u32,
    pub digits: u64,
    pub table_max: usize,
    pub bucket_prefix: usize,
    pub max_query: usize,
    pub shard_bytes: u64,
    pub digits_sha256: String,
}

impl Manifest {
    pub fn load(dir: &Path) -> Result<Self> {
        let path = dir.join(MANIFEST_FILE);
        let text =
            std::fs::read_to_string(&path).with_context(|| format!("read {}", path.display()))?;
        Ok(serde_json::from_str(&text)?)
    }

    pub fn save(&self, dir: &Path) -> Result<()> {
        let mut text = serde_json::to_string_pretty(self)?;
        text.push('\n');
        std::fs::write(dir.join(MANIFEST_FILE), text)?;
        Ok(())
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct TableEntry {
    pub first: u32,
    pub count: u32,
}

impl TableEntry {
    pub const EMPTY: Self = Self {
        first: NONE,
        count: 0,
    };

    pub fn to_bytes(self) -> [u8; TABLE_ENTRY_BYTES] {
        let mut b = [0u8; TABLE_ENTRY_BYTES];
        b[..4].copy_from_slice(&self.first.to_le_bytes());
        b[4..].copy_from_slice(&self.count.to_le_bytes());
        b
    }

    pub fn from_bytes(b: &[u8]) -> Self {
        Self {
            first: u32::from_le_bytes(b[..4].try_into().unwrap()),
            count: u32::from_le_bytes(b[4..8].try_into().unwrap()),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct BucketEntry {
    pub position: u32,
    pub next: u16,
}

impl BucketEntry {
    pub fn to_bytes(self) -> [u8; BUCKET_ENTRY_BYTES] {
        let mut b = [0u8; BUCKET_ENTRY_BYTES];
        b[..4].copy_from_slice(&self.position.to_le_bytes());
        b[4..].copy_from_slice(&self.next.to_le_bytes());
        b
    }

    pub fn from_bytes(b: &[u8]) -> Self {
        Self {
            position: u32::from_le_bytes(b[..4].try_into().unwrap()),
            next: u16::from_le_bytes(b[4..6].try_into().unwrap()),
        }
    }
}

/// Encodes up to EXTRA_DIGITS digits following a prefix, plus how many were available:
/// four digits map to 0..9999, three to 10000..10999, two to 11000..11099, one to
/// 11100..11109, none to 11110.
pub fn encode_next(digits: &[u8]) -> u16 {
    debug_assert!(digits.len() <= EXTRA_DIGITS);
    let mut v: u16 = 0;
    for &d in digits {
        v = v * 10 + d as u16;
    }
    let base: u16 = match digits.len() {
        4 => 0,
        3 => 10000,
        2 => 11000,
        1 => 11100,
        _ => 11110,
    };
    base + v
}

/// Returns the available digit count and the digits, left aligned.
pub fn decode_next(v: u16) -> (usize, [u8; EXTRA_DIGITS]) {
    let (avail, mut rest) = if v < 10000 {
        (4, v)
    } else if v < 11000 {
        (3, v - 10000)
    } else if v < 11100 {
        (2, v - 11000)
    } else if v < 11110 {
        (1, v - 11100)
    } else {
        (0, 0)
    };
    let mut out = [0u8; EXTRA_DIGITS];
    for i in (0..avail).rev() {
        out[i] = (rest % 10) as u8;
        rest /= 10;
    }
    (avail, out)
}

pub fn next_matches(encoded: u16, query: &[u8]) -> bool {
    let (avail, digits) = decode_next(encoded);
    query.len() <= avail && digits[..query.len()] == *query
}

pub fn pow10(k: usize) -> usize {
    10usize.pow(k as u32)
}

pub fn parse_digits(s: &str) -> Option<Vec<u8>> {
    s.bytes()
        .map(|c| c.is_ascii_digit().then_some(c - b'0'))
        .collect()
}

pub fn digits_to_index(digits: &[u8]) -> usize {
    digits.iter().fold(0usize, |acc, &d| acc * 10 + d as usize)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn next_round_trips_every_length() {
        for (digits, avail) in [
            (vec![0, 0, 0, 0], 4),
            (vec![9, 9, 9, 9], 4),
            (vec![1, 2, 3, 4], 4),
            (vec![0, 0, 7], 3),
            (vec![4, 2], 2),
            (vec![0], 1),
            (vec![], 0),
        ] {
            let e = encode_next(&digits);
            let (a, d) = decode_next(e);
            assert_eq!(a, avail);
            assert_eq!(&d[..avail], &digits[..]);
        }
    }

    #[test]
    fn next_matches_respects_availability() {
        let e = encode_next(&[1, 2]);
        assert!(next_matches(e, &[1]));
        assert!(next_matches(e, &[1, 2]));
        assert!(!next_matches(e, &[1, 2, 0]));
        assert!(!next_matches(e, &[2]));
        assert!(next_matches(e, &[]));
    }

    #[test]
    fn shard_ranges_split_at_boundaries() {
        assert_eq!(shard_ranges(0, 8, 100), vec![(0, 0, 8)]);
        assert_eq!(shard_ranges(96, 8, 100), vec![(0, 96, 4), (1, 0, 4)]);
        assert_eq!(shard_ranges(200, 10, 100), vec![(2, 0, 10)]);
        assert!(shard_ranges(5, 0, 100).is_empty());
        assert_eq!(SHARD_BYTES % TABLE_ENTRY_BYTES as u64, 0);
        assert_eq!(SHARD_BYTES % BUCKET_ENTRY_BYTES as u64, 0);
    }

    #[test]
    fn entries_round_trip() {
        let t = TableEntry {
            first: 12345,
            count: 7,
        };
        assert_eq!(TableEntry::from_bytes(&t.to_bytes()), t);
        let b = BucketEntry {
            position: 999_999_999,
            next: 11110,
        };
        assert_eq!(BucketEntry::from_bytes(&b.to_bytes()), b);
    }
}
