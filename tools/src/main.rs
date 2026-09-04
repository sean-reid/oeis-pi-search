use anyhow::{bail, Result};
use clap::{Parser, Subcommand};
use pisearch::build::{build, BuildOptions};
use pisearch::digits::{pack_text_file, DIGITS_FILE};
use pisearch::format::parse_digits;
use pisearch::lookup::Index;
use std::path::PathBuf;

#[derive(Parser)]
#[command(name = "pisearch", about = "Build and query the pi digit index")]
struct Cli {
    #[command(subcommand)]
    cmd: Cmd,
}

#[derive(Subcommand)]
enum Cmd {
    /// Pack a text file of pi digits into <dir>/digits.bin.
    Pack {
        source: PathBuf,
        dir: PathBuf,
        /// Keep only the first N digits after the decimal point.
        #[arg(long)]
        limit: Option<usize>,
    },
    /// Build tables and buckets next to <dir>/digits.bin.
    Build {
        dir: PathBuf,
        #[arg(long, default_value_t = 8)]
        table_max: usize,
        #[arg(long, default_value_t = 8)]
        bucket_prefix: usize,
    },
    /// Look up digit strings; positions print one-based.
    Lookup { dir: PathBuf, digits: Vec<String> },
    /// Print digits starting at a one-based position.
    Digits {
        dir: PathBuf,
        start: u64,
        len: usize,
    },
}

fn main() -> Result<()> {
    match Cli::parse().cmd {
        Cmd::Pack { source, dir, limit } => {
            std::fs::create_dir_all(&dir)?;
            let n = pack_text_file(&source, &dir.join(DIGITS_FILE), limit)?;
            println!("{n}");
        }
        Cmd::Build {
            dir,
            table_max,
            bucket_prefix,
        } => {
            let opts = BuildOptions {
                table_max,
                bucket_prefix,
            };
            let m = build(&dir, &opts, &mut std::io::stderr())?;
            println!("{}", serde_json::to_string(&m)?);
        }
        Cmd::Lookup { dir, digits } => {
            let index = Index::open(&dir)?;
            for q in digits {
                let Some(d) = parse_digits(&q) else {
                    bail!("{q} is not a digit string")
                };
                let hit = index.lookup(&d)?;
                println!(
                    "{}",
                    serde_json::json!({
                        "digits": q,
                        "first": hit.first.map(|p| p + 1),
                        "count": hit.count,
                    })
                );
            }
        }
        Cmd::Digits { dir, start, len } => {
            if start == 0 {
                bail!("positions are one-based");
            }
            let index = Index::open(&dir)?;
            let d = index.digits_at(start - 1, len)?;
            println!(
                "{}",
                d.iter().map(|d| (b'0' + d) as char).collect::<String>()
            );
        }
    }
    Ok(())
}
