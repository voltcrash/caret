use super::Screen;
use crate::{local::Local, theme::Palette};
use ratatui::{
    Frame,
    layout::{Alignment, Constraint, Layout, Rect},
    style::{Modifier, Style},
    text::{Line, Span},
    widgets::Paragraph,
};

/// One web `<kbd>`: key text on the sub-alt chip.
pub(super) fn key(palette: &Palette, label: &str) -> Span<'static> {
    Span::styled(
        format!(" {label} "),
        Style::new().fg(palette.text).bg(palette.sub_alt),
    )
}

pub(super) fn tip(palette: &Palette, label: &str, action: &str) -> Vec<Span<'static>> {
    vec![
        key(palette, label),
        Span::styled(format!(" - {action}"), Palette::fg(palette.sub)),
    ]
}

/// Keytips fade while typing (and give way to result actions); notices and version stay.
pub(super) fn footer(
    frame: &mut Frame,
    area: Rect,
    palette: &Palette,
    notice: &str,
    focus: bool,
    unsaved: bool,
) {
    let area = column(area, 120);
    let [tips, _, status] = Layout::vertical([Constraint::Length(1); 3]).areas(area);
    let [status, version] =
        Layout::horizontal([Constraint::Min(1), Constraint::Length(10)]).areas(status);
    if !focus {
        // Retry outranks the rest; narrow footers drop trailing tips instead of clipping.
        let mut items = vec![
            ("F5", "restart test"),
            ("F6", "repeat test"),
            ("Ctrl+Q", "quit"),
        ];
        if unsaved {
            items.insert(0, ("F9", "retry saves"));
        }
        let mut spans = vec![];
        for (label, action) in items {
            let mut next = if spans.is_empty() {
                vec![]
            } else {
                vec![Span::raw("    ")]
            };
            next.extend(tip(palette, label, action));
            let width: usize = spans.iter().chain(&next).map(Span::width).sum();
            if width > tips.width as usize {
                break;
            }
            spans.extend(next);
        }
        frame.render_widget(
            Paragraph::new(Line::from(spans)).alignment(Alignment::Center),
            tips,
        );
    }
    let color = if notice.starts_with("UNSAVED") || notice.contains("failed") {
        palette.error
    } else {
        palette.main
    };
    frame.render_widget(
        Paragraph::new(Span::styled(notice.to_string(), Palette::fg(color))),
        status,
    );
    frame.render_widget(
        Paragraph::new(Span::styled(
            format!("v{}", env!("CARGO_PKG_VERSION")),
            Palette::fg(palette.sub),
        ))
        .alignment(Alignment::Right),
        version,
    );
}

/// Horizontal content column: web `content-grid` with a two-cell gutter.
pub(super) fn column(area: Rect, max: u16) -> Rect {
    let width = area.width.saturating_sub(4).min(max);
    Rect {
        x: area.x + (area.width - width) / 2,
        width,
        ..area
    }
}

/// Logo, theme indicator and nav. Nav fades while typing, as on the web.
pub(super) fn header(
    frame: &mut Frame,
    area: Rect,
    palette: &Palette,
    screen: Screen,
    local: &Local,
    focus: bool,
) {
    let area = column(area, 120);
    let [_, top, below] = Layout::vertical([Constraint::Length(1); 3]).areas(area);
    let mut logo = vec![
        Span::styled(
            "I ",
            Palette::fg(if focus { palette.text } else { palette.main })
                .add_modifier(Modifier::BOLD),
        ),
        Span::styled(
            "caret",
            Palette::fg(palette.text).add_modifier(Modifier::BOLD),
        ),
    ];
    if local.preferences.record_replay {
        logo.push(Span::styled(
            "  ● recording private text",
            Palette::fg(palette.error),
        ));
    }
    if !local.pending.is_empty() {
        logo.push(Span::styled(
            format!("  {} unsaved", local.pending.len()),
            Palette::fg(palette.error),
        ));
    }
    let logo = Line::from(logo);
    let room = (top.width as usize).saturating_sub(logo.width() + 2);
    frame.render_widget(Paragraph::new(logo), top);
    if focus {
        return;
    }
    frame.render_widget(
        Paragraph::new(Span::styled(
            format!("  {}", local.preferences.theme.replace('_', " ")),
            Palette::fg(palette.sub),
        )),
        below,
    );
    let nav = |keys: bool| -> Line<'static> {
        let spans: Vec<_> = [
            (Screen::Help, "F1", "help"),
            (Screen::Settings, "F2", "settings"),
            (Screen::History, "F3", "history"),
            (Screen::Editor, "F4", "custom"),
        ]
        .into_iter()
        .flat_map(|(target, key, label)| {
            let color = if target == screen {
                palette.main
            } else {
                palette.sub
            };
            [
                Span::styled(
                    if keys {
                        format!("   {key} ")
                    } else {
                        "  ".into()
                    },
                    Palette::fg(palette.sub).add_modifier(Modifier::DIM),
                ),
                Span::styled(label, Style::new().fg(color)),
            ]
        })
        .collect();
        Line::from(spans)
    };
    // Narrow terminals drop the F-key prefixes, then the nav, before overlapping the logo.
    let Some(nav) = [nav(true), nav(false)]
        .into_iter()
        .find(|line| line.width() <= room)
    else {
        return;
    };
    frame.render_widget(Paragraph::new(nav).alignment(Alignment::Right), top);
}

/// Web test config: punctuation/numbers, modes, then the active mode's presets.
pub(super) fn config_bar(
    palette: &Palette,
    config: &typing_engine::Config,
    toggles: bool,
    amounts: bool,
) -> Line<'static> {
    let on = |active: bool| Palette::fg(if active { palette.main } else { palette.sub });
    let gap = || Span::raw("  ");
    let divider = || Span::styled("  │  ", Palette::fg(palette.bg));
    let mut spans = vec![Span::raw("  ")];
    if toggles && matches!(config.mode.as_str(), "time" | "words") {
        spans.extend([
            Span::styled("@ punctuation", on(config.punctuation)),
            gap(),
            Span::styled("# numbers", on(config.numbers)),
            divider(),
        ]);
    }
    for (index, mode) in ["time", "words", "quote", "zen", "custom"]
        .iter()
        .enumerate()
    {
        if index > 0 {
            spans.push(gap());
        }
        spans.push(Span::styled(*mode, on(config.mode == *mode)));
    }
    let presets: Vec<(String, bool)> = match config.mode.as_str() {
        "time" => [15.0, 30.0, 60.0, 120.0]
            .iter()
            .map(|t| (t.to_string(), config.time == *t))
            .collect(),
        "words" => [10, 25, 50, 100]
            .iter()
            .map(|w| (w.to_string(), config.words == *w))
            .collect(),
        "quote" => ["short", "medium", "long", "thicc"]
            .iter()
            .enumerate()
            .map(|(group, name)| {
                (
                    name.to_string(),
                    config.quote_length.contains(&(group as i32)),
                )
            })
            .collect(),
        _ => vec![],
    };
    if amounts && !presets.is_empty() {
        spans.push(divider());
        let custom = !presets.iter().any(|(_, active)| *active);
        for (index, (label, active)) in presets.into_iter().enumerate() {
            if index > 0 {
                spans.push(gap());
            }
            spans.push(Span::styled(label, on(active)));
        }
        if config.mode != "quote" {
            spans.extend([gap(), Span::styled("⚙", on(custom))]);
        }
    }
    spans.push(Span::raw("  "));
    Line::from(spans).style(Style::new().bg(palette.sub_alt))
}

/// Label over value, as in the web result's small stat groups.
pub(super) fn stat(label: &str, value: Vec<Line<'static>>, palette: &Palette) -> Paragraph<'static> {
    let mut lines = vec![Line::styled(label.to_string(), Palette::fg(palette.sub))];
    lines.extend(
        value
            .into_iter()
            .map(|line| line.patch_style(Palette::fg(palette.main))),
    );
    Paragraph::new(lines)
}

pub(super) fn big(label: &str, value: &str, palette: &Palette) -> Paragraph<'static> {
    let rows = crate::bignum::rows(value)
        .map(Vec::from)
        .unwrap_or_else(|| vec![value.to_string()]);
    stat(label, rows.into_iter().map(Line::from).collect(), palette)
}

/// One web button: active uses main on bg, others text on sub-alt.
pub(super) fn button(palette: &Palette, label: &str, active: bool) -> Span<'static> {
    let style = if active {
        Style::new().fg(palette.bg).bg(palette.main)
    } else {
        Style::new().fg(palette.text).bg(palette.sub_alt)
    };
    Span::styled(format!(" {label} "), style)
}
