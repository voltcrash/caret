//! Actual native terminal event decoding on the supported Linux/macOS PTYs.
use caret_tui::storage::{Paths, Store};
use portable_pty::{CommandBuilder, PtySize, native_pty_system};
use std::{
    io::{Read, Write},
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};

fn wait_screen(
    parser: &Arc<Mutex<vt100::Parser>>,
    trace: &Arc<Mutex<Vec<u8>>>,
    child: &mut ChildGuard,
    needle: &str,
) {
    let deadline = Instant::now() + Duration::from_secs(10);
    loop {
        let screen = parser.lock().unwrap().screen().contents();
        if screen.contains(needle) {
            return;
        }
        let exit = child.0.try_wait().unwrap();
        assert!(
            exit.is_none() && Instant::now() < deadline,
            "Missing {needle:?}; exit={exit:?}; screen={screen:?}; raw={:?}",
            String::from_utf8_lossy(&trace.lock().unwrap())
        );
        std::thread::sleep(Duration::from_millis(10));
    }
}
/// Foreground colour of the letter `offset` cells into the first `needle` match.
fn letter_color(
    parser: &Arc<Mutex<vt100::Parser>>,
    needle: &str,
    offset: u16,
) -> Option<vt100::Color> {
    let parser = parser.lock().unwrap();
    let screen = parser.screen();
    let (rows, columns) = screen.size();
    (0..rows).find_map(|row| {
        let line = screen.contents_between(row, 0, row, columns);
        let column = line.find(needle)? as u16 + offset;
        screen.cell(row, column).map(|cell| cell.fgcolor())
    })
}
fn wait_color(
    parser: &Arc<Mutex<vt100::Parser>>,
    child: &mut ChildGuard,
    needle: &str,
    offset: u16,
    color: vt100::Color,
) {
    let deadline = Instant::now() + Duration::from_secs(10);
    loop {
        let seen = letter_color(parser, needle, offset);
        if seen == Some(color) {
            return;
        }
        let exit = child.0.try_wait().unwrap();
        assert!(
            exit.is_none() && Instant::now() < deadline,
            "Letter {offset} of {needle:?} is {seen:?}, not {color:?}; exit={exit:?}; screen={:?}",
            parser.lock().unwrap().screen().contents()
        );
        std::thread::sleep(Duration::from_millis(10));
    }
}
struct ChildGuard(Box<dyn portable_pty::Child + Send + Sync>);
impl Drop for ChildGuard {
    fn drop(&mut self) {
        let _ = self.0.kill();
        let _ = self.0.wait();
    }
}

#[test]
fn native_terminal_decodes_edits_and_persists_actual_input_without_physical_telemetry() {
    let temp = tempfile::tempdir().unwrap();
    let paths = Paths {
        config: temp.path().join("config"),
        data: temp.path().join("data"),
    };
    let pair = native_pty_system()
        .openpty(PtySize {
            rows: 24,
            cols: 100,
            pixel_width: 0,
            pixel_height: 0,
        })
        .unwrap();
    let parser = Arc::new(Mutex::new(vt100::Parser::new(24, 100, 0)));
    let mut reader = pair.master.try_clone_reader().unwrap();
    let output = parser.clone();
    let trace = Arc::new(Mutex::new(Vec::new()));
    let raw = trace.clone();
    let writer = Arc::new(Mutex::new(pair.master.take_writer().unwrap()));
    let responses = writer.clone();
    let reading = std::thread::spawn(move || {
        let mut buffer = [0u8; 8192];
        let mut query = std::collections::VecDeque::new();
        loop {
            let count = match reader.read(&mut buffer) {
                Ok(count) => count,
                Err(error) => {
                    eprintln!("PTY reader ended: {error}");
                    break;
                }
            };
            if count == 0 {
                break;
            }
            {
                let mut trace = raw.lock().unwrap();
                trace.extend_from_slice(&buffer[..count]);
                let excess = trace.len().saturating_sub(16384);
                trace.drain(..excess);
            }
            let mut parser = output.lock().unwrap();
            for byte in &buffer[..count] {
                parser.process(&[*byte]);
                query.push_back(*byte);
                if query.len() > 4 {
                    query.pop_front();
                }
                if query.make_contiguous() == b"\x1b[6n" {
                    // ConPTY inherits its host cursor and asks the emulator for
                    // its actual position. Reply from the parsed screen state;
                    // this is terminal protocol, never typing/timing telemetry.
                    let (row, col) = parser.screen().cursor_position();
                    let mut reply = responses.lock().unwrap();
                    let response = format!("\x1b[{};{}R", row + 1, col + 1);
                    // One complete protocol packet, rather than write_fmt's
                    // separate writes for CSI prefix, numbers and terminator.
                    reply.write_all(response.as_bytes()).unwrap();
                    reply.flush().unwrap();
                    eprintln!("PTY cursor response: {response:?}");
                }
            }
        }
    });
    let mut command = CommandBuilder::new(env!("CARGO_BIN_EXE_caret"));
    command.args([
        "--keyboard",
        "basic",
        "--mode",
        "custom",
        "--text",
        "one two",
        "--record-replay",
        "--config-dir",
    ]);
    command.arg(&paths.config);
    command.arg("--data-dir");
    command.arg(&paths.data);
    command.env("TERM", "xterm-256color");
    command.env("COLORTERM", "truecolor"); // Letter checks below compare RGB.
    let mut child = ChildGuard(pair.slave.spawn_command(command).unwrap());
    drop(pair.slave);
    // Web azure palette (default): untyped letters use sub, mistakes use error.
    let sub = vt100::Color::Rgb(0x82, 0x90, 0xb4);
    let error = vt100::Color::Rgb(0xff, 0x6b, 0x5e);
    let text = vt100::Color::Rgb(0xe4, 0xeb, 0xff);
    wait_screen(&parser, &trace, &mut child, "one two");
    wait_color(&parser, &mut child, "one two", 6, sub);
    writer.lock().unwrap().write_all(b"one twx").unwrap();
    writer.lock().unwrap().flush().unwrap();
    wait_color(&parser, &mut child, "one two", 6, error);
    assert_eq!(letter_color(&parser, "one two", 0), Some(text));
    writer.lock().unwrap().write_all(b"\x7f").unwrap();
    writer.lock().unwrap().flush().unwrap();
    wait_color(&parser, &mut child, "one two", 6, sub);
    std::thread::sleep(Duration::from_millis(1100));
    writer.lock().unwrap().write_all(b"o").unwrap();
    writer.lock().unwrap().flush().unwrap();
    wait_screen(&parser, &trace, &mut child, "Result saved locally.");
    writer.lock().unwrap().write_all(b"\x1bOR").unwrap();
    writer.lock().unwrap().flush().unwrap();
    wait_screen(&parser, &trace, &mut child, "Local history");
    writer.lock().unwrap().write_all(b"\x1b[21~").unwrap();
    writer.lock().unwrap().flush().unwrap(); // F10 works with basic keyboard reports.
    let deadline = Instant::now() + Duration::from_secs(10);
    loop {
        if let Some(status) = child.0.try_wait().unwrap() {
            assert!(status.success());
            break;
        }
        assert!(Instant::now() < deadline, "App did not quit");
        std::thread::sleep(Duration::from_millis(10));
    }
    drop(writer);
    drop(pair.master);
    drop(child);
    reading.join().unwrap();
    let records = Store::open(&paths).unwrap().history(None, 100).unwrap();
    assert_eq!(records.len(), 1);
    let record = &records[0];
    assert_eq!(record["summary"]["acc"], 87.5);
    assert!(record["summary"]["keyDuration"].is_null());
    let log: typing_engine::stats::Log =
        serde_json::from_value(record["replayLog"].clone()).unwrap();
    assert!(
        log.events
            .iter()
            .all(|event| !["keydown", "keyup"].contains(&event.kind.as_str()))
    );
    assert_eq!(typing_engine::stats::typed_summary(&log).unwrap().acc, 87.5);
}
