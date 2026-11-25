//! Real POSIX PTY lifecycle checks; no claimed hardware-terminal coverage.

use crate::screen::screen_text;
use caret_tui::Result;
use nix::{
    pty::openpty,
    sys::{
        signal::{Signal, kill, killpg},
        wait::{WaitPidFlag, WaitStatus, waitpid},
    },
    unistd::Pid,
};
use rusqlite::Connection;
use rustix::{
    event::{PollFd, PollFlags, Timespec, poll},
    termios::{LocalModes, Termios, Winsize, tcgetattr, tcsetwinsize},
};
use serde_json::Value;
use signal_hook::{
    consts::{SIGHUP, SIGINT, SIGTERM, SIGTSTP},
    iterator::Signals,
};
use std::{
    fs,
    io::{self, ErrorKind},
    os::{
        fd::{AsFd, OwnedFd},
        unix::process::ExitStatusExt,
    },
    path::{Path, PathBuf},
    process::{Child as StdChild, Command, Stdio},
    sync::{
        Arc,
        atomic::{AtomicBool, Ordering},
    },
    time::{Duration, Instant},
};
use tempfile::TempDir;

pub fn dimensions(slave: impl AsFd, columns: u16, rows: u16) -> Result<()> {
    tcsetwinsize(
        slave,
        Winsize {
            ws_row: rows,
            ws_col: columns,
            ws_xpixel: 0,
            ws_ypixel: 0,
        },
    )?;
    Ok(())
}

pub struct ChildOptions<'a> {
    pub failure: Option<&'a str>,
    pub args: Vec<String>,
    pub enhanced: bool,
    pub keyboard: Option<&'a str>,
    pub term: String,
}

impl Default for ChildOptions<'_> {
    fn default() -> Self {
        Self {
            failure: None,
            args: Vec::new(),
            enhanced: false,
            keyboard: None,
            term: "xterm-256color".to_string(),
        }
    }
}

pub struct Child {
    pub profile: TempDir,
    enhanced: bool,
    queries_replied: usize,
    pub master: OwnedFd,
    pub slave: OwnedFd,
    original: Termios,
    pub output: Vec<u8>,
    pub status_path: PathBuf,
    pub process: StdChild,
    closed: bool,
}

impl Child {
    pub fn spawn(binary: &Path, options: ChildOptions<'_>) -> Result<Self> {
        let profile = tempfile::Builder::new().prefix("caret-pty-").tempdir()?;
        let pty = openpty(None, None)?;
        dimensions(&pty.slave, 100, 24)?;
        let original = tcgetattr(&pty.slave)?;
        let status_path = profile.path().join("exit-status");

        let keeper_exe = std::env::current_exe()?;
        let keyboard = options
            .keyboard
            .unwrap_or(if options.enhanced { "auto" } else { "basic" });
        let config_dir = profile.path().join("config");
        let data_dir = profile.path().join("data");

        let mut command = Command::new(keeper_exe);
        command
            .arg("keeper")
            .arg("--")
            .arg(binary)
            .arg("--config-dir")
            .arg(&config_dir)
            .arg("--data-dir")
            .arg(&data_dir)
            .arg("--keyboard")
            .arg(keyboard)
            .args(&options.args)
            .env("TERM", &options.term)
            .env("CARET_PTY_STATUS", &status_path)
            .stdin(Stdio::from(pty.slave.try_clone()?))
            .stdout(Stdio::from(pty.slave.try_clone()?))
            .stderr(Stdio::from(pty.slave.try_clone()?));
        if let Some(failure) = options.failure {
            command.env("CARET_TERMINAL_TEST_FAILURE", failure);
        }
        let process = command.spawn()?;

        Ok(Self {
            profile,
            enhanced: options.enhanced,
            queries_replied: 0,
            master: pty.master,
            slave: pty.slave,
            original,
            output: Vec::new(),
            status_path,
            process,
            closed: false,
        })
    }

    pub fn pid(&self) -> Pid {
        Pid::from_raw(self.process.id() as i32)
    }

    /// Read available PTY output up to `timeout`. Returns `true` if bytes were read.
    pub fn read(&mut self, timeout: Duration) -> Result<bool> {
        let mut fds = [PollFd::new(&self.master, PollFlags::IN)];
        let ts = Timespec {
            tv_sec: timeout.as_secs() as i64,
            tv_nsec: timeout.subsec_nanos() as i64,
        };
        let ready = match poll(&mut fds, Some(&ts)) {
            Ok(n) => n,
            Err(rustix::io::Errno::INTR) => return Ok(false),
            Err(error) => return Err(error.into()),
        };
        if ready == 0 || !fds[0].revents().intersects(PollFlags::IN | PollFlags::HUP) {
            return Ok(false);
        }
        let mut buf = [0u8; 65536];
        let count = match rustix::io::read(&self.master, &mut buf) {
            Ok(0) => return Ok(false),
            Ok(n) => n,
            Err(rustix::io::Errno::IO | rustix::io::Errno::INTR | rustix::io::Errno::AGAIN) => {
                return Ok(false);
            }
            Err(error) => return Err(error.into()),
        };
        self.output.extend_from_slice(&buf[..count]);
        if self.enhanced {
            let queries = count_subslice(&self.output, b"\x1b[?u");
            while queries > self.queries_replied {
                // Protocol simulation, not a claim of hardware-terminal coverage.
                self.send(b"\x1b[?0u\x1b[?1;2c")?;
                self.queries_replied += 1;
            }
        }
        Ok(true)
    }

    pub fn until(&mut self, text: &str, timeout: Duration, fresh: bool) -> Result<()> {
        let deadline = Instant::now() + timeout;
        let start = self.output.len();
        while Instant::now() < deadline {
            self.read(Duration::from_millis(50))?;
            if (!fresh || self.output.len() > start) && self.screen_text().contains(text) {
                return Ok(());
            }
            if self.status_path.exists() || self.process.try_wait()?.is_some() {
                break;
            }
        }
        let tail_start = self.output.len().saturating_sub(2000);
        let tail = String::from_utf8_lossy(&self.output[tail_start..]);
        let exit = self.process.try_wait()?;
        Err(format!("Missing {text:?}; process={exit:?}; output={tail:?}").into())
    }

    pub fn screen_text(&self) -> String {
        screen_text(&self.output)
    }

    pub fn send(&self, data: &[u8]) -> Result<()> {
        write_all_fd(&self.master, data)
    }

    pub fn wait_exit(&mut self, timeout: Duration) -> Result<i32> {
        // A real emulator continuously consumes output. macOS PTYs have a small
        // output buffer; waiting without reading can block the app before quit.
        let deadline = Instant::now() + timeout;
        while !self.status_path.exists() && Instant::now() < deadline {
            self.read(Duration::from_millis(20))?;
            if self.process.try_wait()?.is_some() {
                return Err("PTY session keeper exited before app status".into());
            }
        }
        if !self.status_path.exists() {
            return Err(format!(
                "Timed out after {}s waiting for app exit",
                timeout.as_secs()
            )
            .into());
        }
        let raw = fs::read_to_string(&self.status_path)?;
        Ok(raw.trim().parse::<i32>()?)
    }

    pub fn restored(&mut self) -> Result<()> {
        let current = tcgetattr(&self.slave)?;
        let mask = LocalModes::ICANON | LocalModes::ECHO;
        if (current.local_modes & mask) != (self.original.local_modes & mask) {
            return Err("raw/echo state leaked".into());
        }
        while self.read(Duration::ZERO)? {}
        if !contains_subslice(&self.output, b"\x1b[?1049l") {
            return Err("alternate screen not restored".into());
        }
        if !contains_subslice(&self.output, b"\x1b[?2004l") {
            return Err("bracketed paste not disabled".into());
        }
        Ok(())
    }

    pub fn close(&mut self) {
        if self.closed {
            return;
        }
        self.closed = true;
        if matches!(self.process.try_wait(), Ok(None)) {
            let pid = self.pid();
            let _ = killpg(pid, Signal::SIGCONT);
            let _ = killpg(pid, Signal::SIGKILL);
            let _ = kill(pid, Signal::SIGKILL);
            let deadline = Instant::now() + Duration::from_secs(3);
            while matches!(self.process.try_wait(), Ok(None)) && Instant::now() < deadline {
                let _ = self.read(Duration::from_millis(20));
            }
            let _ = self.process.wait();
        }
    }
}

impl Drop for Child {
    fn drop(&mut self) {
        self.close();
    }
}

pub fn write_all_fd(fd: impl AsFd, mut data: &[u8]) -> Result<()> {
    while !data.is_empty() {
        match rustix::io::write(&fd, data) {
            Ok(0) => {
                return Err(io::Error::new(ErrorKind::WriteZero, "zero-byte write to fd").into());
            }
            Ok(count) => data = &data[count..],
            Err(rustix::io::Errno::INTR) => continue,
            Err(error) => return Err(error.into()),
        }
    }
    Ok(())
}

pub fn contains_subslice(haystack: &[u8], needle: &[u8]) -> bool {
    !needle.is_empty()
        && haystack
            .windows(needle.len())
            .any(|window| window == needle)
}

fn count_subslice(haystack: &[u8], needle: &[u8]) -> usize {
    if needle.is_empty() {
        return 0;
    }
    let mut count = 0;
    let mut index = 0;
    while index + needle.len() <= haystack.len() {
        if &haystack[index..index + needle.len()] == needle {
            count += 1;
            index += needle.len();
        } else {
            index += 1;
        }
    }
    count
}

fn first_result_record(profile_dir: &Path) -> Result<Value> {
    let db = Connection::open(profile_dir.join("data/history.sqlite3"))?;
    let raw: String = db.query_row("SELECT json FROM results LIMIT 1", [], |row| row.get(0))?;
    Ok(serde_json::from_str(&raw)?)
}

pub fn run(binary: &Path, release: bool) -> Result<()> {
    let binary = fs::canonicalize(binary)?;
    let timeout = Duration::from_secs(5);

    // 1. Primary lifecycle: typing, F8 finish, history, export, restart, resize, quit.
    {
        let mut child = Child::spawn(&binary, ChildOptions::default())?;
        child.until("caret", timeout, false)?;
        if tcgetattr(&child.slave)?
            .local_modes
            .contains(LocalModes::ICANON)
        {
            return Err("expected raw mode (ICANON disabled) while running".into());
        }
        child.send(b"one ")?;
        std::thread::sleep(Duration::from_millis(150));
        child.send(b"\x1b[19~")?; // F8 is available without enhanced Ctrl+Enter.
        child.until("next test", timeout, false)?;
        child.until("Result saved locally.", timeout, false)?;
        let record = first_result_record(child.profile.path())?;
        if !record["replayLog"].is_null() {
            return Err("expected replayLog to be null by default".into());
        }
        if !record["summary"]["keyDuration"].is_null() {
            return Err("expected keyDuration to be null".into());
        }
        child.send(b"\x1bOR")?; // F3 history
        child.until("Local history", timeout, false)?;
        child.send(b"\x1b[18~")?; // F7 export
        child.until("Exported", timeout, false)?;
        let exported: Vec<PathBuf> = fs::read_dir(child.profile.path().join("data"))?
            .filter_map(|entry| entry.ok().map(|e| e.path()))
            .filter(|path| {
                path.file_name()
                    .and_then(|n| n.to_str())
                    .is_some_and(|n| n.starts_with("export-") && n.ends_with(".json"))
            })
            .collect();
        if exported.len() != 1 {
            return Err(format!("expected 1 export file, found {}", exported.len()).into());
        }
        let exported_json: Value = serde_json::from_str(&fs::read_to_string(&exported[0])?)?;
        if exported_json["results"][0]["id"] != record["id"] {
            return Err("exported result id mismatch".into());
        }
        child.send(b"\x1b[15~")?; // F5 restart
        child.until("quote  zen  custom", timeout, false)?; // Idle test config bar.
        dimensions(&child.slave, 30, 8)?;
        let _ = killpg(child.pid(), Signal::SIGWINCH);
        // Ratatui skips blank cells with cursor moves; words need not be emitted
        // as one contiguous byte string in a real incremental terminal frame.
        child.until("resize to at least", timeout, false)?;
        child.send(b"lost")?;
        std::thread::sleep(Duration::from_millis(100));
        dimensions(&child.slave, 100, 24)?;
        let _ = killpg(child.pid(), Signal::SIGWINCH);
        // Await the full frame: the bar only returns if undersized typing never started a test.
        child.until("quote  zen  custom", timeout, false)?;
        child.send(b"\x11")?;
        let status = child.wait_exit(timeout)?;
        if status != 0 {
            return Err(format!("expected exit 0, got {status}").into());
        }
        child.restored()?;
    }

    // 2. Five modes smoke.
    for mode in ["time", "words", "quote", "custom", "zen"] {
        let mut args = vec!["--mode".to_string(), mode.to_string()];
        if mode == "custom" {
            args.push("--text".to_string());
            args.push("one two three".to_string());
        }
        let mut child = Child::spawn(
            &binary,
            ChildOptions {
                args,
                ..ChildOptions::default()
            },
        )?;
        child.until("caret", timeout, false)?;
        child.send(b"one ")?;
        std::thread::sleep(Duration::from_millis(150));
        child.send(b"\x1b[19~")?;
        child.until("next test", timeout, false)?;
        child.send(b"\x11")?;
        let status = child.wait_exit(timeout)?;
        if status != 0 {
            return Err(format!("mode {mode}: expected exit 0, got {status}").into());
        }
        child.restored()?;
    }

    // 3. Settings (F2) + private custom text editor (F4) with bracketed paste.
    {
        let mut child = Child::spawn(&binary, ChildOptions::default())?;
        child.until("caret", timeout, false)?;
        child.send(b"\x1bOQ")?; // F2: settings
        child.until("select", timeout, false)?;
        child.send(b"\x1bOS")?; // F4: private editor
        child.until("type or paste", timeout, false)?;
        child.send(b"\x1b[200~one two\x1b[201~")?;
        std::thread::sleep(Duration::from_millis(100));
        child.send(b"\x1b[19~")?;
        child.until("quote  zen  custom", timeout, false)?;
        child.send(b"one ")?;
        std::thread::sleep(Duration::from_millis(150));
        child.send(b"two")?;
        child.until("next test", timeout, false)?;
        child.send(b"\x11")?;
        let status = child.wait_exit(timeout)?;
        if status != 0 {
            return Err(format!("editor flow: expected exit 0, got {status}").into());
        }
        child.restored()?;
    }

    // 4. Custom replay recording + blocked paste + watch replay.
    {
        let mut child = Child::spawn(
            &binary,
            ChildOptions {
                args: vec![
                    "--mode".into(),
                    "custom".into(),
                    "--text".into(),
                    "one two".into(),
                    "--record-replay".into(),
                ],
                ..ChildOptions::default()
            },
        )?;
        child.until("recording private text", timeout, false)?;
        child.send(b"\x1b[200~PASTE_BLOCKED\x1b[201~")?;
        child.until("Paste blocked during typing.", timeout, false)?;
        child.send(b"one ")?;
        std::thread::sleep(Duration::from_millis(150));
        child.send(b"two")?;
        child.until("Result saved locally.", timeout, false)?;
        child.send(b"\x1bOR")?;
        child.until("Local history", timeout, false)?;
        child.send(b"\x1b[19~")?;
        child.until("watch replay", timeout, false)?;
        let saved = first_result_record(child.profile.path())?;
        let committed = saved["replayLog"]["events"]
            .as_array()
            .ok_or("missing replayLog.events")?
            .iter()
            .filter(|event| event["type"] == "input" && event["data"]["inputType"] == "insertText")
            .count();
        if committed != 7 {
            return Err(format!(
                "Paste entered the native log or custom text did not complete (committed={committed})"
            )
            .into());
        }
        child.send(b"\x1b[C")?;
        child.until("step 1", timeout, false)?;
        child.send(b"\x11")?;
        let status = child.wait_exit(timeout)?;
        if status != 0 {
            return Err(format!("replay flow: expected exit 0, got {status}").into());
        }
        child.restored()?;
    }

    // 5. Enhanced keyboard negotiation + press/repeat/release.
    {
        let mut child = Child::spawn(
            &binary,
            ChildOptions {
                args: vec!["--mode".into(), "zen".into()],
                enhanced: true,
                ..ChildOptions::default()
            },
        )?;
        child.until("caret", timeout, false)?;
        if !contains_subslice(&child.output, b"\x1b[>1u") {
            return Err("enhanced flags not pushed".into());
        }
        child.send(b"\x1b[97;1u\x1b[97;1:2u\x1b[97;1:3u")?; // press/repeat/release
        child.until("aa", timeout, false)?;
        child.send(b"\x1bOP")?;
        child.until("protocol enhanced", timeout, false)?;
        child.until("release observed yes", timeout, false)?;
        child.send(b"\x11")?;
        let status = child.wait_exit(timeout)?;
        if status != 0 {
            return Err(format!("enhanced flow: expected exit 0, got {status}").into());
        }
        child.restored()?;
        if !contains_subslice(&child.output, b"\x1b[<1u") {
            return Err("enhanced flags not popped".into());
        }
    }

    // 6. Fragmented CSI-u + UTF-8 + grapheme deletion + shortcuts + Ctrl+Backspace.
    // CSI-u protocol boundaries are shared by Kitty-compatible implementations.
    // Deliberately fragment sequences and UTF-8; do not assume one read per key.
    {
        let mut child = Child::spawn(
            &binary,
            ChildOptions {
                args: vec!["--mode".into(), "zen".into(), "--record-replay".into()],
                enhanced: true,
                ..ChildOptions::default()
            },
        )?;
        child.until("quote  zen  custom", timeout, false)?;
        let packets: [&[u8]; 4] = [
            b"\x1b[65;2u",
            b"\x1b[98:66;2u",
            b"\x1b[33;2u",
            "e\u{0301}界😀".as_bytes(),
        ];
        for mut packet in packets {
            // A bare ESC is ambiguous with Esc; terminal CSI introducers are
            // atomic. Exercise buffering after the introducer and within UTF-8.
            if packet.starts_with(b"\x1b[") {
                child.send(&packet[..2])?;
                packet = &packet[2..];
            }
            for &octet in packet {
                child.send(&[octet])?;
                std::thread::sleep(Duration::from_millis(2));
            }
        }
        child.until("AB!e\u{0301}界😀", timeout, false)?;
        child.send(b"\x1b[127u\x1b[127;1:3u")?; // Emoji grapheme once, ignore release.
        child.until("AB!e\u{0301}界", timeout, false)?;
        if child.screen_text().contains('😀') {
            return Err("emoji was not deleted".into());
        }
        child.send(b"\x1b[120;5u\x1b[120;3u")?; // Ctrl/Alt shortcuts never type x.
        child.send(b"\x1b[13;5:3u\x1b[19;1:3~")?; // Finish releases never finish.
        child.send(b"\x1b[97;65u")?; // Caps-lock modifier does not discard committed text.
        child.until("AB!e\u{0301}界a", timeout, false)?;
        child.send(b"\x1b[127;5u")?; // Ctrl+Backspace deletes word through the core.
        child.send(b"\x1b[122;1u\x1b[122;1:2u\x1b[122;1:3u")?;
        child.until("zz", timeout, false)?;
        if child.screen_text().contains("AB!") {
            return Err("Ctrl+Backspace kept the word".into());
        }
        child.send(b"\x1b[13;5u")?;
        child.until("Result saved locally.", timeout, false)?;
        let saved = first_result_record(child.profile.path())?;
        if saved["capabilities"]["releaseObserved"] != Value::Bool(true) {
            return Err("expected releaseObserved == true".into());
        }
        if saved["capabilities"]["repeatObserved"] != Value::Bool(true) {
            return Err("expected repeatObserved == true".into());
        }
        if !saved["summary"]["keyDuration"].is_null() {
            return Err("expected keyDuration to be null".into());
        }
        let inputs: Vec<&Value> = saved["replayLog"]["events"]
            .as_array()
            .ok_or("missing replayLog.events")?
            .iter()
            .filter(|e| e["type"] == "input")
            .map(|e| &e["data"])
            .collect();
        let last_value = inputs
            .last()
            .ok_or("missing input events")?
            .get("inputValue")
            .ok_or("missing inputValue")?;
        if *last_value != serde_json::json!([122, 122]) {
            return Err(format!("unexpected final inputValue: {last_value}").into());
        }
        if inputs
            .iter()
            .any(|e| e.get("data") == Some(&serde_json::json!([120])))
        {
            return Err("Shortcut became typing".into());
        }
        child.send(b"\x1b[21~")?; // F10 legacy functional encoding.
        let status = child.wait_exit(timeout)?;
        if status != 0 {
            return Err(format!("fragmented flow: expected exit 0, got {status}").into());
        }
        child.restored()?;
    }

    // 7. Unanswered enhanced keyboard query falls back to basic without losing input.
    {
        let mut child = Child::spawn(
            &binary,
            ChildOptions {
                args: vec!["--mode".into(), "zen".into()],
                enhanced: false,
                keyboard: Some("auto"),
                term: "xterm-kitty".to_string(),
                ..ChildOptions::default()
            },
        )?;
        child.until("quote  zen  custom", timeout, false)?;
        if contains_subslice(&child.output, b"\x1b[>1u") {
            return Err("enhanced flags pushed despite unanswered query".into());
        }
        child.send(b"fallback")?;
        child.until("fallback", timeout, false)?;
        child.send(b"\x1bOP")?;
        child.until("protocol basic", timeout, false)?;
        child.send(b"\x11")?;
        let status = child.wait_exit(timeout)?;
        if status != 0 {
            return Err(format!("fallback flow: expected exit 0, got {status}").into());
        }
        child.restored()?;
    }

    // 8. Cleanup on error, panic, SIGTERM, and suspend/resume (SIGTSTP/SIGCONT).
    let failures: &[&str] = if release {
        &["signal", "suspend"]
    } else {
        &["error", "panic", "signal", "suspend"]
    };
    for &failure in failures {
        let mut child = Child::spawn(
            &binary,
            ChildOptions {
                failure: matches!(failure, "error" | "panic").then_some(failure),
                enhanced: true,
                ..ChildOptions::default()
            },
        )?;
        if matches!(failure, "error" | "panic") {
            let status = child.wait_exit(timeout)?;
            if status == 0 {
                return Err(format!("failure {failure}: expected non-zero exit").into());
            }
        } else {
            child.until("caret", timeout, false)?;
            if failure == "signal" {
                kill(child.pid(), Signal::SIGTERM)?;
            } else {
                kill(child.pid(), Signal::SIGTSTP)?;
                let deadline = Instant::now() + timeout;
                let mut stopped = false;
                while Instant::now() < deadline {
                    child.read(Duration::from_millis(20))?; // Drain restoration output before SIGSTOP.
                    match waitpid(
                        child.pid(),
                        Some(WaitPidFlag::WNOHANG | WaitPidFlag::WUNTRACED),
                    ) {
                        Ok(WaitStatus::Stopped(_, _)) => {
                            stopped = true;
                            break;
                        }
                        Ok(_) => {}
                        Err(error) => return Err(error.into()),
                    }
                    std::thread::sleep(Duration::from_millis(20));
                }
                if !stopped {
                    return Err("Did not suspend".into());
                }
                child.restored()?;
                killpg(child.pid(), Signal::SIGCONT)?;
                child.until("caret", timeout, true)?;
                child.send(b"\x11")?;
            }
            let status = child.wait_exit(timeout)?;
            if status != 0 {
                return Err(format!("failure {failure}: expected exit 0, got {status}").into());
            }
        }
        child.restored()?;
    }

    let suffix = if release {
        ""
    } else {
        "; debug error/panic cleanup pass"
    };
    println!(
        "PTY: five modes, settings/editor, history/export/replay, basic/enhanced/fragmented/fallback protocol, typing/finish/restart/resize/quit, SIGTERM, suspend/resume pass{suffix}"
    );
    Ok(())
}

/// Like a real shell, remain the session leader after the app exits. Darwin
/// revokes a controlling PTY when its session leader dies, making tcgetattr
/// impossible; retaining the session lets us verify actual cleanup unchanged.
pub fn keep_session(binary_args: &[String]) -> Result<()> {
    let (program, args) = binary_args
        .split_first()
        .ok_or("keeper requires a binary path")?;
    rustix::process::setsid()?;
    rustix::process::ioctl_tiocsctty(io::stdin())?;

    let mut signals = Signals::new([SIGINT, SIGTERM, SIGHUP, SIGTSTP])?;
    let handle = signals.handle();
    let mut child = Command::new(program).args(args).spawn()?;
    let child_pid = Pid::from_raw(child.id() as i32);
    let exited = Arc::new(AtomicBool::new(false));
    let exited_flag = exited.clone();
    let forwarder = std::thread::spawn(move || {
        for sig in signals.forever() {
            if exited_flag.load(Ordering::SeqCst) {
                break;
            }
            if let Ok(signal) = Signal::try_from(sig) {
                let _ = kill(child_pid, signal);
            }
        }
    });

    let status = child.wait()?;
    exited.store(true, Ordering::SeqCst);
    handle.close();
    let _ = forwarder.join();

    let code = status
        .code()
        .or_else(|| status.signal().map(|sig| -sig))
        .unwrap_or(1);
    let status_path = PathBuf::from(std::env::var("CARET_PTY_STATUS")?);
    let temporary = status_path.with_extension("tmp");
    fs::write(&temporary, code.to_string())?;
    fs::rename(&temporary, &status_path)?;
    loop {
        std::thread::sleep(Duration::from_secs(3600));
    }
}
