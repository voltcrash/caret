//! VT100 screen text extraction for PTY and emulator assertions.

use std::num::NonZeroU16;

const DEFAULT_ROWS: u16 = 100;
const DEFAULT_COLS: u16 = 200;

/// Parse a raw terminal byte stream with `vt100` and return visible screen text.
///
/// Uses a 100x200 virtual grid matching the legacy harness dimensions so
/// incremental Ratatui frames (which skip unchanged cells via cursor moves) and
/// mixed-size resize traces preserve all rendered text without line clipping.
pub fn screen_text(output: &[u8]) -> String {
    let mut parser = vt100::Parser::new(
        NonZeroU16::new(DEFAULT_ROWS).expect("non-zero rows"),
        NonZeroU16::new(DEFAULT_COLS).expect("non-zero cols"),
        0,
    );
    parser.process(output);
    parser.screen().contents()
}

#[cfg(test)]
mod tests {
    use super::screen_text;

    #[test]
    fn preserves_cursor_addressed_incremental_updates() {
        let mut bytes = Vec::new();
        bytes.extend_from_slice(b"\x1b[?1049h\x1b[2J\x1b[1;1Hquote  zen  custom");
        bytes.extend_from_slice(b"\x1b[3;5Hcaret");
        let text = screen_text(&bytes);
        assert!(text.contains("quote  zen  custom"), "{text:?}");
        assert!(text.contains("caret"), "{text:?}");
    }

    #[test]
    fn preserves_combining_cjk_and_emoji_clusters() {
        let input = "\x1b[?1049h\x1b[2J\x1b[1;1HAB!e\u{0301}界😀";
        let text = screen_text(input.as_bytes());
        assert!(text.contains("AB!e\u{0301}界😀"), "{text:?}");
    }

    #[test]
    fn respects_erase_in_line_and_display() {
        let input = b"\x1b[?1049h\x1b[1;1Hhello world\x1b[1;7H\x1b[0Kcaret";
        let text = screen_text(input);
        assert!(text.contains("hello caret"), "{text:?}");
        assert!(!text.contains("world"), "{text:?}");

        let cleared = b"\x1b[?1049h\x1b[1;1Hstale\x1b[2J\x1b[1;1Hfresh";
        let cleared_text = screen_text(cleared);
        assert!(cleared_text.contains("fresh"), "{cleared_text:?}");
        assert!(!cleared_text.contains("stale"), "{cleared_text:?}");
    }
}
