use pisearch::piapprox::{best, render};
fn main() {
    for arg in std::env::args().skip(1) {
        let prefixes: Vec<String> = arg.split(',').map(|s| s.to_string()).collect();
        match best(&prefixes) {
            Some(a) => println!(
                "{arg:>24} -> {:<28} value {:.8} digits {:.2}",
                render(&a),
                a.value,
                a.digits
            ),
            None => println!("{arg:>24} -> none"),
        }
    }
}
