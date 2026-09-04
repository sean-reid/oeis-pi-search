//! e2e/fixtures/seed.sql is generated from the sample dumps against the committed index fixture.
//! Regenerating it here keeps the seed and the writer in step.

use pisearch::lookup::Index;
use pisearch::oeis::{parse_names, parse_stripped, write_sql};
use std::io::BufReader;
use std::path::PathBuf;

fn root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..")
}

#[test]
fn committed_seed_matches_the_writer() {
    let index = Index::open(&root().join("src/lib/index/fixtures")).unwrap();
    let fixtures = root().join("e2e/fixtures");
    let names = parse_names(BufReader::new(
        std::fs::File::open(fixtures.join("oeis-sample-names.txt")).unwrap(),
    ))
    .unwrap();
    let sequences = parse_stripped(
        BufReader::new(std::fs::File::open(fixtures.join("oeis-sample-stripped.txt")).unwrap()),
        &names,
    )
    .unwrap();
    let mut out = Vec::new();
    write_sql(&index, &sequences, "2026-09-04", &mut out).unwrap();
    let committed = std::fs::read(fixtures.join("seed.sql")).unwrap();
    assert!(
        out == committed,
        "e2e/fixtures/seed.sql differs from what the writer produces"
    );
}
