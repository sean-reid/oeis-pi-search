//! Turns the OEIS `stripped` and `names` dumps into SQL for D1, with every sequence's
//! staircase computed against the local index.

use crate::format::parse_digits;
use crate::lookup::Index;
use crate::piapprox;
use anyhow::{bail, Context, Result};
use flate2::read::MultiGzDecoder;
use rayon::prelude::*;
use serde::Serialize;
use std::collections::HashMap;
use std::fs::File;
use std::io::{BufRead, BufReader, Read, Write};
use std::path::Path;

/// Terms kept for display; the staircase never needs more than max_query of them.
pub const DISPLAY_TERMS: usize = 30;
const ROWS_PER_INSERT: usize = 40;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct Row {
    /// Number of leading terms concatenated.
    pub k: usize,
    pub digits: String,
    /// One-based position, or None when absent.
    pub first: Option<u64>,
    pub count: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Sequence {
    pub anumber: String,
    pub name: String,
    pub terms: Vec<String>,
}

/// Concatenates leading terms, dropping minus signs, until the next term would push the
/// string past `max_digits`. Returns one digit string per prefix length.
pub fn prefixes(terms: &[String], max_digits: usize) -> Vec<String> {
    let mut out = Vec::new();
    let mut s = String::new();
    for t in terms {
        s.push_str(t.trim_start_matches('-'));
        if s.len() > max_digits {
            break;
        }
        out.push(s.clone());
    }
    out
}

pub fn staircase(index: &Index, terms: &[String]) -> Result<Vec<Row>> {
    let mut rows = Vec::new();
    for (i, digits) in prefixes(terms, index.manifest.max_query)
        .into_iter()
        .enumerate()
    {
        let Some(d) = parse_digits(&digits) else {
            bail!("non digit term in {terms:?}")
        };
        let hit = index.lookup(&d)?;
        rows.push(Row {
            k: i + 1,
            digits,
            first: hit.first.map(|p| p + 1),
            count: hit.count,
        });
    }
    Ok(rows)
}

fn open_maybe_gz(path: &Path) -> Result<Box<dyn BufRead>> {
    let file = File::open(path).with_context(|| format!("open {}", path.display()))?;
    let reader: Box<dyn Read> = if path.extension().is_some_and(|e| e == "gz") {
        Box::new(MultiGzDecoder::new(file))
    } else {
        Box::new(file)
    };
    Ok(Box::new(BufReader::with_capacity(1 << 20, reader)))
}

pub fn parse_names(reader: impl BufRead) -> Result<HashMap<String, String>> {
    let mut names = HashMap::new();
    for line in reader.lines() {
        let line = line?;
        if line.starts_with('#') || line.is_empty() {
            continue;
        }
        let (a, name) = line.split_once(' ').unwrap_or((&line, ""));
        names.insert(a.to_string(), name.trim().to_string());
    }
    Ok(names)
}

pub fn parse_stripped(
    reader: impl BufRead,
    names: &HashMap<String, String>,
) -> Result<Vec<Sequence>> {
    let mut out = Vec::new();
    for line in reader.lines() {
        let line = line?;
        if line.starts_with('#') || line.is_empty() {
            continue;
        }
        let Some((a, terms)) = line.split_once(' ') else {
            continue;
        };
        let terms: Vec<String> = terms
            .split(',')
            .filter(|t| !t.is_empty())
            .map(str::to_string)
            .collect();
        if terms.is_empty() {
            continue;
        }
        out.push(Sequence {
            anumber: a.to_string(),
            name: names.get(a).cloned().unwrap_or_default(),
            terms,
        });
    }
    Ok(out)
}

/// Sequences defined in terms of pi, and decimal expansions of constants generally, make
/// trivial approximations: many constants are pi or a rational multiple of it under another name.
pub fn trivially_pi(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    lower.contains("decimal expansion")
        || lower.contains("decimal digits")
        || lower
            .split(|c: char| !c.is_alphanumeric())
            .any(|w| w == "pi")
}

pub const SCHEMA: &str = "\
DROP TABLE IF EXISTS sequences;
DROP TABLE IF EXISTS names_fts;
DROP TABLE IF EXISTS meta;
CREATE TABLE sequences (
  anumber TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  terms TEXT NOT NULL,
  staircase TEXT NOT NULL,
  rows INTEGER NOT NULL,
  depth INTEGER NOT NULL,
  depth_digits INTEGER NOT NULL,
  depth_first INTEGER,
  first3 INTEGER,
  digits3 INTEGER,
  first8 INTEGER,
  has_negative INTEGER NOT NULL,
  pi_digits REAL,
  pi_expr TEXT,
  pi_value REAL,
  pi_score REAL
);
CREATE INDEX sequences_deepest ON sequences (depth DESC, depth_digits DESC, depth_first ASC);
CREATE INDEX sequences_earliest ON sequences (first8 ASC) WHERE first8 IS NOT NULL;
CREATE INDEX sequences_rarest ON sequences (digits3 ASC) WHERE first3 IS NULL AND digits3 IS NOT NULL;
CREATE INDEX sequences_pi ON sequences (pi_score DESC) WHERE pi_score IS NOT NULL;
CREATE VIRTUAL TABLE names_fts USING fts5(anumber UNINDEXED, name, tokenize='unicode61');
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
";

fn sql_str(s: &str) -> String {
    let mut out = String::with_capacity(s.len() + 2);
    out.push('\'');
    for c in s.chars() {
        if c == '\'' {
            out.push('\'');
        }
        out.push(c);
    }
    out.push('\'');
    out
}

fn sql_opt(v: Option<u64>) -> String {
    v.map_or_else(|| "NULL".to_string(), |v| v.to_string())
}

pub struct Summary {
    pub sequences: usize,
}

pub fn write_sql(
    index: &Index,
    sequences: &[Sequence],
    snapshot: &str,
    out: &mut dyn Write,
) -> Result<Summary> {
    out.write_all(SCHEMA.as_bytes())?;
    let mut buffered = Vec::with_capacity(ROWS_PER_INSERT);
    let flush = |buf: &mut Vec<(String, String)>, out: &mut dyn Write| -> Result<()> {
        if buf.is_empty() {
            return Ok(());
        }
        writeln!(
            out,
            "INSERT INTO sequences (anumber, name, terms, staircase, rows, depth, depth_digits, depth_first, first3, digits3, first8, has_negative, pi_digits, pi_expr, pi_value, pi_score) VALUES"
        )?;
        let values: Vec<&str> = buf.iter().map(|(v, _)| v.as_str()).collect();
        writeln!(out, "{};", values.join(",\n"))?;
        writeln!(out, "INSERT INTO names_fts (anumber, name) VALUES")?;
        let names: Vec<&str> = buf.iter().map(|(_, n)| n.as_str()).collect();
        writeln!(out, "{};", names.join(",\n"))?;
        buf.clear();
        Ok(())
    };
    let approximations: Vec<Option<piapprox::Approximation>> = sequences
        .par_iter()
        .map(|seq| {
            if trivially_pi(&seq.name) {
                None
            } else {
                piapprox::best(&prefixes(&seq.terms, index.manifest.max_query))
            }
        })
        .collect();
    for (seq, approx) in sequences.iter().zip(&approximations) {
        let rows = staircase(index, &seq.terms)?;
        let found: Vec<&Row> = rows.iter().filter(|r| r.first.is_some()).collect();
        let deepest = found.last();
        let row_at = |k: usize| rows.iter().find(|r| r.k == k);
        let terms: Vec<&str> = seq
            .terms
            .iter()
            .take(DISPLAY_TERMS)
            .map(String::as_str)
            .collect();
        let value = format!(
            "({}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {})",
            sql_str(&seq.anumber),
            sql_str(&seq.name),
            sql_str(&terms.join(",")),
            sql_str(&serde_json::to_string(&rows)?),
            rows.len(),
            deepest.map_or(0, |r| r.k),
            deepest.map_or(0, |r| r.digits.len()),
            sql_opt(deepest.and_then(|r| r.first)),
            sql_opt(row_at(3).and_then(|r| r.first)),
            sql_opt(row_at(3).map(|r| r.digits.len() as u64)),
            sql_opt(row_at(8).and_then(|r| r.first)),
            u8::from(seq.terms.iter().any(|t| t.starts_with('-'))),
            approx
                .as_ref()
                .map_or("NULL".to_string(), |a| format!("{:.2}", a.digits)),
            approx
                .as_ref()
                .map_or("NULL".to_string(), |a| sql_str(&piapprox::render(a))),
            approx
                .as_ref()
                .map_or("NULL".to_string(), |a| format!("{:.10}", a.value)),
            approx
                .as_ref()
                .map_or("NULL".to_string(), |a| format!("{:.2}", a.score())),
        );
        let name = format!("({}, {})", sql_str(&seq.anumber), sql_str(&seq.name));
        buffered.push((value, name));
        if buffered.len() == ROWS_PER_INSERT {
            flush(&mut buffered, out)?;
        }
    }
    flush(&mut buffered, out)?;
    writeln!(
        out,
        "INSERT INTO meta (key, value) VALUES ('snapshot', {}), ('digits', '{}'), ('maxQuery', '{}'), ('sequences', '{}');",
        sql_str(snapshot),
        index.manifest.digits,
        index.manifest.max_query,
        sequences.len()
    )?;
    Ok(Summary {
        sequences: sequences.len(),
    })
}

pub fn run(
    stripped: &Path,
    names: &Path,
    index_dir: &Path,
    out: &Path,
    snapshot: &str,
) -> Result<Summary> {
    let index = Index::open(index_dir)?;
    let names = parse_names(open_maybe_gz(names)?)?;
    let sequences = parse_stripped(open_maybe_gz(stripped)?, &names)?;
    let file = File::create(out).with_context(|| format!("create {}", out.display()))?;
    let mut writer = std::io::BufWriter::with_capacity(1 << 24, file);
    let summary = write_sql(&index, &sequences, snapshot, &mut writer)?;
    writer.flush()?;
    Ok(summary)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn s(v: &[&str]) -> Vec<String> {
        v.iter().map(|t| t.to_string()).collect()
    }

    #[test]
    fn prefixes_stop_at_the_digit_cap_and_drop_signs() {
        assert_eq!(
            prefixes(&s(&["0", "1", "1", "2"]), 12),
            s(&["0", "01", "011", "0112"])
        );
        assert_eq!(prefixes(&s(&["1", "-1", "2"]), 12), s(&["1", "11", "112"]));
        assert_eq!(
            prefixes(&s(&["123", "4567", "89012", "3"]), 12),
            s(&["123", "1234567", "123456789012"])
        );
        assert!(prefixes(&s(&["1234567890123"]), 12).is_empty());
    }

    #[test]
    fn parses_dumps_and_joins_names() {
        let names = parse_names(
            "# c\nA000001 Number of groups of order n.\nA000002 Kolakoski's\n".as_bytes(),
        )
        .unwrap();
        let seqs = parse_stripped(
            "# c\nA000001 ,0,1,1,1,2,\nA000002 ,1,2,2,\nA000003 ,\n".as_bytes(),
            &names,
        )
        .unwrap();
        assert_eq!(seqs.len(), 2);
        assert_eq!(seqs[0].terms, s(&["0", "1", "1", "1", "2"]));
        assert_eq!(seqs[1].name, "Kolakoski's");
    }

    #[test]
    fn detects_trivial_names() {
        assert!(trivially_pi("Decimal expansion of Pi."));
        assert!(trivially_pi("Continued fraction for pi"));
        assert!(trivially_pi("Decimal expansion of arctan(10^50)."));
        assert!(trivially_pi("Decimal digits of the golden ratio"));
        assert!(!trivially_pi("Number of pieces of pizza"));
        assert!(!trivially_pi("Fibonacci numbers"));
    }

    #[test]
    fn escapes_quotes() {
        assert_eq!(sql_str("1's and 2's"), "'1''s and 2''s'");
    }
}
