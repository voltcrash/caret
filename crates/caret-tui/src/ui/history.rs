use super::chrome::{column, tip};
use crate::{local::Local, theme::Palette};
use ratatui::{
    Frame,
    layout::{Alignment, Constraint, Layout, Rect},
    style::{Modifier, Style},
    text::{Line, Span},
    widgets::{Cell, Paragraph, Row, Table},
};

fn mode_label(config: &serde_json::Value) -> String {
    let mode = config["mode"].as_str().unwrap_or("unknown");
    match mode {
        "time" => format!("time {}", config["time"]),
        "words" => format!("words {}", config["words"]),
        _ => mode.to_string(),
    }
}

/// Web account history table: alternating sub-alt rows, PB crown, invalid rows in error.
pub(super) fn draw(frame: &mut Frame, area: Rect, local: &Local, palette: &Palette) {
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
