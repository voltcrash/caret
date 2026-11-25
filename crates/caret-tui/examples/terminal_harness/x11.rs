//! Pure-Rust X11 + XTEST wire client over the local Xvfb Unix domain socket.
//!
//! Avoids FFI/unsafe code and `libX11.so.6`/`libXtst.so.6` dynamic loading
//! while sending the exact `ChangeKeyboardMapping`, `XTestFakeInput`, and
//! `GetInputFocus` (sync) requests needed for private Xvfb emulator checks.

use caret_tui::Result;
#[cfg(test)]
use std::path::Path;
use std::{
    io::{Read, Write},
    os::unix::net::UnixStream,
};

const X11_OP_GET_INPUT_FOCUS: u8 = 43;
const X11_OP_QUERY_EXTENSION: u8 = 98;
const X11_OP_CHANGE_KEYBOARD_MAPPING: u8 = 100;
const XTEST_MINOR_FAKE_INPUT: u8 = 2;
const X11_KEY_PRESS: u8 = 2;
const X11_KEY_RELEASE: u8 = 3;

pub fn parse_display_number(display: &str) -> Result<u32> {
    let after_colon = display
        .rsplit_once(':')
        .map(|(_, rest)| rest)
        .ok_or_else(|| format!("Invalid X11 DISPLAY value: {display:?}"))?;
    let num_str = after_colon.split('.').next().unwrap_or("");
    if num_str.is_empty() || !num_str.bytes().all(|b| b.is_ascii_digit()) {
        return Err(format!("Invalid X11 DISPLAY number: {display:?}").into());
    }
    Ok(num_str.parse::<u32>()?)
}

pub struct X11Connection {
    stream: UnixStream,
}

impl X11Connection {
    pub fn connect(display: &str) -> Result<Self> {
        let number = parse_display_number(display)?;
        let path = format!("/tmp/.X11-unix/X{number}");
        let stream = match UnixStream::connect(&path) {
            Ok(stream) => stream,
            Err(error) => {
                #[cfg(target_os = "linux")]
                {
                    use std::os::linux::net::SocketAddrExt;
                    use std::os::unix::net::SocketAddr;
                    let abstract_addr = SocketAddr::from_abstract_name(&path)
                        .map_err(|_| format!("Cannot open private X display {display}: {error}"))?;
                    UnixStream::connect_addr(&abstract_addr)
                        .map_err(|e| format!("Cannot open private X display {display}: {e}"))?
                }
                #[cfg(not(target_os = "linux"))]
                {
                    return Err(format!("Cannot open private X display {display}: {error}").into());
                }
            }
        };
        Self::handshake(stream)
    }

    #[cfg(test)]
    pub fn connect_socket(path: &Path) -> Result<Self> {
        let stream = UnixStream::connect(path)?;
        Self::handshake(stream)
    }

    fn handshake(mut stream: UnixStream) -> Result<Self> {
        // X11 little-endian ('l') connection setup, protocol 11.0, no auth.
        let setup: [u8; 12] = [b'l', 0, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        stream.write_all(&setup)?;
        let mut header = [0u8; 8];
        stream.read_exact(&mut header)?;
        let extra_words = u16::from_le_bytes([header[6], header[7]]) as usize;
        let mut extra = vec![0u8; extra_words * 4];
        stream.read_exact(&mut extra)?;
        if header[0] != 1 {
            let reason_len = usize::from(header[1]).min(extra.len());
            let reason = String::from_utf8_lossy(&extra[..reason_len]);
            return Err(format!("X11 connection refused (status={}): {reason}", header[0]).into());
        }
        Ok(Self { stream })
    }

    pub fn change_keyboard_mapping(&mut self, keycode: u8, keysym: u32) -> Result<()> {
        let mut req = [0u8; 12];
        req[0] = X11_OP_CHANGE_KEYBOARD_MAPPING;
        req[1] = 1; // keycode_count
        req[2..4].copy_from_slice(&3u16.to_le_bytes()); // length in 4-byte units
        req[4] = keycode; // first_keycode
        req[5] = 1; // keysyms_per_keycode
        req[8..12].copy_from_slice(&keysym.to_le_bytes());
        self.stream.write_all(&req)?;
        Ok(())
    }

    pub fn query_extension(&mut self, name: &str) -> Result<Option<u8>> {
        let name_bytes = name.as_bytes();
        let pad = (4 - (name_bytes.len() % 4)) % 4;
        let words = 2 + (name_bytes.len() + pad) / 4;
        let mut req = Vec::with_capacity(words * 4);
        req.push(X11_OP_QUERY_EXTENSION);
        req.push(0);
        req.extend_from_slice(&(words as u16).to_le_bytes());
        req.extend_from_slice(&(name_bytes.len() as u16).to_le_bytes());
        req.extend_from_slice(&[0, 0]);
        req.extend_from_slice(name_bytes);
        req.resize(words * 4, 0);
        self.stream.write_all(&req)?;
        let reply = self.read_reply()?;
        Ok((reply[8] != 0).then_some(reply[9]))
    }

    pub fn fake_key_event(&mut self, xtest_opcode: u8, keycode: u8, press: bool) -> Result<()> {
        let mut req = [0u8; 36];
        req[0] = xtest_opcode;
        req[1] = XTEST_MINOR_FAKE_INPUT;
        req[2..4].copy_from_slice(&9u16.to_le_bytes());
        req[4] = if press {
            X11_KEY_PRESS
        } else {
            X11_KEY_RELEASE
        };
        req[5] = keycode;
        self.stream.write_all(&req)?;
        Ok(())
    }

    pub fn sync(&mut self) -> Result<()> {
        let req: [u8; 4] = [X11_OP_GET_INPUT_FOCUS, 0, 1, 0];
        self.stream.write_all(&req)?;
        let _ = self.read_reply()?;
        Ok(())
    }

    fn read_reply(&mut self) -> Result<[u8; 32]> {
        loop {
            let mut msg = [0u8; 32];
            self.stream.read_exact(&mut msg)?;
            match msg[0] {
                0 => {
                    return Err(format!(
                        "X11 protocol error: code={}, major={}, minor={}",
                        msg[1],
                        msg[10],
                        u16::from_le_bytes([msg[8], msg[9]])
                    )
                    .into());
                }
                1 => {
                    let extra_words = u32::from_le_bytes([msg[4], msg[5], msg[6], msg[7]]) as usize;
                    if extra_words > 0 {
                        let mut extra = vec![0u8; extra_words * 4];
                        self.stream.read_exact(&mut extra)?;
                    }
                    return Ok(msg);
                }
                _ => {
                    // Skip asynchronous X11 events (e.g. MappingNotify after ChangeKeyboardMapping).
                }
            }
        }
    }
}

pub fn preload_unicode_keysyms(display: &str, mappings: &[(u8, u32)]) -> Result<()> {
    let mut conn = X11Connection::connect(display)?;
    for &(code, symbol) in mappings {
        conn.change_keyboard_mapping(code, symbol)?;
    }
    conn.sync()
}

pub fn send_fake_key(display: &str, keycode: u8) -> Result<()> {
    let mut conn = X11Connection::connect(display)?;
    let opcode = conn
        .query_extension("XTEST")?
        .ok_or("Private X display does not expose XTEST extension")?;
    conn.fake_key_event(opcode, keycode, true)?;
    conn.fake_key_event(opcode, keycode, false)?;
    conn.sync()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::os::unix::net::UnixListener;

    #[test]
    fn parses_valid_display_strings() {
        assert_eq!(parse_display_number(":99").unwrap(), 99);
        assert_eq!(parse_display_number(":0.0").unwrap(), 0);
        assert_eq!(parse_display_number("unix:42.1").unwrap(), 42);
        assert!(parse_display_number("no-colon").is_err());
        assert!(parse_display_number(":abc").is_err());
    }

    #[test]
    fn encodes_keyboard_mapping_xtest_and_skips_mapping_notify() {
        let dir = tempfile::tempdir().unwrap();
        let sock_path = dir.path().join("Xtest");
        let listener = UnixListener::bind(&sock_path).unwrap();

        let server = std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            let mut setup = [0u8; 12];
            stream.read_exact(&mut setup).unwrap();
            assert_eq!(setup[0], b'l');
            assert_eq!(u16::from_le_bytes([setup[2], setup[3]]), 11);
            // Reply: success (1), 0 extra words.
            stream.write_all(&[1, 0, 11, 0, 0, 0, 0, 0]).unwrap();

            // Expect ChangeKeyboardMapping for (24, 0x010000e9).
            let mut map_req = [0u8; 12];
            stream.read_exact(&mut map_req).unwrap();
            assert_eq!(map_req[0], X11_OP_CHANGE_KEYBOARD_MAPPING);
            assert_eq!(map_req[1], 1);
            assert_eq!(u16::from_le_bytes([map_req[2], map_req[3]]), 3);
            assert_eq!(map_req[4], 24);
            assert_eq!(map_req[5], 1);
            assert_eq!(
                u32::from_le_bytes([map_req[8], map_req[9], map_req[10], map_req[11]]),
                0x0100_00e9
            );

            // Expect QueryExtension("XTEST").
            let mut ext_req = [0u8; 16];
            stream.read_exact(&mut ext_req).unwrap();
            assert_eq!(ext_req[0], X11_OP_QUERY_EXTENSION);
            assert_eq!(u16::from_le_bytes([ext_req[2], ext_req[3]]), 4);
            assert_eq!(u16::from_le_bytes([ext_req[4], ext_req[5]]), 5);
            assert_eq!(&ext_req[8..13], b"XTEST");

            // Send a MappingNotify event (type 34) before the QueryExtension reply.
            let mut event = [0u8; 32];
            event[0] = 34;
            stream.write_all(&event).unwrap();
            let mut ext_reply = [0u8; 32];
            ext_reply[0] = 1;
            ext_reply[8] = 1; // present = true
            ext_reply[9] = 132; // major_opcode
            stream.write_all(&ext_reply).unwrap();

            // Expect XTEST KeyPress + KeyRelease for keycode 24.
            for expected_type in [X11_KEY_PRESS, X11_KEY_RELEASE] {
                let mut fake = [0u8; 36];
                stream.read_exact(&mut fake).unwrap();
                assert_eq!(fake[0], 132);
                assert_eq!(fake[1], XTEST_MINOR_FAKE_INPUT);
                assert_eq!(u16::from_le_bytes([fake[2], fake[3]]), 9);
                assert_eq!(fake[4], expected_type);
                assert_eq!(fake[5], 24);
            }

            // Expect GetInputFocus sync.
            let mut focus = [0u8; 4];
            stream.read_exact(&mut focus).unwrap();
            assert_eq!(focus, [X11_OP_GET_INPUT_FOCUS, 0, 1, 0]);
            let mut focus_reply = [0u8; 32];
            focus_reply[0] = 1;
            stream.write_all(&focus_reply).unwrap();
        });

        let mut conn = X11Connection::connect_socket(&sock_path).unwrap();
        conn.change_keyboard_mapping(24, 0x0100_00e9).unwrap();
        let opcode = conn.query_extension("XTEST").unwrap().unwrap();
        assert_eq!(opcode, 132);
        conn.fake_key_event(opcode, 24, true).unwrap();
        conn.fake_key_event(opcode, 24, false).unwrap();
        conn.sync().unwrap();
        server.join().unwrap();
    }
}
