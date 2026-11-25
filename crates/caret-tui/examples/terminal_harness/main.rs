mod screen;

use clap::{Parser, Subcommand};

#[derive(Parser)]
#[command(
    name = "terminal-harness",
    about = "Native POSIX PTY and X11 emulator harness for caret-tui"
)]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    /// Dump the parsed VT100 screen text of stdin (diagnostic helper).
    Screen,
}

fn main() {
    let cli = Cli::parse();
    let result: caret_tui::Result<()> = match cli.command {
        Command::Screen => {
            use std::io::Read;
            let mut bytes = Vec::new();
            std::io::stdin()
                .read_to_end(&mut bytes)
                .map_err(Into::into)
                .map(|_| println!("{}", screen::screen_text(&bytes)))
        }
    };
    if let Err(error) = result {
        eprintln!("{error}");
        std::process::exit(1);
    }
}
