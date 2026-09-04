//! The committed fixture under src/lib/index/fixtures is what the TypeScript reader is
//! tested against. Rebuilding it here and comparing bytes keeps writer and fixture in step.

use pisearch::build::{build, BuildOptions};
use pisearch::digits::DIGITS_FILE;
use pisearch::format::{shard_name, Manifest, BUCKETS_FILE, MANIFEST_FILE, OFFSETS_FILE};
use std::path::PathBuf;

fn fixture_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../src/lib/index/fixtures")
}

#[test]
fn committed_fixture_matches_the_writer() {
    let src = fixture_dir();
    let manifest = Manifest::load(&src).unwrap();
    let dir = tempfile::tempdir().unwrap();
    std::fs::copy(
        src.join(shard_name(DIGITS_FILE, 0)),
        dir.path().join(DIGITS_FILE),
    )
    .unwrap();
    let opts = BuildOptions {
        table_max: manifest.table_max,
        bucket_prefix: manifest.bucket_prefix,
    };
    let rebuilt = build(dir.path(), &opts, &mut std::io::sink()).unwrap();
    assert_eq!(rebuilt, manifest);

    let mut names: Vec<String> = (1..=manifest.table_max)
        .map(|k| shard_name(&pisearch::format::table_file(k), 0))
        .collect();
    names.push(shard_name(OFFSETS_FILE, 0));
    names.push(shard_name(BUCKETS_FILE, 0));
    names.push(shard_name(DIGITS_FILE, 0));
    names.push(MANIFEST_FILE.into());
    for name in names {
        let a = std::fs::read(src.join(&name)).unwrap();
        let b = std::fs::read(dir.path().join(&name)).unwrap();
        assert!(a == b, "{name} differs from the committed fixture");
    }
}
