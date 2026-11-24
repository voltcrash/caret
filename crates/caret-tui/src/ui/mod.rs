//! Screen composition. Imperative work stays in the terminal; this only paints frames.
mod chart;
mod chrome;
mod result;
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
        Screen::Settings => settings(frame, rows[1], setup, &palette),
        Screen::History => history(frame, rows[1], local, &palette),
        Screen::Help => help(frame, rows[1], capabilities, &palette),
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
/// Web settings page: section headings, labels left, button groups right.
fn settings(frame: &mut Frame, area: Rect, setup: &Setup, palette: &Palette) {
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
fn mode_label(config: &serde_json::Value) -> String {
    let mode = config["mode"].as_str().unwrap_or("unknown");
    match mode {
        "time" => format!("time {}", config["time"]),
        "words" => format!("words {}", config["words"]),
        _ => mode.to_string(),
    }
}
/// Web account history table: alternating sub-alt rows, PB crown, invalid rows in error.
fn history(frame: &mut Frame, area: Rect, local: &Local, palette: &Palette) {
    use ratatui::widgets::{Cell, Row, Table};
    let history = &local.history;
    let area = column(area, 110);
    let [title, hints, _, list] = Layout::vertical([
        Constraint::Length(1),
        Constraint::Length(1),
        Constraint::Length(1),
        Constraint::Fill(1),
    ])
    .areas(area);
    frame.render_widget(
        Paragraph::new(Line::from(vec![
            Span::styled(
                "Local history",
                Palette::fg(palette.text).add_modifier(Modifier::BOLD),
            ),
            Span::styled(
                format!(
                    "  {} · page {}",
                    history.mode().unwrap_or("all modes"),
                    history.page_number()
                ),
                Palette::fg(palette.sub),
            ),
        ])),
        title,
    );
    let mut spans = tip(palette, "↑↓", "select");
    for (label, action) in [
        ("Enter", "details"),
        ("m", "filter"),
        ("PgUp/PgDn", "page"),
        ("F7", "export"),
        ("F8", "replay"),
    ] {
        spans.push(Span::raw("   "));
        spans.extend(tip(palette, label, action));
    }
    frame.render_widget(Paragraph::new(Line::from(spans)), hints);
    if history.details {
        let details = history
            .current()
            .and_then(|row| serde_json::to_string_pretty(row).ok())
            .unwrap_or_default();
        let lines: Vec<_> = details
            .lines()
            .skip(history.scroll)
            .map(|line| match line.split_once(": ") {
                Some((key, value)) => Line::from(vec![
                    Span::styled(format!("{key}: "), Palette::fg(palette.sub)),
                    Span::styled(value.to_string(), Palette::fg(palette.text)),
                ]),
                None => Line::styled(line.to_string(), Palette::fg(palette.sub)),
            })
            .collect();
        frame.render_widget(Paragraph::new(lines), list);
        return;
    }
    if history.rows.is_empty() {
        frame.render_widget(
            Paragraph::new(Span::styled(
                "No saved results for this filter.",
                Palette::fg(palette.sub),
            ))
            .alignment(Alignment::Center),
            list,
        );
        return;
    }
    let header = Row::new(
        [
            "",
            "wpm",
            "raw",
            "accuracy",
            "consistency",
            "chars",
            "mode",
            "info",
            "date",
        ]
        .map(|h| Cell::from(h).style(Palette::fg(palette.sub))),
    );
    let visible = list.height.saturating_sub(1).max(1) as usize;
    let skip = history.selected.saturating_sub(visible - 1);
    let rows = history
        .rows
        .iter()
        .enumerate()
        .skip(skip)
        .take(visible)
        .map(|(index, row)| {
            let summary = &row["summary"];
            let number = |key: &str, suffix: &str| {
                summary[key]
                    .as_f64()
                    .map_or("-".into(), |v| format!("{v:.2}{suffix}"))
            };
            let chars = summary["charStats"]
                .as_array()
                .map(|c| {
                    c.iter()
                        .map(|v| v.to_string())
                        .collect::<Vec<_>>()
                        .join("/")
                })
                .unwrap_or_else(|| "-".into());
            let (info, invalid) = if row["formatVersion"] != 1 {
                ("unknown format".to_string(), true)
            } else {
                match row["invalidReason"].as_str() {
                    Some(reason) => (reason.to_string(), true),
                    None => (String::new(), false),
                }
            };
            let selected = index == history.selected;
            let crown = if history.best(row) { "♛" } else { "" };
            let mut style = Style::new().fg(if invalid { palette.error } else { palette.text });
            if index % 2 == 0 {
                style = style.bg(palette.sub_alt);
            }
            if selected {
                style = style.fg(palette.main).add_modifier(Modifier::BOLD);
            }
            Row::new([
                Cell::from(Span::styled(crown, Palette::fg(palette.main))),
                Cell::from(number("wpm", "")),
                Cell::from(number("rawWpm", "")),
                Cell::from(number("acc", "%")),
                Cell::from(number("consistency", "%")),
                Cell::from(chars),
                Cell::from(mode_label(&row["config"])),
                Cell::from(info),
                Cell::from(
                    row["createdMs"]
                        .as_f64()
                        .map_or("-".into(), crate::history::date),
                ),
            ])
            .style(style)
        });
    let table = Table::new(
        rows,
        [
            Constraint::Length(2),
            Constraint::Length(8),
            Constraint::Length(8),
            Constraint::Length(9),
            Constraint::Length(12),
            Constraint::Length(13),
            Constraint::Length(10),
            Constraint::Fill(1),
            Constraint::Length(18),
        ],
    )
    .header(header);
    frame.render_widget(table, list);
}
/// Keybind reference grouped like web keytips, plus negotiated terminal capabilities.
fn help(
    frame: &mut Frame,
    area: Rect,
    capabilities: &crate::input::Capabilities,
    palette: &Palette,
) {
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
