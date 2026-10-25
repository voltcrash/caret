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
impl Palette {
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
