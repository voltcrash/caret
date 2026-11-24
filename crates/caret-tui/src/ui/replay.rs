use super::chrome::{column, tip};
use crate::{local::Local, theme::Palette};
use ratatui::{
    Frame,
    layout::{Constraint, Layout, Rect},
    style::Modifier,
    text::{Line, Span},
    widgets::{Paragraph, Wrap},
};

/// Recorded replay: word stream in letter colours with step hints.
pub(super) fn draw(frame: &mut Frame, area: Rect, local: &Local, palette: &Palette) {
    let area = column(area, 100);
    let [_, title, _, words, _, hints, _] = Layout::vertical([
        Constraint::Fill(1),
        Constraint::Length(1),
        Constraint::Length(1),
        Constraint::Length(6),
        Constraint::Length(1),
        Constraint::Length(1),
        Constraint::Fill(2),
    ])
    .areas(area);
    let Some(replay) = &local.replay else {
        return;
    };
    let cursor = replay.frame.cursor;
    frame.render_widget(
        Paragraph::new(Line::from(vec![
            Span::styled(
                "watch replay",
                Palette::fg(palette.text).add_modifier(Modifier::BOLD),
            ),
            Span::styled(
                format!(
                    "  word {} · UTF-16 unit {} · step {}",
                    cursor.word_index, cursor.letter_index, replay.frame.next_index
                ),
                Palette::fg(palette.sub),
            ),
        ])),
        title,
    );
    frame.render_widget(
        Paragraph::new(replay.line(palette)).wrap(Wrap { trim: false }),
        words,
    );
    let mut spans = tip(palette, "→ / Space", "step");
    for (label, action) in [
        ("Home", "restart"),
        ("PgUp/PgDn", "seek word"),
        ("Esc", "history"),
    ] {
        spans.push(Span::raw("   "));
        spans.extend(tip(palette, label, action));
    }
    frame.render_widget(Paragraph::new(Line::from(spans)), hints);
}
