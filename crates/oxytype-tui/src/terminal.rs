use crate::Result;
use crossterm::{
    cursor::Show,
    event::{
        DisableBracketedPaste, EnableBracketedPaste, KeyboardEnhancementFlags,
        PopKeyboardEnhancementFlags, PushKeyboardEnhancementFlags,
    },
    execute,
    terminal::{EnterAlternateScreen, enable_raw_mode, supports_keyboard_enhancement},
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
    pub enhanced: Arc<AtomicBool>,
    auto_keyboard: bool,
}
fn restore(enhanced: &AtomicBool) {
    if enhanced.swap(false, Ordering::SeqCst) {
        let _ = execute!(io::stdout(), PopKeyboardEnhancementFlags);
    }
    let _ = execute!(io::stdout(), DisableBracketedPaste, Show);
    ratatui::restore();
}

fn initialize(enhanced: &AtomicBool, auto_keyboard: bool) -> std::io::Result<DefaultTerminal> {
    // Install our cleanup hook once, rather than nesting Ratatui hooks on every
    // suspend/resume cycle. The guard already exists if any setup step fails.
    enable_raw_mode()?;
    execute!(io::stdout(), EnterAlternateScreen, EnableBracketedPaste)?;
    // Query before any event poll/read. Basic terminals may time out and use F8.
    if auto_keyboard && supports_keyboard_enhancement().unwrap_or(false) {
        enhanced.store(true, Ordering::SeqCst);
        execute!(
            io::stdout(),
            // Committed-text typing needs disambiguation, not key-up telemetry.
            // Older Kitty versions emit duplicate legacy Backspace on release
            // with REPORT_EVENT_TYPES. Keep text/IME in their ordinary UTF-8 path.
            PushKeyboardEnhancementFlags(KeyboardEnhancementFlags::DISAMBIGUATE_ESCAPE_CODES)
        )?;
    }
    ratatui::Terminal::new(CrosstermBackend::new(io::stdout()))
}
impl TerminalGuard {
    pub fn enter(auto_keyboard: bool) -> Result<(Self, DefaultTerminal)> {
        if !io::stdin().is_terminal() || !io::stdout().is_terminal() {
            return Err(
                "Oxytype requires an interactive terminal; use --help or --smoke-test without one"
                    .into(),
            );
        }
        if std::env::var("TERM").is_ok_and(|term| term == "dumb") {
            return Err("TERM=dumb cannot render Oxytype".into());
        }
        let enhanced = Arc::new(AtomicBool::new(false));
        let cleanup_enhanced = enhanced.clone();
        let hook = std::panic::take_hook();
        std::panic::set_hook(Box::new(move |info| {
            restore(&cleanup_enhanced);
            hook(info);
        }));
        let mut guard = Self {
            quit: Arc::new(AtomicBool::new(false)),
            suspend: Arc::new(AtomicBool::new(false)),
            signals: vec![],
            enhanced,
            auto_keyboard,
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
        let terminal = initialize(&guard.enhanced, guard.auto_keyboard)?;
        Ok((guard, terminal))
    }
    pub fn resume_if_requested(&self, terminal: &mut DefaultTerminal) -> Result<bool> {
        #[cfg(not(unix))]
        let _ = terminal;
        if !self.suspend.swap(false, Ordering::SeqCst) {
            return Ok(false);
        }
        #[cfg(unix)]
        {
            restore(&self.enhanced);
            // Suspend the foreground job too when launched through vp/Cargo;
            // stopping only the binary leaves its launcher holding the terminal.
            nix::sys::signal::killpg(nix::unistd::getpgrp(), nix::sys::signal::Signal::SIGSTOP)?;
            *terminal = initialize(&self.enhanced, self.auto_keyboard)?;
        }
        Ok(true)
    }
}
impl Drop for TerminalGuard {
    fn drop(&mut self) {
        restore(&self.enhanced);
        for signal in self.signals.drain(..) {
            signal_hook::low_level::unregister(signal);
        }
    }
}
