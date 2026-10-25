//! Web theme palettes (`packages/web-shared/src/themes.ts`) projected onto cells.
use ratatui::style::{Color, Style};

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Palette {
    pub bg: Color,
    pub main: Color,
    pub caret: Color,
    pub sub: Color,
    pub sub_alt: Color,
    pub text: Color,
    pub error: Color,
    pub error_extra: Color,
}
const fn rgb(hex: u32) -> Color {
    Color::Rgb((hex >> 16) as u8, (hex >> 8) as u8, hex as u8)
}
/// Web order: bg, main, caret, sub, subAlt, text, error, errorExtra.
const fn web([bg, main, caret, sub, sub_alt, text, error, error_extra]: [u32; 8]) -> Palette {
    Palette {
        bg: rgb(bg),
        main: rgb(main),
        caret: rgb(caret),
        sub: rgb(sub),
        sub_alt: rgb(sub_alt),
        text: rgb(text),
        error: rgb(error),
        error_extra: rgb(error_extra),
    }
}
pub const DEFAULT: &str = "rust";
/// Name order is the settings cycle order. `terminal` keeps the user's ANSI colors.
pub const THEMES: &[(&str, Palette)] = &[
    (
        "rust",
        web([
            0x180d0d, 0xe8692e, 0xe8692e, 0x9c867a, 0x271616, 0xf3e7dc, 0xff4d6d, 0xb8344f,
        ]),
    ),
    (
        "serika_dark",
        web([
            0x323437, 0xe2b714, 0xe2b714, 0x646669, 0x2c2e31, 0xd1d0c5, 0xca4754, 0x7e2a33,
        ]),
    ),
    (
        "carbon",
        web([
            0x313131, 0xf66e0d, 0xf66e0d, 0x616161, 0x2b2b2b, 0xf5e6c8, 0xe72d2d, 0x7e2a33,
        ]),
    ),
    (
        "nord",
        web([
            0x242933, 0x88c0d0, 0xeceff4, 0x929aaa, 0x2e3440, 0xd8dee9, 0xbf616a, 0x793e44,
        ]),
    ),
    (
        "dracula",
        web([
            0x282a36, 0xbd93f9, 0xbd93f9, 0x6272a4, 0x20222c, 0xf8f8f2, 0xff5555, 0xf1fa8c,
        ]),
    ),
    (
        "catppuccin",
        web([
            0x1e1e2e, 0xcba6f7, 0xf2cdcd, 0x7f849c, 0x181825, 0xcdd6f4, 0xf38ba8, 0xeba0ac,
        ]),
    ),
    (
        "gruvbox_dark",
        web([
            0x282828, 0xd79921, 0xfabd2f, 0x665c54, 0x212121, 0xebdbb2, 0xfb4934, 0xcc241d,
        ]),
    ),
    (
        "light",
        web([
            0xe1e1e3, 0xe2b714, 0xe2b714, 0xaaaeb3, 0xd1d3d8, 0x323437, 0xda3333, 0x791717,
        ]),
    ),
    (
        "high-contrast",
        Palette {
            bg: Color::Black,
            main: Color::Yellow,
            caret: Color::Yellow,
            sub: Color::Gray,
            sub_alt: Color::DarkGray,
            text: Color::White,
            error: Color::LightRed,
            error_extra: Color::Red,
        },
    ),
    (
        "terminal",
        Palette {
            bg: Color::Reset,
            main: Color::Yellow,
            caret: Color::Yellow,
            sub: Color::DarkGray,
            sub_alt: Color::Black,
            text: Color::Reset,
            error: Color::Red,
            error_extra: Color::LightRed,
        },
    ),
];
pub fn names() -> Vec<&'static str> {
    THEMES.iter().map(|(name, _)| *name).collect()
}
pub fn known(name: &str) -> bool {
    THEMES.iter().any(|(n, _)| *n == name)
}
/// Whether the terminal advertises 24-bit colour (`COLORTERM`), as most modern emulators do.
pub fn truecolor() -> bool {
    std::env::var("COLORTERM").is_ok_and(|v| matches!(v.as_str(), "truecolor" | "24bit"))
}
/// Nearest xterm-256 index: 6×6×6 cube or the 24-step grey ramp, whichever is closer.
pub fn indexed(color: Color) -> Color {
    let Color::Rgb(r, g, b) = color else {
        return color;
    };
    const LEVELS: [u8; 6] = [0, 95, 135, 175, 215, 255];
    let level = |v: u8| {
        (0..6)
            .min_by_key(|&i| (i32::from(LEVELS[i]) - i32::from(v)).abs())
            .unwrap_or(0)
    };
    let (ri, gi, bi) = (level(r), level(g), level(b));
    let cube = (LEVELS[ri], LEVELS[gi], LEVELS[bi]);
    let average = (u16::from(r) + u16::from(g) + u16::from(b)) / 3;
    let grey_index = (average.saturating_sub(3) / 10).min(23) as u8;
    let grey = 8 + 10 * grey_index;
    let distance = |(x, y, z): (u8, u8, u8)| {
        [(x, r), (y, g), (z, b)]
            .iter()
            .map(|(a, b)| (i32::from(*a) - i32::from(*b)).pow(2))
            .sum::<i32>()
    };
    if distance((grey, grey, grey)) < distance(cube) {
        Color::Indexed(232 + grey_index)
    } else {
        Color::Indexed(16 + 36 * ri as u8 + 6 * gi as u8 + bi as u8)
    }
}
impl Palette {
    /// Downgrade RGB to xterm-256 for terminals without truecolor.
    pub fn adapt(self, truecolor: bool) -> Self {
        if truecolor {
            return self;
        }
        Self {
            bg: indexed(self.bg),
            main: indexed(self.main),
            caret: indexed(self.caret),
            sub: indexed(self.sub),
            sub_alt: indexed(self.sub_alt),
            text: indexed(self.text),
            error: indexed(self.error),
            error_extra: indexed(self.error_extra),
        }
    }
    pub fn named(name: &str) -> Self {
        THEMES
            .iter()
            .find(|(n, _)| *n == name)
            .unwrap_or(&THEMES[0])
            .1
    }
    pub fn base(&self) -> Style {
        Style::new().fg(self.text).bg(self.bg)
    }
    pub fn fg(color: Color) -> Style {
        Style::new().fg(color)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn indexed_picks_cube_or_grey_ramp() {
        assert_eq!(indexed(Color::Rgb(255, 0, 0)), Color::Indexed(196));
        assert_eq!(indexed(Color::Rgb(0, 0, 0)), Color::Indexed(16));
        assert_eq!(indexed(Color::Rgb(128, 128, 128)), Color::Indexed(244));
        assert_eq!(indexed(Color::Yellow), Color::Yellow);
        let rust = Palette::named("rust").adapt(false);
        assert!(matches!(rust.main, Color::Indexed(_)));
        assert_eq!(Palette::named("rust").adapt(true), Palette::named("rust"));
    }
}
