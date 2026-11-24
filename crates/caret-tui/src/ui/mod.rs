//! Screen composition. Imperative work stays in the terminal; this only paints frames.
mod chart;
mod chrome;
mod help;
mod history;
mod result;
mod settings;
mod test;

use chrome::{button, column, footer, header, tip};
use crate::theme::Palette;
use crate::{engine::EngineHost, local::Local, setup::Setup};
use ratatui::{
    Frame,
    layout::{Alignment, Constraint, Layout, Rect},
    style::{Modifier, Style},
    text::{Line, Span},
    widgets::{Block, Paragraph, Wrap},
};

#[derive(Clone, Copy, PartialEq)]
pub enum Screen {
    Test,
    Help,
    Settings,
    History,
    Editor,
    Replay,
}
pub struct View<'a> {
    pub screen: Screen,
    pub notice: &'a str,
    pub local: &'a Local,
    pub setup: &'a Setup,
    pub capabilities: &'a crate::input::Capabilities,
    /// From `theme::truecolor()`; false downgrades RGB palettes to xterm-256.
    pub truecolor: bool,
}
pub fn draw(frame: &mut Frame, host: &EngineHost, now: f64, view: View<'_>) {
    let View {
        screen,
        notice,
        local,
        setup,
        capabilities,
        truecolor,
    } = view;
    let area = frame.area();
    // Settings preview the drafted theme before it is applied, as the web does.
    let palette = Palette::named(if screen == Screen::Settings {
        &setup.theme
    } else {
        &local.preferences.theme
    })
    .adapt(truecolor);
    frame.render_widget(Block::default().style(palette.base()), area);
    if area.width < 60 || area.height < 18 {
        // Mirrors the web's centred notices: headline in main, detail in sub.
        let lines = vec![
            Line::styled("terminal too small", Palette::fg(palette.main)),
            Line::styled(
                format!(
                    "resize to at least 60×18 (now {}×{})",
                    area.width, area.height
                ),
                Palette::fg(palette.text),
            ),
            Line::styled(
                "Active test clock continues. Ctrl+Q quits.",
                Palette::fg(palette.sub),
            ),
        ];
        let [_, middle, _] = Layout::vertical([
            Constraint::Fill(1),
            Constraint::Length(4),
            Constraint::Fill(1),
        ])
        .areas(area);
        frame.render_widget(
            Paragraph::new(lines)
                .alignment(Alignment::Center)
                .wrap(Wrap { trim: true }),
            middle,
        );
        return;
    }
    let rows = Layout::vertical([
        Constraint::Length(3),
        Constraint::Min(5),
        Constraint::Length(3),
    ])
    .split(area);
    let state = host.state();
    header(frame, rows[0], &palette, screen, local, state.active);
    let quiet = state.active || (screen == Screen::Test && state.ended);
    match screen {
        Screen::Test if state.ended => result::draw(frame, rows[1], host, local, &palette),
        Screen::Test => test::draw(frame, rows[1], host, now, &palette),
        Screen::Settings => settings::draw(frame, rows[1], setup, &palette),
        Screen::History => history::draw(frame, rows[1], local, &palette),
        Screen::Help => help::draw(frame, rows[1], capabilities, &palette),
        Screen::Editor => editor(frame, rows[1], host, setup, &palette),
        Screen::Replay => replay(frame, rows[1], local, &palette),
    }
    footer(
        frame,
        rows[2],
        &palette,
        notice,
        quiet,
        !local.pending.is_empty(),
    );
}
/// Web custom text modal: option groups above a sub-alt text area.
fn editor(frame: &mut Frame, area: Rect, host: &EngineHost, setup: &Setup, palette: &Palette) {
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
/// Recorded replay: word stream in letter colours with step hints.
fn replay(frame: &mut Frame, area: Rect, local: &Local, palette: &Palette) {
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
