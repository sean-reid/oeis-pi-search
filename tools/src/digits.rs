//! Pi digits packed two per byte, first digit in the high nibble.

use anyhow::{bail, Context, Result};
use std::fs::File;
use std::io::{BufReader, BufWriter, Read, Write};
use std::path::Path;

pub const DIGITS_FILE: &str = "digits.bin";

pub struct Packed<'a> {
    bytes: &'a [u8],
    len: usize,
}

impl<'a> Packed<'a> {
    pub fn new(bytes: &'a [u8], len: usize) -> Self {
        assert!(
            bytes.len() >= len.div_ceil(2),
            "packed buffer too short for {len} digits"
        );
        Self { bytes, len }
    }

    pub fn len(&self) -> usize {
        self.len
    }

    pub fn is_empty(&self) -> bool {
        self.len == 0
    }

    #[inline]
    pub fn digit(&self, i: usize) -> u8 {
        debug_assert!(i < self.len);
        let b = self.bytes[i >> 1];
        if i & 1 == 0 {
            b >> 4
        } else {
            b & 0x0f
        }
    }

    pub fn slice(&self, start: usize, len: usize) -> Vec<u8> {
        let end = (start + len).min(self.len);
        (start..end).map(|i| self.digit(i)).collect()
    }
}

pub fn pack_digits(digits: &[u8]) -> Vec<u8> {
    let mut out = vec![0u8; digits.len().div_ceil(2)];
    for (i, &d) in digits.iter().enumerate() {
        debug_assert!(d < 10);
        if i & 1 == 0 {
            out[i >> 1] = d << 4;
        } else {
            out[i >> 1] |= d;
        }
    }
    out
}

/// Reads a text file of pi, skips a leading `3.` if present, ignores whitespace, and
/// writes the fractional digits packed. Returns the number of digits written.
pub fn pack_text_file(src: &Path, dst: &Path, limit: Option<usize>) -> Result<usize> {
    let file = File::open(src).with_context(|| format!("open {}", src.display()))?;
    let mut reader = BufReader::with_capacity(1 << 20, file);
    let out = File::create(dst).with_context(|| format!("create {}", dst.display()))?;
    let mut writer = BufWriter::with_capacity(1 << 20, out);

    let mut buf = vec![0u8; 1 << 20];
    let mut pending: Option<u8> = None;
    let mut count = 0usize;
    let mut seen_prefix = false;
    let mut first_chars = Vec::new();
    let max = limit.unwrap_or(usize::MAX);

    'outer: loop {
        let n = reader.read(&mut buf)?;
        if n == 0 {
            break;
        }
        for &c in &buf[..n] {
            if !seen_prefix {
                first_chars.push(c);
                if first_chars.len() < 2 {
                    continue;
                }
                seen_prefix = true;
                if first_chars == b"3." {
                    continue;
                }
                for &p in &first_chars {
                    if let Some(d) = ascii_digit(p) {
                        count = push(&mut writer, &mut pending, d, count)?;
                        if count >= max {
                            break 'outer;
                        }
                    } else if !p.is_ascii_whitespace() {
                        bail!("unexpected byte {p:#x} at start of {}", src.display());
                    }
                }
                continue;
            }
            if let Some(d) = ascii_digit(c) {
                count = push(&mut writer, &mut pending, d, count)?;
                if count >= max {
                    break 'outer;
                }
            } else if !c.is_ascii_whitespace() {
                bail!(
                    "unexpected byte {c:#x} after {count} digits in {}",
                    src.display()
                );
            }
        }
    }
    if let Some(d) = pending {
        writer.write_all(&[d << 4])?;
    }
    writer.flush()?;
    Ok(count)
}

fn ascii_digit(c: u8) -> Option<u8> {
    c.is_ascii_digit().then(|| c - b'0')
}

fn push<W: Write>(w: &mut W, pending: &mut Option<u8>, d: u8, count: usize) -> Result<usize> {
    match pending.take() {
        None => *pending = Some(d),
        Some(hi) => w.write_all(&[(hi << 4) | d])?,
    }
    Ok(count + 1)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn packs_and_unpacks() {
        let digits = [1u8, 4, 1, 5, 9, 2, 6];
        let packed = pack_digits(&digits);
        assert_eq!(packed, vec![0x14, 0x15, 0x92, 0x60]);
        let p = Packed::new(&packed, digits.len());
        for (i, &d) in digits.iter().enumerate() {
            assert_eq!(p.digit(i), d);
        }
        assert_eq!(p.slice(5, 10), vec![2, 6]);
    }

    #[test]
    fn packs_text_with_prefix_and_whitespace() {
        let dir = tempfile::tempdir().unwrap();
        let src = dir.path().join("pi.txt");
        let dst = dir.path().join(DIGITS_FILE);
        std::fs::write(&src, "3.14159\n26535\n").unwrap();
        let n = pack_text_file(&src, &dst, None).unwrap();
        assert_eq!(n, 10);
        let bytes = std::fs::read(&dst).unwrap();
        assert_eq!(bytes, vec![0x14, 0x15, 0x92, 0x65, 0x35]);
    }

    #[test]
    fn packs_text_without_prefix_and_honours_limit() {
        let dir = tempfile::tempdir().unwrap();
        let src = dir.path().join("pi.txt");
        let dst = dir.path().join(DIGITS_FILE);
        std::fs::write(&src, "1415926535").unwrap();
        let n = pack_text_file(&src, &dst, Some(3)).unwrap();
        assert_eq!(n, 3);
        assert_eq!(std::fs::read(&dst).unwrap(), vec![0x14, 0x10]);
    }
}
