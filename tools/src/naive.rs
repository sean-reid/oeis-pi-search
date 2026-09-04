//! Brute force scan, the oracle the index is tested against.

use crate::lookup::Hit;

pub fn scan(haystack: &[u8], needle: &[u8]) -> Hit {
    let mut first = None;
    let mut count = 0u64;
    if needle.is_empty() || needle.len() > haystack.len() {
        return Hit { first, count };
    }
    for (i, w) in haystack.windows(needle.len()).enumerate() {
        if w == needle {
            count += 1;
            if first.is_none() {
                first = Some(i as u64);
            }
        }
    }
    Hit { first, count }
}
