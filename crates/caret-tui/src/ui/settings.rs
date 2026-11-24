use super::chrome::{button, column, tip};
use crate::{setup::Setup, theme::Palette};
use ratatui::{
    Frame,
    layout::{Constraint, Layout, Rect},
    style::Modifier,
    text::{Line, Span},
    widgets::Paragraph,
};

/// Web settings page: section headings, labels left, button groups right.
pub(super) fn draw(frame: &mut Frame, area: Rect, setup: &Setup, palette: &Palette) {
    let area = column(area, 100);
    let [hints, _, list] = Layout::vertical([
        Constraint::Length(1),
        Constraint::Length(1),
        Constraint::Fill(1),
    ])
    .areas(area);
    let mut spans = tip(palette, "↑↓", "select");
    for (label, action) in [
        ("←→", "change"),
        ("Enter", "apply"),
        ("F4", "custom text"),
        ("Esc", "cancel"),
    ] {
        spans.push(Span::raw("   "));
        spans.extend(tip(palette, label, action));
    }
    frame.render_widget(Paragraph::new(Line::from(spans)), hints);
    let label_width = 22;
    let room = (list.width as usize).saturating_sub(label_width + 2);
    let mut lines = vec![];
    let mut selected_line = 0;
    for (index, row) in setup.rows().into_iter().enumerate() {
        if let Some(section) = row.section {
            if !lines.is_empty() {
                lines.push(Line::default());
            }
            lines.push(Line::styled(
                format!("▸ {section}"),
                Palette::fg(palette.sub).add_modifier(Modifier::BOLD),
            ));
        }
        let selected = index == setup.selected;
        if selected {
            selected_line = lines.len();
        }
        let mut spans = vec![
            Span::styled(
                if selected { "› " } else { "  " },
                Palette::fg(palette.main),
            ),
            Span::styled(
                format!("{:<width$}", row.label, width = label_width - 2),
                Palette::fg(if selected { palette.text } else { palette.sub }),
            ),
        ];
        let width: usize = row.options.iter().map(|o| o.chars().count() + 3).sum();
        if row.options.len() == 1 || width > room {
            // Too wide for a group (or a free value): show the current choice with arrows.
            spans.extend([
                Span::styled("‹ ", Palette::fg(palette.sub)),
                button(palette, &row.options[row.active], row.options.len() > 1),
                Span::styled(" ›", Palette::fg(palette.sub)),
            ]);
        } else {
            for (option, label) in row.options.iter().enumerate() {
                spans.push(button(palette, label, option == row.active));
                spans.push(Span::raw(" "));
            }
        }
        if let Some(note) = row.note {
            spans.push(Span::styled(
                format!("  {note}"),
                Palette::fg(palette.error),
            ));
        }
        lines.push(Line::from(spans));
    }
    let visible = list.height as usize;
    let skip = selected_line.saturating_sub(visible.saturating_sub(2));
    frame.render_widget(Paragraph::new(lines).scroll((skip as u16, 0)), list);
}
