//! Screen composition. Imperative work stays in the terminal; this only paints frames.
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
}
pub fn draw(frame: &mut Frame, host: &EngineHost, now: f64, view: View<'_>) {
    let View {
        screen,
        notice,
        local,
        setup,
        capabilities,
    } = view;
    let area = frame.area();
    let palette = crate::theme::Palette::named(&local.preferences.theme);
    frame.render_widget(Block::default().style(palette.base()), area);
    if area.width < 60 || area.height < 18 {
        frame.render_widget(
            Paragraph::new("Resize to at least 60×18. Active test clock continues. Ctrl+Q quits."),
            area,
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
    if screen == Screen::Test && !state.ended {
        test(frame, rows[1], host, now, &palette);
        footer(
            frame,
            rows[2],
            &palette,
            notice,
            state.active,
            !local.pending.is_empty(),
        );
        return;
    }
    let body = match screen {
        Screen::Help => vec![
            Line::from("F5 new · F6 repeat · F2 settings · F3 history · F4 custom · Esc return"),
            Line::from("F8 finish · Backspace delete · Ctrl/Alt+Backspace delete word"),
            Line::from("Ctrl+Q / Ctrl+C quit · Ctrl+Z suspend (Unix)"),
            Line::from("Physical-key timing is unavailable; no key releases are invented."),
            Line::from(format!(
                "Keyboard: {} · release observed: {} · repeat observed: {}",
                if capabilities.enhanced_keyboard_negotiated {
                    "enhanced"
                } else {
                    "basic"
                },
                capabilities.release_observed,
                capabilities.repeat_observed
            )),
        ],
        Screen::Settings => {
            let lines = setup.lines();
            let visible = rows[1].height.saturating_sub(3) as usize;
            let skip = setup.selected.saturating_sub(visible.saturating_sub(1));
            std::iter::once(lines[0].clone())
                .chain(lines.into_iter().skip(skip + 1).take(visible))
                .collect()
        }
        Screen::Editor => {
            let mut lines = setup.editor_lines();
            for line in &mut lines {
                *line = Line::from(crate::render::clip_cells(
                    &line.to_string(),
                    rows[1].width.saturating_sub(2) as usize,
                ));
            }
            let input = typing_engine::Text::from(setup.text.as_str());
            let mut view = crate::render::text_view(
                &typing_engine::Text::default(),
                &input,
                &host.config.language,
                rows[1].width.saturating_sub(2),
                rows[1].height.saturating_sub(4),
            );
            frame.set_cursor_position((
                rows[1].x + 1 + view.caret.0,
                rows[1].y + 1 + lines.len() as u16 + view.caret.1,
            ));
            for line in &mut view.lines {
                for span in &mut line.spans {
                    span.style = ratatui::style::Style::default();
                }
            }
            lines.extend(view.lines);
            lines
        }
        Screen::Replay => local.replay.as_ref().map(|r| r.lines()).unwrap_or_default(),
        Screen::History => local
            .history
            .lines(&local.store, rows[1].height.saturating_sub(2) as usize),
        Screen::Test if state.ended => vec![
            Line::from(host.result.as_ref().map_or_else(
                || {
                    host.result_error
                        .clone()
                        .unwrap_or_else(|| "Test ended".into())
                },
                |score| {
                    format!(
                        "{:.1} WPM · {:.1}% accuracy · {:.2}s",
                        score.wpm, score.acc, score.test_duration
                    )
                },
            )),
            Line::from(state.reason.unwrap_or_else(|| {
                if host.log().is_ok_and(|log| log.context.bailed_out) {
                    "Finished manually".into()
                } else {
                    "Completed".into()
                }
            })),
            Line::from(
                local
                    .latest_result
                    .as_ref()
                    .map(|r| {
                        format!(
                            "Local validity: {}",
                            r["invalidReason"].as_str().unwrap_or("valid")
                        )
                    })
                    .unwrap_or_else(|| "Preparing local result…".into()),
            ),
            Line::from("F5 new test · F6 repeat"),
        ],
        // Drawn by `test` before the bordered fallback.
        Screen::Test => vec![],
    };
    frame.render_widget(
        Paragraph::new(body)
            .wrap(Wrap { trim: false })
            .block(Block::bordered()),
        rows[1],
    );
    footer(
        frame,
        rows[2],
        &palette,
        notice,
        state.active,
        !local.pending.is_empty(),
    );
}
/// One web `<kbd>`: key text on the sub-alt chip.
fn key(palette: &Palette, label: &str) -> Span<'static> {
    Span::styled(
        format!(" {label} "),
        Style::new().fg(palette.text).bg(palette.sub_alt),
    )
}
fn tip(palette: &Palette, label: &str, action: &str) -> Vec<Span<'static>> {
    vec![
        key(palette, label),
        Span::styled(format!(" - {action}"), Palette::fg(palette.sub)),
    ]
}
/// Keytips fade while typing; notices and version stay, like the web footer.
fn footer(
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
        let mut spans = tip(palette, "F5", "restart test");
        spans.push(Span::raw("    "));
        spans.extend(tip(palette, "F6", "repeat test"));
        spans.push(Span::raw("    "));
        spans.extend(tip(palette, "Ctrl+Q", "quit"));
        if unsaved {
            spans.push(Span::raw("    "));
            spans.extend(tip(palette, "F9", "retry saves"));
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
fn column(area: Rect, max: u16) -> Rect {
    let width = area.width.saturating_sub(4).min(max);
    Rect {
        x: area.x + (area.width - width) / 2,
        width,
        ..area
    }
}
/// Logo, theme indicator and nav. Nav fades while typing, as on the web.
fn header(
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
            "◉ ",
            Palette::fg(if focus { palette.text } else { palette.main }),
        ),
        Span::styled(
            "oxytype",
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
    frame.render_widget(Paragraph::new(Line::from(logo)), top);
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
    let nav: Vec<_> = [
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
                format!("   {key} "),
                Palette::fg(palette.sub).add_modifier(Modifier::DIM),
            ),
            Span::styled(label, Style::new().fg(color)),
        ]
    })
    .collect();
    frame.render_widget(
        Paragraph::new(Line::from(nav)).alignment(Alignment::Right),
        top,
    );
}
/// Web test config: punctuation/numbers, modes, then the active mode's presets.
fn config_bar(palette: &Palette, config: &typing_engine::Config) -> Line<'static> {
    let on = |active: bool| Palette::fg(if active { palette.main } else { palette.sub });
    let gap = || Span::raw("  ");
    let divider = || Span::styled("  │  ", Palette::fg(palette.bg));
    let mut spans = vec![Span::raw("  ")];
    if matches!(config.mode.as_str(), "time" | "words") {
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
    if !presets.is_empty() {
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
/// Web timer/progress: remaining time, typed/total words, or elapsed for infinite tests.
fn progress(host: &EngineHost, live: &typing_engine::session::LiveMetrics) -> String {
    let index = host.state().word_index;
    match host.config.mode.as_str() {
        "time" if host.config.time > 0.0 => {
            format!("{:.0}", (host.config.time - live.seconds).max(0.0).ceil())
        }
        "words" if host.config.words > 0 => format!("{index}/{}", host.config.words),
        "quote" | "custom"
            if !host.words.is_empty() && host.custom_limit().is_none_or(|l| l.mode != "time") =>
        {
            format!("{index}/{}", host.words.len())
        }
        _ => format!("{:.0}", live.seconds),
    }
}
fn test(frame: &mut Frame, area: Rect, host: &EngineHost, now: f64, palette: &Palette) {
    let state = host.state();
    let area = column(area, 100);
    let [_, bar, _, live, words, _, restart, _] = Layout::vertical([
        Constraint::Fill(1),
        Constraint::Length(1),
        Constraint::Length(2),
        Constraint::Length(1),
        Constraint::Length(3),
        Constraint::Length(1),
        Constraint::Length(1),
        Constraint::Fill(2),
    ])
    .areas(area);
    if !state.active {
        let line = config_bar(palette, &host.config);
        let width = (line.width() as u16).min(bar.width);
        frame.render_widget(
            Paragraph::new(line),
            Rect {
                x: bar.x + (bar.width - width) / 2,
                width,
                ..bar
            },
        );
    }
    if state.active
        && let Ok(stats) = host.live(now)
    {
        frame.render_widget(
            Paragraph::new(Line::from(vec![
                Span::styled(progress(host, &stats), Palette::fg(palette.main)),
                Span::styled(
                    format!("   {:.0} wpm   {:.0}% acc", stats.wpm, stats.acc),
                    Palette::fg(palette.sub),
                ),
            ])),
            live,
        );
    }
    let input = host.visual_input.clone().unwrap_or(state.input_value);
    let targets: &[typing_engine::Text] = if host.config.mode == "zen" {
        &[]
    } else {
        &host.words
    };
    let view = crate::words::view(
        crate::words::Stream {
            words: targets,
            inputs: &host.inputs,
            index: state.word_index,
            input: &input,
            language: &host.config.language,
            palette,
        },
        words.width,
        words.height,
    );
    frame.set_cursor_position((words.x + view.caret.0, words.y + view.caret.1));
    frame.render_widget(Paragraph::new(view.lines), words);
    if !state.active {
        frame.render_widget(
            Paragraph::new(Span::styled("↻", Palette::fg(palette.sub)))
                .alignment(Alignment::Center),
            restart,
        );
    }
}
