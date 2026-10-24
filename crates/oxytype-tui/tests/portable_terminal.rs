//! Actual native terminal event decoding, including Windows ConPTY.
use oxytype_tui::storage::{Paths, Store};
use portable_pty::{CommandBuilder, PtySize, native_pty_system};
use std::{
    io::{Read, Write},
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};

fn wait_screen(parser: &Arc<Mutex<vt100::Parser>>, needle: &str) {
    let deadline = Instant::now() + Duration::from_secs(10);
    loop {
        let screen = parser.lock().unwrap().screen().contents();
        if screen.contains(needle) {
            return;
        }
        assert!(Instant::now() < deadline, "Missing {needle:?}: {screen}");
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
    let reading = std::thread::spawn(move || {
        let mut buffer = [0u8; 8192];
        while let Ok(count) = reader.read(&mut buffer) {
            if count == 0 {
                break;
            }
            output.lock().unwrap().process(&buffer[..count]);
        }
    });
    let mut command = CommandBuilder::new(env!("CARGO_BIN_EXE_oxytype"));
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
    let mut child = ChildGuard(pair.slave.spawn_command(command).unwrap());
    drop(pair.slave);
    let mut writer = pair.master.take_writer().unwrap();
    wait_screen(&parser, "Input:");
    writer.write_all(b"one twx").unwrap();
    writer.flush().unwrap();
    wait_screen(&parser, "Input: twx");
    writer.write_all(b"\x7f").unwrap();
    writer.flush().unwrap();
    wait_screen(&parser, "Input: tw ");
    assert!(
        !parser
            .lock()
            .unwrap()
            .screen()
            .contents()
            .contains("Input: twx")
    );
    std::thread::sleep(Duration::from_millis(1100));
    writer.write_all(b"o").unwrap();
    writer.flush().unwrap();
    wait_screen(&parser, "Result saved locally.");
    writer.write_all(b"\x1bOR").unwrap();
    writer.flush().unwrap();
    wait_screen(&parser, "Local history");
    writer.write_all(b"\x1b[21~").unwrap();
    writer.flush().unwrap(); // F10 works with basic keyboard reports.
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
