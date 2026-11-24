use super::chrome::{column, tip};
use crate::{input::Capabilities, theme::Palette};
use ratatui::{
    Frame,
    layout::{Constraint, Layout, Rect},
    style::Modifier,
    text::{Line, Span},
    widgets::Paragraph,
};

/// Keybind reference grouped like web keytips, plus negotiated terminal capabilities.
pub(super) fn draw(frame: &mut Frame, area: Rect, capabilities: &Capabilities, palette: &Palette) {
    let area = column(area, 100);
    let groups: [(&str, &[(&str, &str)]); 4] = [
        (
            "test",
            &[
                ("F5", "new test"),
                ("F6", "repeat test"),
                ("F8 / Ctrl+Enter", "finish test"),
                ("Backspace", "delete letter"),
                ("Ctrl/Alt+Backspace", "delete word"),
            ],
        ),
        (
            "screens",
            &[
                ("F1", "help"),
                ("F2", "settings"),
                ("F3", "history"),
                ("F4", "custom text"),
                ("Esc", "back to test"),
            ],
        ),
        (
            "results",
            &[
                ("F9", "retry unsaved results"),
                ("F7", "export (history)"),
                ("F8", "replay (history)"),
            ],
        ),
        (
            "terminal",
            &[
                ("Ctrl+Q / Ctrl+C / F10", "quit"),
                ("Ctrl+Z", "suspend (Unix)"),
            ],
        ),
    ];
    let section = |name: &str| {
        Line::styled(
            format!("▸ {name}"),
            Palette::fg(palette.sub).add_modifier(Modifier::BOLD),
        )
    };
    let mut left = vec![];
    let mut right = vec![];
    for (index, (name, keys)) in groups.iter().enumerate() {
        let side = if index % 2 == 0 {
            &mut left
        } else {
            &mut right
        };
        side.push(section(name));
        for (label, action) in *keys {
            side.push(Line::from(tip(palette, label, action)));
        }
        side.push(Line::default());
    }
    let keyboard = if capabilities.enhanced_keyboard_negotiated {
        "enhanced"
    } else {
        "basic"
    };
    let yes = |on: bool| if on { "yes" } else { "no" };
    let info = vec![
        section("keyboard"),
        Line::from(vec![
            Span::styled("protocol ", Palette::fg(palette.sub)),
            Span::styled(keyboard, Palette::fg(palette.main)),
            Span::styled("   release observed ", Palette::fg(palette.sub)),
            Span::styled(
                yes(capabilities.release_observed),
                Palette::fg(palette.main),
            ),
            Span::styled("   repeat observed ", Palette::fg(palette.sub)),
            Span::styled(yes(capabilities.repeat_observed), Palette::fg(palette.main)),
        ]),
        Line::styled(
            "Physical-key timing is unavailable; no key releases are invented.",
            Palette::fg(palette.sub),
        ),
    ];
    let height = left.len().max(right.len()) as u16;
    let [_, keys, notes, _] = Layout::vertical([
        Constraint::Fill(1),
        Constraint::Length(height),
        Constraint::Length(3),
        Constraint::Fill(1),
    ])
    .areas(area);
    let [l, r] = Layout::horizontal([Constraint::Fill(1); 2]).areas(keys);
    frame.render_widget(Paragraph::new(left), l);
    frame.render_widget(Paragraph::new(right), r);
    frame.render_widget(Paragraph::new(info), notes);
}
