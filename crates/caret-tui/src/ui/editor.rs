use super::chrome::{button, column, tip};
use crate::{engine::EngineHost, setup::Setup, theme::Palette};
use ratatui::{
    Frame,
    layout::{Constraint, Layout, Rect},
    style::{Modifier, Style},
    text::{Line, Span},
    widgets::{Block, Paragraph},
};

/// Web custom text modal: option groups above a sub-alt text area.
pub(super) fn draw(
    frame: &mut Frame,
    area: Rect,
    host: &EngineHost,
    setup: &Setup,
    palette: &Palette,
) {
    let area = column(area, 100);
    let [title, options, _, text, _, hints] = Layout::vertical([
        Constraint::Length(1),
        Constraint::Length(1),
        Constraint::Length(1),
        Constraint::Fill(1),
        Constraint::Length(1),
        Constraint::Length(1),
    ])
    .areas(area);
    frame.render_widget(
        Paragraph::new(Line::from(vec![
            Span::styled(
                "custom text",
                Palette::fg(palette.text).add_modifier(Modifier::BOLD),
            ),
            Span::styled(
                "  private · type or paste · not saved unless replay recording is on",
                Palette::fg(palette.sub),
            ),
        ])),
        title,
    );
    let mut spans = vec![Span::styled("order ", Palette::fg(palette.sub))];
    for order in ["repeat", "random", "shuffle"] {
        spans.extend([button(palette, order, setup.order == order), Span::raw(" ")]);
    }
    spans.push(Span::styled("   limit ", Palette::fg(palette.sub)));
    for limit in ["section", "word", "time"] {
        spans.extend([button(palette, limit, setup.limit == limit), Span::raw(" ")]);
    }
    spans.extend([
        Span::styled("   length ", Palette::fg(palette.sub)),
        button(
            palette,
            &setup
                .length
                .map_or_else(|| "auto".into(), |v| v.to_string()),
            setup.length.is_some(),
        ),
    ]);
    frame.render_widget(Paragraph::new(Line::from(spans)), options);
    frame.render_widget(
        Block::default().style(Style::new().bg(palette.sub_alt)),
        text,
    );
    let inner = Rect {
        x: text.x + 1,
        width: text.width.saturating_sub(2),
        ..text
    };
    let view = crate::render::text_view(
        &typing_engine::Text::default(),
        &typing_engine::Text::from(setup.text.as_str()),
        &host.config.language,
        inner.width,
        inner.height,
    );
    frame.set_cursor_position((inner.x + view.caret.0, inner.y + view.caret.1));
    let lines: Vec<_> = view
        .lines
        .into_iter()
        .map(|line| line.style(Style::new().fg(palette.text)))
        .map(|mut line| {
            for span in &mut line.spans {
                span.style = Style::default();
            }
            line
        })
        .collect();
    frame.render_widget(
        Paragraph::new(lines).style(Style::new().bg(palette.sub_alt)),
        inner,
    );
    let mut spans = tip(palette, "F6", "order");
    for (label, action) in [
        ("F7", "limit"),
        ("F9", "length +1"),
        ("F8", "apply"),
        ("Esc", "cancel"),
    ] {
        spans.push(Span::raw("   "));
        spans.extend(tip(palette, label, action));
    }
    frame.render_widget(Paragraph::new(Line::from(spans)), hints);
}
