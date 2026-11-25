#[cfg(unix)]
mod pty;
mod screen;

use clap::{Parser, Subcommand};
use std::path::PathBuf;

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
    /// Run POSIX PTY lifecycle and persistence checks against a caret binary.
    Pty {
        /// Path to the caret binary.
        binary: PathBuf,
        /// Skip debug-only error/panic cleanup checks (used for release archives).
        #[arg(long)]
        release: bool,
    },
    /// Internal session leader helper for PTY checks.
    #[command(hide = true)]
    Keeper {
        /// Command and arguments to run inside the kept PTY session.
        #[arg(trailing_var_arg = true, allow_hyphen_values = true, required = true)]
        args: Vec<String>,
    },
    /// Dump the parsed VT100 screen text of stdin (diagnostic helper).
    Screen,
}

fn main() {
    let cli = Cli::parse();
    let result: caret_tui::Result<()> = match cli.command {
        Command::Pty { binary, release } => {
            #[cfg(unix)]
            {
                pty::run(&binary, release)
            }
            #[cfg(not(unix))]
            {
                let _ = (binary, release);
                Err("PTY harness requires Unix".into())
            }
        }
        Command::Keeper { args } => {
            #[cfg(unix)]
            {
                pty::keep_session(&args)
            }
            #[cfg(not(unix))]
            {
                let _ = args;
                Err("PTY keeper requires Unix".into())
            }
        }
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
