use crate::Result;
use crossterm::{
    cursor::Show,
    event::{DisableBracketedPaste, EnableBracketedPaste},
    execute,
    terminal::{EnterAlternateScreen, enable_raw_mode},
};
use ratatui::{DefaultTerminal, backend::CrosstermBackend};
use std::{
    io::{self, IsTerminal},
    sync::{
        Arc,
        atomic::{AtomicBool, Ordering},
    },
};

pub struct TerminalGuard {
    pub quit: Arc<AtomicBool>,
    pub suspend: Arc<AtomicBool>,
    signals: Vec<signal_hook::SigId>,
}
pub fn restore() {
    let _ = execute!(io::stdout(), DisableBracketedPaste, Show);
    ratatui::restore();
}

fn initialize() -> std::io::Result<DefaultTerminal> {
    // Install our cleanup hook once, rather than nesting Ratatui hooks on every
    // suspend/resume cycle. The guard already exists if any setup step fails.
    enable_raw_mode()?;
    execute!(io::stdout(), EnterAlternateScreen, EnableBracketedPaste)?;
    ratatui::Terminal::new(CrosstermBackend::new(io::stdout()))
}
impl TerminalGuard {
    pub fn enter() -> Result<(Self, DefaultTerminal)> {
        if !io::stdin().is_terminal() || !io::stdout().is_terminal() {
            return Err(
                "Oxytype requires an interactive terminal; use --help or --smoke-test without one"
                    .into(),
            );
        }
        if std::env::var("TERM").is_ok_and(|term| term == "dumb") {
            return Err("TERM=dumb cannot render Oxytype".into());
        }
        let hook = std::panic::take_hook();
        std::panic::set_hook(Box::new(move |info| {
            restore();
            hook(info);
        }));
        let mut guard = Self {
            quit: Arc::new(AtomicBool::new(false)),
            suspend: Arc::new(AtomicBool::new(false)),
            signals: vec![],
        };
        for signal in [signal_hook::consts::SIGINT, signal_hook::consts::SIGTERM] {
            guard
                .signals
                .push(signal_hook::flag::register(signal, guard.quit.clone())?);
        }
        #[cfg(unix)]
        for (signal, flag) in [
            (signal_hook::consts::SIGHUP, guard.quit.clone()),
            (signal_hook::consts::SIGTSTP, guard.suspend.clone()),
        ] {
            guard
                .signals
                .push(signal_hook::flag::register(signal, flag)?);
        }
        let terminal = initialize()?;
        Ok((guard, terminal))
    }
    pub fn resume_if_requested(&self, terminal: &mut DefaultTerminal) -> Result<bool> {
        if !self.suspend.swap(false, Ordering::SeqCst) {
            return Ok(false);
        }
        #[cfg(unix)]
        {
            restore();
            // Suspend the foreground job too when launched through vp/Cargo;
            // stopping only the binary leaves its launcher holding the terminal.
            nix::sys::signal::killpg(nix::unistd::getpgrp(), nix::sys::signal::Signal::SIGSTOP)?;
            *terminal = initialize()?;
        }
        Ok(true)
    }
}
impl Drop for TerminalGuard {
    fn drop(&mut self) {
        restore();
        for signal in self.signals.drain(..) {
            signal_hook::low_level::unregister(signal);
        }
    }
}
