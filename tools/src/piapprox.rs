//! Finds the expression closest to pi built from N, the number formed by the first k terms of a
//! sequence written out as digits: an operation on N (identity, powers, roots, ln, log10, exp),
//! times or over a small integer C, shifted by a power of ten, optionally added to 1, 2, or 3 or
//! subtracted from 4.

use std::f64::consts::PI;

pub const MAX_C: u32 = 30;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Op {
    Identity,
    Square,
    Cube,
    Inverse,
    InverseSquare,
    Sqrt,
    Cbrt,
    FourthRoot,
    Ln,
    Log10,
    Exp,
}

impl Op {
    pub const ALL: [Op; 11] = [
        Op::Identity,
        Op::Square,
        Op::Cube,
        Op::Inverse,
        Op::InverseSquare,
        Op::Sqrt,
        Op::Cbrt,
        Op::FourthRoot,
        Op::Ln,
        Op::Log10,
        Op::Exp,
    ];

    /// Logs and exp act on N scaled into a range where the result is near pi:
    /// ln wants its argument near e^pi (23.14), log10 near 10^pi (1385), exp near pi's own
    /// size, so the argument is scaled into [1, 10). Returns (value, inner power of ten).
    fn apply(self, n: f64) -> (f64, i32) {
        match self {
            Op::Identity => (n, 0),
            Op::Square => (n * n, 0),
            Op::Cube => (n * n * n, 0),
            Op::Inverse => (1.0 / n, 0),
            Op::InverseSquare => (1.0 / (n * n), 0),
            Op::Sqrt => (n.sqrt(), 0),
            Op::Cbrt => (n.cbrt(), 0),
            Op::FourthRoot => (n.sqrt().sqrt(), 0),
            Op::Ln => {
                let (x, j) = scale_into(n, 10.0);
                (x.ln(), j)
            }
            Op::Log10 => {
                let (x, j) = scale_into(n, 1000.0);
                (x.log10(), j)
            }
            Op::Exp => {
                let (x, j) = scale_into(n, 1.0);
                (x.exp(), j)
            }
        }
    }

    /// Lower is simpler; used only to break ties.
    pub fn cost(self) -> u8 {
        match self {
            Op::Identity => 0,
            Op::Inverse => 1,
            Op::Sqrt => 2,
            Op::Square => 3,
            Op::Cbrt => 4,
            Op::Ln => 5,
            Op::Log10 => 6,
            Op::InverseSquare => 7,
            Op::Cube => 8,
            Op::Exp => 9,
            Op::FourthRoot => 10,
        }
    }
}

/// Scales n by a power of ten into [low, 10 low).
fn scale_into(n: f64, low: f64) -> (f64, i32) {
    let j = (low.log10() - n.log10()).floor() as i32;
    let mut x = n * 10f64.powi(j);
    let mut j = j;
    if x >= 10.0 * low {
        x /= 10.0;
        j -= 1;
    } else if x < low {
        x *= 10.0;
        j += 1;
    }
    (x, j)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Constant {
    Times(u32),
    Over(u32),
}

impl Constant {
    fn apply(self, v: f64) -> f64 {
        match self {
            Constant::Times(c) => v * c as f64,
            Constant::Over(c) => v / c as f64,
        }
    }

    fn cost(self) -> u32 {
        match self {
            Constant::Times(1) => 0,
            Constant::Over(c) => c,
            Constant::Times(c) => c + 1,
        }
    }
}

/// The additive frame around the scaled term t: `t`, `K + t`, or `4 - t`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Frame {
    Plain,
    Plus(u8),
    FourMinus,
}

impl Frame {
    pub const ALL: [Frame; 5] = [
        Frame::Plain,
        Frame::Plus(3),
        Frame::Plus(2),
        Frame::Plus(1),
        Frame::FourMinus,
    ];

    /// Where t has to land for the result to sit near pi.
    fn range_low(self) -> f64 {
        match self {
            Frame::Plain => 1.0,
            Frame::Plus(3) | Frame::FourMinus => 0.1,
            Frame::Plus(_) => 1.0,
        }
    }

    fn apply(self, t: f64) -> f64 {
        match self {
            Frame::Plain => t,
            Frame::Plus(k) => k as f64 + t,
            Frame::FourMinus => 4.0 - t,
        }
    }

    fn cost(self) -> u32 {
        match self {
            Frame::Plain => 0,
            Frame::Plus(k) => 40 + 5 * (3u32.saturating_sub(k as u32)),
            Frame::FourMinus => 55,
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct Approximation {
    /// Number of leading terms concatenated.
    pub k: usize,
    pub n: u64,
    pub op: Op,
    /// Power of ten applied to N inside a log or exp.
    pub j: i32,
    pub constant: Constant,
    pub frame: Frame,
    /// Outer power of ten that brings the term into the frame's range.
    pub m: i32,
    pub value: f64,
    /// Digits of agreement with pi: -log10 of the relative error.
    pub digits: f64,
}

impl Approximation {
    /// More digits, then fewer terms, then a cheaper constant, then a simpler operation.
    pub fn beats(&self, other: &Approximation) -> bool {
        let key = |a: &Approximation| {
            (
                -(a.digits * 100.0).round() as i64,
                a.k,
                a.frame.cost() + a.constant.cost(),
                a.op.cost(),
            )
        };
        key(self) < key(other)
    }
}

fn normalize(v: f64, low: f64) -> Option<(f64, i32)> {
    if !(v.is_finite() && v > 0.0) {
        return None;
    }
    Some(scale_into(v, low))
}

pub fn digits_of_agreement(value: f64) -> f64 {
    let rel = ((value - PI) / PI).abs();
    if rel == 0.0 {
        16.0
    } else {
        (-rel.log10()).clamp(0.0, 16.0)
    }
}

fn constants() -> impl Iterator<Item = Constant> {
    (1..=MAX_C)
        .map(Constant::Times)
        .chain((2..=MAX_C).map(Constant::Over))
}

/// Best approximation over every prefix string; `prefixes` are the digit strings for k = 1, 2, ...
pub fn best(prefixes: &[String]) -> Option<Approximation> {
    best_in(prefixes, &Frame::ALL)
}

pub fn best_in(prefixes: &[String], frames: &[Frame]) -> Option<Approximation> {
    let mut best: Option<Approximation> = None;
    for (i, s) in prefixes.iter().enumerate() {
        let Ok(n) = s.parse::<u64>() else { continue };
        if n == 0 {
            continue;
        }
        let nf = n as f64;
        for op in Op::ALL {
            let (base, j) = op.apply(nf);
            for constant in constants() {
                let scaled = constant.apply(base);
                for &frame in frames {
                    let Some((t, m)) = normalize(scaled, frame.range_low()) else {
                        continue;
                    };
                    let value = frame.apply(t);
                    let cand = Approximation {
                        k: i + 1,
                        n,
                        op,
                        j,
                        constant,
                        frame,
                        m,
                        value,
                        digits: digits_of_agreement(value),
                    };
                    if best.as_ref().is_none_or(|b| cand.beats(b)) {
                        best = Some(cand);
                    }
                }
            }
        }
    }
    best
}

/// `n * 10^j` written as a multiplication or a division by a power of ten.
fn scaled(n: u64, j: i32) -> String {
    match j {
        0 => n.to_string(),
        j if j > 0 => format!("{n} * 10^{j}"),
        j => format!("{n} / 10^{}", -j),
    }
}

/// Plain text such as `22 / 7`, `sqrt(98696) / 100`, or `ln(2314 / 10^2)`.
pub fn render(a: &Approximation) -> String {
    let n = a.n;
    let inner = scaled(n, a.j);
    let core = match a.op {
        Op::Identity => n.to_string(),
        Op::Square => format!("{n}^2"),
        Op::Cube => format!("{n}^3"),
        Op::Inverse => format!("1 / {n}"),
        Op::InverseSquare => format!("1 / {n}^2"),
        Op::Sqrt => format!("sqrt({n})"),
        Op::Cbrt => format!("cbrt({n})"),
        Op::FourthRoot => format!("{n}^(1/4)"),
        Op::Ln => format!("ln({inner})"),
        Op::Log10 => format!("log10({inner})"),
        Op::Exp => format!("exp({inner})"),
    };
    let with_c = match (a.constant, a.op) {
        (Constant::Times(1), _) => core,
        (Constant::Times(c), Op::Inverse) => format!("{c} / {n}"),
        (Constant::Times(c), Op::InverseSquare) => format!("{c} / {n}^2"),
        (Constant::Times(c), _) => format!("{c} * {core}"),
        (Constant::Over(c), _) => format!("{core} / {c}"),
    };
    let term = match a.m {
        0 => with_c,
        m if m > 0 => format!("{with_c} * 10^{m}"),
        m => format!("{with_c} / 10^{}", -m),
    };
    match a.frame {
        Frame::Plain => term,
        Frame::Plus(k) => format!("{k} + {term}"),
        Frame::FourMinus => format!("4 - {term}"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn s(v: &[&str]) -> Vec<String> {
        v.iter().map(|x| x.to_string()).collect()
    }

    fn show(prefixes: &[&str]) -> (String, f64) {
        let a = best(&s(prefixes)).unwrap();
        (render(&a), a.digits)
    }

    fn plain(prefixes: &[&str]) -> (String, f64) {
        let a = best_in(&s(prefixes), &[Frame::Plain]).unwrap();
        (render(&a), a.digits)
    }

    #[test]
    fn finds_twenty_two_sevenths() {
        let a = best_in(&s(&["7"]), &[Frame::Plain]).unwrap();
        assert_eq!(render(&a), "22 / 7");
        assert!((a.value - 22.0 / 7.0).abs() < 1e-12);
        assert!(a.digits > 3.0 && a.digits < 4.0);
        let (_, with_frames) = show(&["7"]);
        assert!(with_frames >= a.digits);
    }

    #[test]
    fn finds_the_square_root_of_pi_squared() {
        let (expr, digits) = show(&["9", "98", "986", "9869", "98696"]);
        assert!(digits > 5.0, "{expr} {digits}");
        assert!(expr.contains("98696") || expr.contains("9869"), "{expr}");
    }

    #[test]
    fn finds_a_log() {
        let (expr, digits) = plain(&["2314"]);
        assert_eq!(expr, "ln(2314 / 10^2)");
        assert!(digits > 4.0, "{expr} {digits}");
    }

    #[test]
    fn prefers_fewer_terms_on_ties() {
        let a = best(&s(&["314", "3141"])).unwrap();
        let b = best(&s(&["314"])).unwrap();
        assert!(a.digits >= b.digits);
        assert!(a.k == 2 || (a.k == 1 && a.digits == b.digits));
    }

    #[test]
    fn adds_three_to_the_fractional_digits() {
        let (expr, digits) = show(&["1", "14", "141", "1415", "14159"]);
        assert_eq!(expr, "3 + 14159 / 10^5");
        assert!(digits > 5.0, "{digits}");
    }

    #[test]
    fn subtracts_from_four() {
        let a = Approximation {
            k: 1,
            n: 858,
            op: Op::Identity,
            j: 0,
            constant: Constant::Times(1),
            frame: Frame::FourMinus,
            m: -3,
            value: 4.0 - 0.858,
            digits: 3.0,
        };
        assert_eq!(render(&a), "4 - 858 / 10^3");
    }

    #[test]
    fn skips_zero_and_junk() {
        assert!(best(&s(&["0"])).is_none());
        assert!(best(&s(&["0", "00"])).is_none());
        assert!(best(&[]).is_none());
        assert!(best(&s(&["0", "01"])).is_some());
    }

    #[test]
    fn scaling_lands_in_range() {
        for v in [0.0035, 3.5, 35000.0, 9.9999999999, 1.0, 0.1] {
            let (x, _) = scale_into(v, 1.0);
            assert!((1.0..10.0).contains(&x), "{v} -> {x}");
            let (y, _) = scale_into(v, 10.0);
            assert!((10.0..100.0).contains(&y), "{v} -> {y}");
            let (z, _) = scale_into(v, 0.1);
            assert!((0.1..1.0).contains(&z), "{v} -> {z}");
        }
        assert!(normalize(0.0, 1.0).is_none());
    }

    #[test]
    fn renders_every_shape() {
        let base = Approximation {
            k: 1,
            n: 2314,
            op: Op::Ln,
            j: 2,
            constant: Constant::Times(1),
            frame: Frame::Plain,
            m: 0,
            value: PI,
            digits: 16.0,
        };
        assert_eq!(render(&base), "ln(2314 * 10^2)");
        let neg = Approximation {
            j: -2,
            ..base.clone()
        };
        assert_eq!(render(&neg), "ln(2314 / 10^2)");
        let over = Approximation {
            op: Op::Identity,
            j: 0,
            constant: Constant::Over(7),
            m: 0,
            n: 22,
            ..base.clone()
        };
        assert_eq!(render(&over), "22 / 7");
        let sq = Approximation {
            op: Op::Square,
            constant: Constant::Times(3),
            m: -1,
            n: 32,
            j: 0,
            ..base
        };
        assert_eq!(render(&sq), "3 * 32^2 / 10^1");
    }
}
