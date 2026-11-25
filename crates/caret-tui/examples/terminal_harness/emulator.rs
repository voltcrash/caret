//! Real Linux X11 emulator checks via XTest; no simulated keyboard replies.
//!
//! Starts its own private Xvfb server; requires Xvfb, xdotool and an emulator.
//! The recorder forwards bytes unchanged through a PTY, retaining the app output
//! and cleanup evidence. Only test-owned windows, profiles and processes are used.

use crate::{
    pty::{Child, ChildOptions, dimensions, write_all_fd},
    screen::screen_text,
    x11,
};
use caret_tui::Result;
use clap::ValueEnum;
use nix::{
    sys::signal::{Signal, killpg},
    unistd::Pid,
};
use rusqlite::Connection;
use rustix::{
    event::{PollFd, PollFlags, Timespec, poll},
    io::{FdFlags, fcntl_setfd},
    pipe::pipe,
    termios::{OptionalActions, Termios, tcgetattr, tcgetwinsize, tcsetattr},
};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use signal_hook::consts::SIGWINCH;
use std::{
    fs::{self, File},
    io::{self, Write},
    os::fd::AsRawFd,
    path::{Path, PathBuf},
    process::{Child as StdChild, Command, Stdio},
    sync::{
        Arc,
        atomic::{AtomicBool, Ordering},
    },
    time::{Duration, Instant},
};

#[derive(Clone, Copy, Debug, PartialEq, Eq, ValueEnum)]
pub enum EmulatorKind {
    Kitty,
    Alacritty,
    Ghostty,
}

impl EmulatorKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Kitty => "kitty",
            Self::Alacritty => "alacritty",
            Self::Ghostty => "ghostty",
        }
    }
}

pub struct EmulatorArgs {
    pub emulator: EmulatorKind,
    pub command: PathBuf,
    pub binary: PathBuf,
    pub xdotool: String,
    pub xvfb: String,
    pub evidence: Option<PathBuf>,
}

struct XdoReply {
    code: i32,
    stdout: String,
    stderr: String,
}

fn regex_escape(text: &str) -> String {
    let mut escaped = String::with_capacity(text.len());
    for ch in text.chars() {
        if matches!(
            ch,
            '\\' | '.' | '^' | '$' | '*' | '+' | '?' | '(' | ')' | '[' | ']' | '{' | '}' | '|'
        ) {
            escaped.push('\\');
        }
        escaped.push(ch);
    }
    escaped
}

fn read_tail(path: &Path, max_bytes: usize) -> String {
    let text = fs::read_to_string(path).unwrap_or_default();
    if text.len() <= max_bytes {
        return text;
    }
    let mut start = text.len() - max_bytes;
    while !text.is_char_boundary(start) && start < text.len() {
        start += 1;
    }
    text[start..].to_string()
}

struct WindowQuery<'a> {
    xdotool: &'a str,
    title: &'a str,
    log_path: &'a Path,
    timeout_secs: f64,
}

/// Discover a newly mapped emulator window without `xdotool --sync`, so early
/// exits retain diagnostics from the emulator log.
fn wait_for_window_with<Clock, Sleep, PollExit, RunXdo>(
    query: &WindowQuery<'_>,
    mut poll_exit: PollExit,
    mut now: Clock,
    mut sleep: Sleep,
    mut run_xdo: RunXdo,
) -> Result<String>
where
    Clock: FnMut() -> f64,
    Sleep: FnMut(Duration),
    PollExit: FnMut() -> Option<i32>,
    RunXdo: FnMut(&[String]) -> Result<XdoReply>,
{
    // A cold software renderer can take longer than the input checks' 10s budget.
    // Poll instead of blocking in xdotool --sync, so early exits retain diagnostics.
    let deadline = now() + query.timeout_secs;
    let pattern = format!("^{}$", regex_escape(query.title));
    let cmd = vec![
        query.xdotool.to_string(),
        "search".to_string(),
        "--onlyvisible".to_string(),
        "--name".to_string(),
        pattern,
    ];
    while now() < deadline && poll_exit().is_none() {
        let reply = run_xdo(&cmd)?;
        if reply.code == 0
            && !reply.stdout.trim().is_empty()
            && let Some(last) = reply.stdout.trim().lines().last()
        {
            return Ok(last.to_string());
        }
        if reply.code != 0 && reply.code != 1 {
            return Err(format!("Cannot search private X display: {}", reply.stderr).into());
        }
        sleep(Duration::from_millis(100));
    }
    let exit = poll_exit();
    let tail = read_tail(query.log_path, 2000);
    Err(format!(
        "Visible emulator window not found within {}s (exit={exit:?})\n{tail}",
        query.timeout_secs as u64
    )
    .into())
}

fn wait_for_window(
    process: &mut StdChild,
    xdotool: &str,
    display: &str,
    title: &str,
    log_path: &Path,
) -> Result<String> {
    let start = Instant::now();
    let query = WindowQuery {
        xdotool,
        title,
        log_path,
        timeout_secs: 60.0,
    };
    wait_for_window_with(
        &query,
        || {
            process
                .try_wait()
                .ok()
                .flatten()
                .map(|status| status.code().unwrap_or(-1))
        },
        || start.elapsed().as_secs_f64(),
        std::thread::sleep,
        |cmd| {
            let output = Command::new(&cmd[0])
                .args(&cmd[1..])
                .env("DISPLAY", display)
                .output()?;
            Ok(XdoReply {
                code: output.status.code().unwrap_or(-1),
                stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
                stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
            })
        },
    )
}

struct StdinGuard {
    original: Termios,
}

impl Drop for StdinGuard {
    fn drop(&mut self) {
        let _ = tcsetattr(io::stdin(), OptionalActions::Now, &self.original);
    }
}

fn write_json_atomic(path: &Path, value: &Value) -> Result<()> {
    let temporary = path.with_extension("json.tmp");
    fs::write(&temporary, serde_json::to_vec(value)?)?;
    fs::rename(&temporary, path)?;
    Ok(())
}

fn parse_keyboard_flags_reply(reply: &[u8]) -> Option<u32> {
    // Match `\x1b[?<digits>u`
    for start in 0..reply.len() {
        if reply[start..].starts_with(b"\x1b[?") {
            let rest = &reply[start + 3..];
            let digits_end = rest
                .iter()
                .position(|b| !b.is_ascii_digit())
                .unwrap_or(rest.len());
            if digits_end > 0
                && rest.get(digits_end) == Some(&b'u')
                && let Ok(text) = std::str::from_utf8(&rest[..digits_end])
                && let Ok(flags) = text.parse::<u32>()
            {
                return Some(flags);
            }
        }
    }
    None
}

pub fn record(binary: &Path, profile: &Path, keyboard: &str) -> Result<()> {
    let original = tcgetattr(io::stdin())?;
    let term = std::env::var("TERM").unwrap_or_else(|_| "xterm-256color".to_string());
    let mut child = Child::spawn(
        binary,
        ChildOptions {
            args: vec!["--mode".into(), "zen".into(), "--record-replay".into()],
            keyboard: Some(keyboard),
            term: term.clone(),
            ..ChildOptions::default()
        },
    )?;

    let _stdin_guard = StdinGuard {
        original: original.clone(),
    };
    let mut raw = original;
    raw.make_raw();
    tcsetattr(io::stdin(), OptionalActions::Now, &raw)?;

    let resized = Arc::new(AtomicBool::new(true));
    let sig_id = signal_hook::flag::register(SIGWINCH, resized.clone())?;

    let sync_size = |child: &Child| -> Result<()> {
        if let Ok(ws) = tcgetwinsize(io::stdin())
            && ws.ws_col > 0
            && ws.ws_row > 0
        {
            dimensions(&child.slave, ws.ws_col, ws.ws_row)?;
        }
        Ok(())
    };
    sync_size(&child)?;

    write_json_atomic(
        &profile.join("ready.json"),
        &json!({
            "pid": child.process.id(),
            "term": std::env::var("TERM").ok(),
            "dataDir": child.profile.path().join("data").to_string_lossy(),
        }),
    )?;

    let mut written = 0usize;
    {
        let mut trace = File::create(profile.join("output.vt"))?;
        let mut input_trace = File::create(profile.join("input.vt"))?;
        let mut stdin_buf = [0u8; 65536];
        while !child.status_path.exists() {
            if resized.swap(false, Ordering::SeqCst) {
                sync_size(&child)?;
            }
            child.read(Duration::from_millis(10))?;
            if child.output.len() > written {
                let data = &child.output[written..];
                trace.write_all(data)?;
                write_all_fd(io::stdout(), data)?;
                written = child.output.len();
            }
            let stdin_fd = io::stdin();
            let mut fds = [PollFd::new(&stdin_fd, PollFlags::IN)];
            let zero = Timespec {
                tv_sec: 0,
                tv_nsec: 0,
            };
            if matches!(poll(&mut fds, Some(&zero)), Ok(n) if n > 0)
                && fds[0].revents().intersects(PollFlags::IN | PollFlags::HUP)
            {
                match rustix::io::read(io::stdin(), &mut stdin_buf) {
                    Ok(0) => {
                        signal_hook::low_level::unregister(sig_id);
                        return Err("Emulator input closed before app exit".into());
                    }
                    Ok(count) => {
                        let data = &stdin_buf[..count];
                        input_trace.write_all(data)?;
                        child.send(data)?;
                    }
                    Err(rustix::io::Errno::INTR | rustix::io::Errno::AGAIN) => {}
                    Err(error) => {
                        signal_hook::low_level::unregister(sig_id);
                        return Err(error.into());
                    }
                }
            }
        }
        let status = child.wait_exit(Duration::from_secs(5))?;
        child.restored()?;
        if child.output.len() > written {
            let data = &child.output[written..];
            trace.write_all(data)?;
            write_all_fd(io::stdout(), data)?;
        }
        trace.flush()?;
        input_trace.flush()?;

        // Ask the real emulator after the app popped its owned alternate-screen
        // keyboard frame. A fresh query must report zero, not leaked flags.
        write_all_fd(io::stdout(), b"\x1b[?u\x1b[c")?;
        let mut reply = Vec::new();
        let deadline = Instant::now() + Duration::from_secs(2);
        while Instant::now() < deadline {
            let stdin_fd = io::stdin();
            let mut fds = [PollFd::new(&stdin_fd, PollFlags::IN)];
            let ts = Timespec {
                tv_sec: 0,
                tv_nsec: 50_000_000,
            };
            if matches!(poll(&mut fds, Some(&ts)), Ok(n) if n > 0)
                && fds[0].revents().contains(PollFlags::IN)
                && let Ok(count) = rustix::io::read(io::stdin(), &mut stdin_buf)
            {
                if count == 0 {
                    break;
                }
                reply.extend_from_slice(&stdin_buf[..count]);
                if parse_keyboard_flags_reply(&reply).is_some() {
                    break;
                }
            }
        }
        let keyboard_flags = parse_keyboard_flags_reply(&reply);
        let db = Connection::open(child.profile.path().join("data/history.sqlite3"))?;
        let mut stmt = db.prepare("SELECT json FROM results ORDER BY rowid")?;
        let results: Vec<Value> = stmt
            .query_map([], |row| row.get::<_, String>(0))?
            .map(|row| -> Result<Value> { Ok(serde_json::from_str(&row?)?) })
            .collect::<Result<_>>()?;
        write_json_atomic(
            &profile.join("result.json"),
            &json!({
                "exitCode": status,
                "rawModeRestored": true,
                "keyboardFlagsAfterExit": keyboard_flags,
                "results": results,
            }),
        )?;
    }

    signal_hook::low_level::unregister(sig_id);
    child.close();
    Ok(())
}

struct ChildTerminator(StdChild);

impl Drop for ChildTerminator {
    fn drop(&mut self) {
        if matches!(self.0.try_wait(), Ok(None)) {
            let _ = nix::sys::signal::kill(Pid::from_raw(self.0.id() as i32), Signal::SIGTERM);
            let deadline = Instant::now() + Duration::from_secs(5);
            while matches!(self.0.try_wait(), Ok(None)) && Instant::now() < deadline {
                std::thread::sleep(Duration::from_millis(50));
            }
            if matches!(self.0.try_wait(), Ok(None)) {
                let _ = self.0.kill();
                let _ = self.0.wait();
            }
        }
    }
}

pub fn check(args: &EmulatorArgs) -> Result<()> {
    // Own the entire X server: no user windows, focus or keyboard map is touched.
    let temporary = tempfile::Builder::new()
        .prefix("caret-xserver-")
        .tempdir()?;
    let (reader, writer) = pipe()?;
    fcntl_setfd(&writer, FdFlags::empty())?;
    let log_path = temporary.path().join("xserver.log");
    let log_file = File::create(&log_path)?;
    let log_err = log_file.try_clone()?;
    let server = Command::new(&args.xvfb)
        .args([
            "-displayfd",
            &writer.as_raw_fd().to_string(),
            "-noreset",
            "-screen",
            "0",
            "1280x800x24",
            "-nolisten",
            "tcp",
        ])
        .stdout(Stdio::from(log_file))
        .stderr(Stdio::from(log_err))
        .spawn()?;
    drop(writer);
    let _server_guard = ChildTerminator(server);

    let mut fds = [PollFd::new(&reader, PollFlags::IN)];
    let ts = Timespec {
        tv_sec: 10,
        tv_nsec: 0,
    };
    let ready = poll(&mut fds, Some(&ts))?;
    if ready == 0 {
        return Err("Xvfb did not allocate a private display".into());
    }
    let mut buf = [0u8; 64];
    let count = rustix::io::read(&reader, &mut buf)?;
    let number = std::str::from_utf8(&buf[..count])?.trim().to_string();
    if number.is_empty() || !number.bytes().all(|b| b.is_ascii_digit()) {
        return Err(format!("Xvfb failed: {}", log_path.display()).into());
    }
    let display = format!(":{number}");

    // Preload Unicode test keysyms before emulators cache XKB maps.
    // xdotool's on-demand remapping races clients and truncates emoji.
    // Use ordinary letter positions: some GLFW versions ignore text
    // from unrecognized multimedia scancodes even with Unicode keysyms.
    x11::preload_unicode_keysyms(
        &display,
        &[
            (24, 0x0100_00e9),
            (29, 0x0100_0301),
            (30, 0x0100_754c),
            (31, 0x0101_f600),
        ],
    )?;

    exercise(args, &display)
}

fn copy_dir_recursive(src: &Path, dst: &Path) -> Result<()> {
    fs::create_dir_all(dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let from = entry.path();
        let to = dst.join(entry.file_name());
        if entry.file_type()?.is_dir() {
            copy_dir_recursive(&from, &to)?;
        } else {
            fs::copy(&from, &to)?;
        }
    }
    Ok(())
}

fn run_capture(program: &Path, args: &[&str]) -> Result<String> {
    let output = Command::new(program).args(args).output()?;
    if !output.status.success() {
        return Err(format!(
            "{} {:?} failed ({}): {}",
            program.display(),
            args,
            output.status,
            String::from_utf8_lossy(&output.stderr)
        )
        .into());
    }
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

fn sha256_file_hex(path: &Path) -> Result<String> {
    let bytes = fs::read(path)?;
    let digest = Sha256::digest(&bytes);
    let mut hex = String::with_capacity(64);
    for byte in digest {
        use std::fmt::Write as _;
        let _ = write!(&mut hex, "{byte:02x}");
    }
    Ok(hex)
}

fn xtest_keycode(key: &str) -> Option<u8> {
    match key {
        "U00E9" => Some(24),
        "U0301" => Some(29),
        "U754C" => Some(30),
        "U1F600" => Some(31),
        _ => {
            let digits = key.strip_prefix('F')?;
            if !digits.is_empty() && digits.bytes().all(|b| b.is_ascii_digit()) {
                let n: u8 = digits.parse().ok()?;
                66u8.checked_add(n)
            } else {
                None
            }
        }
    }
}

fn exercise(args: &EmulatorArgs, display: &str) -> Result<()> {
    let emulator_path = fs::canonicalize(&args.command)?;
    let binary = fs::canonicalize(&args.binary)?;
    let harness_exe = std::env::current_exe()?;
    let version = run_capture(&emulator_path, &["--version"])?;
    let binary_version = run_capture(&binary, &["--version"])?;
    let binary_sha256 = sha256_file_hex(&binary)?;

    let mut evidence: Vec<Value> = Vec::new();
    let output_dir = match &args.evidence {
        Some(path) => {
            fs::create_dir_all(path)?;
            Some(fs::canonicalize(path)?)
        }
        None => None,
    };

    for keyboard in ["auto", "basic"] {
        let temporary = tempfile::Builder::new()
            .prefix("caret-emulator-")
            .tempdir()?;
        let profile = temporary.path();
        let profile_name = profile
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("profile");
        let title = format!("caret-check-{profile_name}");
        let child_cmd = [
            harness_exe.to_string_lossy().into_owned(),
            "record".to_string(),
            binary.to_string_lossy().into_owned(),
            profile.to_string_lossy().into_owned(),
            keyboard.to_string(),
        ];

        let mut command = Command::new(&emulator_path);
        match args.emulator {
            EmulatorKind::Kitty => {
                command.args([
                    "--config",
                    "NONE",
                    "--override",
                    "linux_display_server=x11",
                    "--override",
                    "update_check_interval=0",
                    "--override",
                    "initial_window_width=100c",
                    "--override",
                    "initial_window_height=30c",
                    "--title",
                    &title,
                ]);
                command.args(&child_cmd);
            }
            EmulatorKind::Alacritty => {
                command.args([
                    "--config-file",
                    "/dev/null",
                    "--title",
                    &title,
                    "--option",
                    "window.dimensions.columns=100",
                    "--option",
                    "window.dimensions.lines=30",
                    "-e",
                ]);
                command.args(&child_cmd);
            }
            EmulatorKind::Ghostty => {
                command.args([
                    "--config-default-files=false",
                    "--gtk-single-instance=false",
                    &format!("--title={title}"),
                    "--window-width=100",
                    "--window-height=30",
                    "-e",
                ]);
                command.args(&child_cmd);
            }
        }
        command
            .env("DISPLAY", display)
            .env("GDK_BACKEND", "x11")
            .env("XDG_CONFIG_HOME", profile.join("config"))
            .env("XDG_CACHE_HOME", profile.join("cache"))
            .env_remove("WAYLAND_DISPLAY");

        let emu_log_path = profile.join("emulator.log");
        let emu_log = File::create(&emu_log_path)?;
        let emu_log_err = emu_log.try_clone()?;
        command
            .stdout(Stdio::from(emu_log))
            .stderr(Stdio::from(emu_log_err));

        let mut process = ChildTerminator(command.spawn()?);

        let run_result: Result<()> = (|| {
            let xdo = |xdo_args: &[&str]| -> Result<String> {
                let output = Command::new(&args.xdotool)
                    .args(xdo_args)
                    .env("DISPLAY", display)
                    .output()?;
                if !output.status.success() {
                    return Err(format!(
                        "xdotool {:?} failed ({}): {}",
                        xdo_args,
                        output.status,
                        String::from_utf8_lossy(&output.stderr)
                    )
                    .into());
                }
                Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
            };

            let wait_for =
                |process: &mut StdChild, label: &str, test: &dyn Fn() -> bool| -> Result<()> {
                    let deadline = Instant::now() + Duration::from_secs(10);
                    while Instant::now() < deadline {
                        if test() {
                            return Ok(());
                        }
                        if matches!(process.try_wait(), Ok(Some(_))) {
                            break;
                        }
                        std::thread::sleep(Duration::from_millis(20));
                    }
                    let trace = fs::read(profile.join("output.vt")).unwrap_or_default();
                    let screen = screen_text(&trace);
                    let screen_preview: String = screen.chars().take(4000).collect();
                    let log_tail = read_tail(&emu_log_path, 2000);
                    Err(format!(
                        "{}/{}: {label}\n{screen_preview}\n{log_tail}",
                        args.emulator.as_str(),
                        keyboard
                    )
                    .into())
                };

            let visible = |process: &mut StdChild, needle: &str| -> Result<()> {
                let output_vt = profile.join("output.vt");
                wait_for(process, needle, &|| {
                    fs::read(&output_vt)
                        .map(|bytes| screen_text(&bytes).contains(needle))
                        .unwrap_or(false)
                })
            };

            let send_keys = |keys: &[&str]| -> Result<()> {
                for &k in keys {
                    if let Some(code) = xtest_keycode(k) {
                        x11::send_fake_key(display, code)?;
                    } else {
                        xdo(&["key", "--delay", "20", k])?;
                    }
                }
                Ok(())
            };

            let type_text = |text: &str| -> Result<()> {
                xdo(&["type", "--delay", "10", text])?;
                Ok(())
            };

            // Older Kitty versions defer PTY query handling until their
            // window is focused. Focus the mapped window before waiting
            // for the app's keyboard handshake and first frame.
            let window = wait_for_window(
                &mut process.0,
                &args.xdotool,
                display,
                &title,
                &emu_log_path,
            )?;
            xdo(&["windowfocus", &window])?;
            visible(&mut process.0, "quote  zen  custom")?; // Idle test config bar.

            send_keys(&["A", "B", "exclam"])?;
            visible(&mut process.0, "AB!")?;

            // GTK consumes a standalone combining-key press as IME
            // preedit in Ghostty basic mode. Test its committed accented
            // character; all enhanced paths exercise combining clusters.
            let accent = if args.emulator == EmulatorKind::Ghostty && keyboard == "basic" {
                "é"
            } else {
                "e\u{0301}"
            };
            if accent == "é" {
                send_keys(&["U00E9"])?;
            } else {
                type_text("e")?;
                send_keys(&["U0301"])?;
            }
            visible(&mut process.0, &format!("AB!{accent}"))?;
            send_keys(&["U754C"])?;
            visible(&mut process.0, &format!("AB!{accent}界"))?;
            send_keys(&["U1F600"])?;
            visible(&mut process.0, &format!("AB!{accent}界😀"))?;

            send_keys(&["BackSpace"])?;
            let output_vt = profile.join("output.vt");
            wait_for(&mut process.0, "emoji deleted", &|| {
                fs::read(&output_vt)
                    .map(|bytes| !screen_text(&bytes).contains('😀'))
                    .unwrap_or(false)
            })?;
            send_keys(&["BackSpace", "BackSpace"])?;
            wait_for(&mut process.0, "graphemes deleted", &|| {
                fs::read(&output_vt)
                    .map(|bytes| !screen_text(&bytes).contains('界'))
                    .unwrap_or(false)
            })?;

            send_keys(&[if keyboard == "auto" {
                "ctrl+BackSpace"
            } else {
                "alt+BackSpace"
            }])?;
            type_text("repeat")?;
            xdo(&["keydown", "x"])?;
            std::thread::sleep(Duration::from_millis(800));
            xdo(&["keyup", "x"])?;
            visible(&mut process.0, "repeatxx")?;

            send_keys(&["F1"])?;
            visible(
                &mut process.0,
                if keyboard == "auto" {
                    "protocol enhanced"
                } else {
                    "protocol basic"
                },
            )?;
            // Default negotiation deliberately does not request releases;
            // explicit reported release/repeat packets are covered in PTY.
            visible(&mut process.0, "release observed no")?;
            send_keys(&["Escape"])?;
            visible(&mut process.0, "repeatxx")?;

            xdo(&["windowsize", &window, "380", "180"])?;
            visible(&mut process.0, "resize to at least")?;
            type_text("BLOCKED")?;
            // Ghostty's default Ctrl+Enter binding toggles fullscreen and
            // never reaches the app. F8 is the portable finish binding.
            send_keys(&[
                if keyboard == "auto" && args.emulator != EmulatorKind::Ghostty {
                    "ctrl+Return"
                } else {
                    "F8"
                },
            ])?;
            // Finish while undersized, then await the durable result before
            // resizing: XTest delivery is asynchronous, and enlarging early
            // would allow queued keys to arrive in a correctly enabled UI.
            wait_for(&mut process.0, "result saved while undersized", &|| {
                let Ok(raw) = fs::read_to_string(profile.join("ready.json")) else {
                    return false;
                };
                let Ok(ready) = serde_json::from_str::<Value>(&raw) else {
                    return false;
                };
                let Some(data_dir) = ready["dataDir"].as_str() else {
                    return false;
                };
                let Ok(db) = Connection::open(Path::new(data_dir).join("history.sqlite3")) else {
                    return false;
                };
                matches!(
                    db.query_row("SELECT count(*) FROM results", [], |r| r.get::<_, i64>(0)),
                    Ok(1)
                )
            })?;

            xdo(&["windowsize", &window, "1000", "650"])?;
            visible(&mut process.0, "Result saved locally.")?;
            send_keys(&["F3"])?;
            visible(&mut process.0, "Local history")?;
            send_keys(&["F8"])?;
            visible(&mut process.0, "watch replay")?;
            send_keys(&["Right"])?;
            visible(&mut process.0, "step 1")?;
            send_keys(&["Escape", "F5", "F4"])?;
            visible(&mut process.0, "type or paste")?;
            type_text("one two")?;
            send_keys(&["F8"])?;
            visible(&mut process.0, "quote  zen  custom")?;
            type_text("one twx")?;
            send_keys(&["BackSpace", "o"])?;
            visible(&mut process.0, "Result saved locally.")?;
            send_keys(&["F10"])?;

            let result_path = profile.join("result.json");
            wait_for(&mut process.0, "clean exit", &|| result_path.exists())?;
            let result: Value = serde_json::from_str(&fs::read_to_string(&result_path)?)?;
            if result["exitCode"] != json!(0) || result["rawModeRestored"] != json!(true) {
                return Err(format!("unclean exit: {result}").into());
            }
            if result["keyboardFlagsAfterExit"] != json!(0) {
                return Err(format!("keyboard flags leaked: {result}").into());
            }
            let results = result["results"]
                .as_array()
                .ok_or_else(|| format!("missing results: {result}"))?;
            if results.len() != 2 {
                return Err(format!("expected 2 results: {result}").into());
            }
            let (zen, custom) = (&results[0], &results[1]);
            let inputs: Vec<&Value> = zen["replayLog"]["events"]
                .as_array()
                .ok_or("missing zen replayLog.events")?
                .iter()
                .filter(|e| e["type"] == "input")
                .map(|e| &e["data"])
                .collect();
            let final_codes: Vec<u64> = inputs
                .last()
                .and_then(|e| e["inputValue"].as_array())
                .ok_or("missing final inputValue")?
                .iter()
                .filter_map(Value::as_u64)
                .collect();
            let repeat_prefix: Vec<u64> = "repeat".bytes().map(u64::from).collect();
            if final_codes.len() <= 7
                || final_codes[..6] != repeat_prefix[..]
                || !final_codes[6..].iter().all(|&c| c == u64::from(b'x'))
            {
                return Err(format!("unexpected repeat inputValue: {final_codes:?}").into());
            }
            if zen["capabilities"]["enhancedKeyboardNegotiated"] != json!(keyboard == "auto") {
                return Err(format!("unexpected negotiated capability: {zen}").into());
            }
            if !zen["summary"]["keyDuration"].is_null() {
                return Err(format!("expected null keyDuration: {zen}").into());
            }
            if custom["summary"]["acc"] != json!(87.5) {
                return Err(format!("expected custom acc 87.5: {custom}").into());
            }

            let ready: Value =
                serde_json::from_str(&fs::read_to_string(profile.join("ready.json"))?)?;
            evidence.push(json!({
                "emulator": args.emulator.as_str(),
                "version": version,
                "appVersion": binary_version,
                "binarySha256": binary_sha256,
                "keyboard": keyboard,
                "term": ready["term"],
                "exitCode": 0,
                "keyboardFlagsAfterExit": 0,
                "customAccuracy": 87.5,
                "repeatDeliveries": final_codes.len() - 6,
                "accentInput": accent,
                "capabilities": zen["capabilities"],
            }));
            println!(
                "{}/{keyboard}: real keys, Unicode/grapheme delete, repeat/release, resize, finish, history/replay/editor, native score, cleanup pass",
                args.emulator.as_str()
            );
            let _ = io::stdout().flush();
            Ok(())
        })();

        // Always archive evidence and clean up the keeper process group.
        if let Some(ref out) = output_dir {
            let _ = copy_dir_recursive(
                profile,
                &out.join(format!("{}-{keyboard}", args.emulator.as_str())),
            );
        }
        if let Ok(raw) = fs::read_to_string(profile.join("ready.json"))
            && let Ok(ready) = serde_json::from_str::<Value>(&raw)
            && let Some(pid) = ready["pid"].as_i64()
        {
            let pgid = Pid::from_raw(pid as i32);
            let _ = killpg(pgid, Signal::SIGCONT);
            let _ = killpg(pgid, Signal::SIGKILL);
        }
        drop(process);
        run_result?;
    }

    if let Some(out) = output_dir {
        let mut pretty = serde_json::to_string_pretty(&evidence)?;
        pretty.push('\n');
        fs::write(out.join(format!("{}.json", args.emulator.as_str())), pretty)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::VecDeque;

    #[test]
    fn cold_window_can_map_after_the_old_ten_second_budget() {
        let temp = tempfile::tempdir().unwrap();
        let log = temp.path().join("emulator.log");
        fs::write(&log, "renderer startup failed").unwrap();

        let mut times = VecDeque::from([0.0, 1.0, 20.0, 40.0]);
        let mut replies = VecDeque::from([
            XdoReply {
                code: 1,
                stdout: String::new(),
                stderr: String::new(),
            },
            XdoReply {
                code: 1,
                stdout: String::new(),
                stderr: String::new(),
            },
            XdoReply {
                code: 0,
                stdout: "42\n43\n".to_string(),
                stderr: String::new(),
            },
        ]);
        let mut last_cmd: Vec<String> = Vec::new();
        let query = WindowQuery {
            xdotool: "xdotool",
            title: "test.window",
            log_path: &log,
            timeout_secs: 60.0,
        };
        let window = wait_for_window_with(
            &query,
            || None,
            || times.pop_front().unwrap(),
            |_| {},
            |cmd| {
                last_cmd = cmd.to_vec();
                Ok(replies.pop_front().unwrap())
            },
        )
        .unwrap();
        assert_eq!(window, "43");
        assert!(!last_cmd.iter().any(|arg| arg == "--sync"));
        assert_eq!(last_cmd.last().unwrap(), r"^test\.window$");
    }

    #[test]
    fn early_exit_reports_the_emulator_log_without_waiting() {
        let temp = tempfile::tempdir().unwrap();
        let log = temp.path().join("emulator.log");
        fs::write(&log, "renderer startup failed").unwrap();

        let mut called = false;
        let query = WindowQuery {
            xdotool: "xdotool",
            title: "test",
            log_path: &log,
            timeout_secs: 60.0,
        };
        let err = wait_for_window_with(
            &query,
            || Some(1),
            || 0.0,
            |_| {},
            |_| {
                called = true;
                unreachable!()
            },
        )
        .unwrap_err();
        assert!(err.to_string().contains("renderer startup failed"), "{err}");
        assert!(!called);
    }

    #[test]
    fn timeout_remains_bounded_and_reports_the_emulator_log() {
        let temp = tempfile::tempdir().unwrap();
        let log = temp.path().join("emulator.log");
        fs::write(&log, "renderer startup failed").unwrap();

        let mut times = VecDeque::from([0.0, 61.0]);
        let query = WindowQuery {
            xdotool: "xdotool",
            title: "test",
            log_path: &log,
            timeout_secs: 60.0,
        };
        let err = wait_for_window_with(
            &query,
            || None,
            || times.pop_front().unwrap(),
            |_| {},
            |_| unreachable!(),
        )
        .unwrap_err();
        let message = err.to_string();
        assert!(message.contains("within 60s"), "{message}");
        assert!(message.contains("renderer startup failed"), "{message}");
    }

    #[test]
    fn parses_keyboard_flags_query_reply() {
        assert_eq!(parse_keyboard_flags_reply(b"\x1b[?0u\x1b[?1;2c"), Some(0));
        assert_eq!(parse_keyboard_flags_reply(b"noise\x1b[?15u"), Some(15));
        assert_eq!(parse_keyboard_flags_reply(b"\x1b[?u"), None);
    }

    #[test]
    fn maps_unicode_and_function_keycodes() {
        assert_eq!(xtest_keycode("U00E9"), Some(24));
        assert_eq!(xtest_keycode("U0301"), Some(29));
        assert_eq!(xtest_keycode("U754C"), Some(30));
        assert_eq!(xtest_keycode("U1F600"), Some(31));
        assert_eq!(xtest_keycode("F1"), Some(67));
        assert_eq!(xtest_keycode("F8"), Some(74));
        assert_eq!(xtest_keycode("F10"), Some(76));
        assert_eq!(xtest_keycode("BackSpace"), None);
        assert_eq!(xtest_keycode("F"), None);
    }
}
