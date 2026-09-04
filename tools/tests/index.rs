use pisearch::build::{build, BuildOptions};
use pisearch::digits::{pack_digits, DIGITS_FILE};
use pisearch::lookup::{Hit, Index};
use pisearch::naive::scan;

fn pseudo_digits(n: usize, seed: u64) -> Vec<u8> {
    let mut x = seed;
    (0..n)
        .map(|_| {
            x = x
                .wrapping_mul(6364136223846793005)
                .wrapping_add(1442695040888963407);
            ((x >> 33) % 10) as u8
        })
        .collect()
}

fn build_fixture(
    digits: &[u8],
    table_max: usize,
    bucket_prefix: usize,
) -> (tempfile::TempDir, Index) {
    let dir = tempfile::tempdir().unwrap();
    std::fs::write(dir.path().join(DIGITS_FILE), pack_digits(digits)).unwrap();
    let opts = BuildOptions {
        table_max,
        bucket_prefix,
    };
    build(dir.path(), &opts, &mut std::io::sink()).unwrap();
    let index = Index::open(dir.path()).unwrap();
    (dir, index)
}

#[test]
fn lookup_agrees_with_scan_for_every_query_length() {
    for &n in &[20_001usize, 20_000] {
        let digits = pseudo_digits(n, 7 + n as u64);
        let (_dir, index) = build_fixture(&digits, 3, 3);
        assert_eq!(index.manifest.digits as usize, n);
        assert_eq!(index.manifest.max_query, 7);
        let mut x = 99u64;
        for _ in 0..3000 {
            x = x.wrapping_mul(2862933555777941757).wrapping_add(3037000493);
            let len = 1 + (x % 7) as usize;
            let start = ((x >> 8) % n as u64) as usize;
            let needle: Vec<u8> = if x.is_multiple_of(5) {
                pseudo_digits(len, x)
            } else {
                digits[start..(start + len).min(n)].to_vec()
            };
            if needle.is_empty() {
                continue;
            }
            let expected = scan(&digits, &needle);
            let got = index.lookup(&needle).unwrap();
            assert_eq!(got, expected, "needle {needle:?}");
        }
    }
}

#[test]
fn tail_positions_with_partial_next_digits_are_found() {
    let digits = pseudo_digits(5000, 1);
    let (_dir, index) = build_fixture(&digits, 2, 2);
    let n = digits.len();
    for len in 3..=6 {
        let needle = &digits[n - len..];
        let got = index.lookup(needle).unwrap();
        assert_eq!(got, scan(&digits, needle));
        assert!(got.count >= 1);
    }
}

#[test]
fn digits_at_clips_to_the_end() {
    let digits = pseudo_digits(101, 3);
    let (_dir, index) = build_fixture(&digits, 1, 1);
    assert_eq!(index.digits_at(0, 5).unwrap(), digits[..5]);
    assert_eq!(index.digits_at(98, 10).unwrap(), digits[98..]);
    assert!(index.digits_at(101, 10).unwrap().is_empty());
    assert_eq!(index.digits_at(3, 4).unwrap(), digits[3..7]);
}

#[test]
fn absent_strings_report_zero() {
    let digits: Vec<u8> = vec![1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2];
    let (_dir, index) = build_fixture(&digits, 2, 2);
    assert_eq!(
        index.lookup(&[9, 9]).unwrap(),
        Hit {
            first: None,
            count: 0
        }
    );
    assert_eq!(
        index.lookup(&[1, 2, 3, 4, 5, 7]).unwrap(),
        Hit {
            first: None,
            count: 0
        }
    );
    assert_eq!(
        index.lookup(&[1, 2]).unwrap(),
        Hit {
            first: Some(0),
            count: 2
        }
    );
    assert_eq!(
        index.lookup(&[1, 2, 3, 4, 5, 6]).unwrap(),
        Hit {
            first: Some(0),
            count: 1
        }
    );
    assert!(index.lookup(&[1, 2, 3, 4, 5, 6, 7]).is_err());
}
