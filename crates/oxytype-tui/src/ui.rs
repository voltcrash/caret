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
    let quiet = state.active || (screen == Screen::Test && state.ended);
    match screen {
        Screen::Test if state.ended => result(frame, rows[1], host, local, &palette),
        Screen::Test => test(frame, rows[1], host, now, &palette),
        Screen::Settings => settings(frame, rows[1], setup, &palette),
        _ => fallback(frame, rows[1], host, local, setup, capabilities, screen),
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
/// Screens not yet given a web layout keep the bordered text view.
fn fallback(
    frame: &mut Frame,
    area: Rect,
    host: &EngineHost,
    local: &Local,
    setup: &Setup,
    capabilities: &crate::input::Capabilities,
    screen: Screen,
) {
    let rows = [area, area];
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
        Screen::Test | Screen::Settings => vec![],
    };
    frame.render_widget(
        Paragraph::new(body)
            .wrap(Wrap { trim: false })
            .block(Block::bordered()),
        rows[1],
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
/// Keytips fade while typing (and give way to result actions); notices and version stay.
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
/// Label over value, as in the web result's small stat groups.
fn stat(label: &str, value: Vec<Line<'static>>, palette: &Palette) -> Paragraph<'static> {
    let mut lines = vec![Line::styled(label.to_string(), Palette::fg(palette.sub))];
    lines.extend(
        value
            .into_iter()
            .map(|line| line.patch_style(Palette::fg(palette.main))),
    );
    Paragraph::new(lines)
}
fn big(label: &str, value: &str, palette: &Palette) -> Paragraph<'static> {
    let rows = crate::bignum::rows(value)
        .map(Vec::from)
        .unwrap_or_else(|| vec![value.to_string()]);
    stat(label, rows.into_iter().map(Line::from).collect(), palette)
}
/// Chart series: wpm, burst (raw) and error seconds, as plotted on the web.
struct Series {
    wpm: Vec<(f64, f64)>,
    burst: Vec<(f64, f64)>,
    errors: Vec<(f64, f64)>,
    top: f64,
    end: f64,
}
impl Series {
    fn new(data: &typing_engine::stats::ChartData) -> Self {
        let points = |values: &[f64]| -> Vec<(f64, f64)> {
            values
                .iter()
                .enumerate()
                .map(|(i, v)| (i as f64 + 1.0, *v))
                .collect()
        };
        Self {
            wpm: points(&data.wpm),
            burst: points(&data.burst),
            errors: data
                .err
                .iter()
                .enumerate()
                .filter(|(_, e)| **e > 0)
                .map(|(i, _)| (i as f64 + 1.0, data.wpm.get(i).copied().unwrap_or_default()))
                .collect(),
            top: data
                .wpm
                .iter()
                .chain(&data.burst)
                .fold(10.0_f64, |a, b| a.max(*b))
                .ceil(),
            end: data.wpm.len().max(1) as f64,
        }
    }
    fn chart<'a>(&'a self, palette: &Palette) -> ratatui::widgets::Chart<'a> {
        use ratatui::{
            symbols::Marker,
            widgets::{Axis, Chart, Dataset, GraphType},
        };
        let axis = |label: String| Span::styled(label, Palette::fg(palette.sub));
        let line = |data, color| {
            Dataset::default()
                .marker(Marker::Braille)
                .graph_type(GraphType::Line)
                .style(Palette::fg(color))
                .data(data)
        };
        Chart::new(vec![
            line(&self.burst, palette.sub),
            line(&self.wpm, palette.main),
            Dataset::default()
                .marker(Marker::Dot)
                .graph_type(GraphType::Scatter)
                .style(Palette::fg(palette.error))
                .data(&self.errors),
        ])
        .x_axis(
            Axis::default()
                .style(Palette::fg(palette.sub_alt))
                .bounds([1.0, self.end])
                .labels([axis("1".into()), axis(format!("{:.0}", self.end))]),
        )
        .y_axis(
            Axis::default()
                .style(Palette::fg(palette.sub_alt))
                .bounds([0.0, self.top])
                .labels([axis("0".into()), axis(format!("{:.0}", self.top))]),
        )
    }
}
fn test_type(config: &typing_engine::Config) -> Vec<Line<'static>> {
    let amount = match config.mode.as_str() {
        "time" => format!(" {}", config.time),
        "words" => format!(" {}", config.words),
        _ => String::new(),
    };
    let mut lines = vec![
        Line::from(format!("{}{amount}", config.mode)),
        Line::from(config.language.replace('_', " ")),
    ];
    let extras: Vec<_> = [
        (config.punctuation, "punctuation".to_string()),
        (config.numbers, "numbers".to_string()),
        (config.difficulty != "normal", config.difficulty.clone()),
    ]
    .into_iter()
    .filter_map(|(on, label)| on.then_some(label))
    .chain(config.funbox.iter().cloned())
    .collect();
    if !extras.is_empty() {
        lines.push(Line::from(extras.join(" ")));
    }
    lines
}
/// Web result: big wpm/acc beside the chart, small stat groups below.
fn result(frame: &mut Frame, area: Rect, host: &EngineHost, local: &Local, palette: &Palette) {
    let area = column(area, 100);
    let [_, top, _, bottom, _, actions, message, _] = Layout::vertical([
        Constraint::Fill(1),
        Constraint::Length(8),
        Constraint::Length(1),
        Constraint::Length(3),
        Constraint::Length(1),
        Constraint::Length(1),
        Constraint::Length(1),
        Constraint::Fill(1),
    ])
    .areas(area);
    let Some(summary) = &host.result else {
        let error = host
            .result_error
            .clone()
            .unwrap_or_else(|| "Test ended".into());
        frame.render_widget(
            Paragraph::new(Span::styled(error, Palette::fg(palette.error)))
                .alignment(Alignment::Center)
                .wrap(Wrap { trim: true }),
            top,
        );
        return;
    };
    let [stats, graph] =
        Layout::horizontal([Constraint::Length(20), Constraint::Fill(1)]).areas(top);
    let [wpm, acc] = Layout::vertical([Constraint::Length(4); 2]).areas(stats);
    frame.render_widget(big("wpm", &format!("{:.0}", summary.wpm), palette), wpm);
    frame.render_widget(big("acc", &format!("{:.0}%", summary.acc), palette), acc);
    let series = Series::new(&summary.chart_data);
    frame.render_widget(series.chart(palette), graph);
    let [kind, raw, characters, consistency, time] = Layout::horizontal([
        Constraint::Fill(3),
        Constraint::Fill(2),
        Constraint::Fill(3),
        Constraint::Fill(3),
        Constraint::Fill(2),
    ])
    .areas(bottom);
    let [c, i, e, m] = summary.char_stats;
    frame.render_widget(stat("test type", test_type(&host.config), palette), kind);
    frame.render_widget(
        stat(
            "raw",
            vec![Line::from(format!("{:.0}", summary.raw_wpm))],
            palette,
        ),
        raw,
    );
    frame.render_widget(
        stat(
            "characters",
            vec![Line::from(format!("{c}/{i}/{e}/{m}"))],
            palette,
        ),
        characters,
    );
    frame.render_widget(
        stat(
            "consistency",
            vec![Line::from(format!("{:.0}%", summary.consistency))],
            palette,
        ),
        consistency,
    );
    let mut seconds = vec![Line::from(format!("{:.0}s", summary.test_duration))];
    if summary.afk_duration > 0 {
        seconds.push(Line::styled(
            format!("{}s afk", summary.afk_duration),
            Palette::fg(palette.sub),
        ));
    }
    frame.render_widget(stat("time", seconds, palette), time);
    let mut spans = tip(palette, "F5", "next test");
    spans.push(Span::raw("    "));
    spans.extend(tip(palette, "F6", "repeat test"));
    spans.push(Span::raw("    "));
    spans.extend(tip(palette, "F3", "history"));
    frame.render_widget(
        Paragraph::new(Line::from(spans)).alignment(Alignment::Center),
        actions,
    );
    let state = host.state();
    let reason = state.reason.unwrap_or_else(|| {
        if host.log().is_ok_and(|log| log.context.bailed_out) {
            "finished manually".into()
        } else {
            "completed".into()
        }
    });
    let validity = local.latest_result.as_ref().map(|record| {
        let best = record["personalBestEligible"] == true
            && record["personalBestGroup"]
                .as_str()
                .and_then(|group| local.store.best(group).ok().flatten())
                == record["summary"]["wpm"].as_f64();
        (record["invalidReason"].as_str().map(str::to_string), best)
    });
    let line = match validity {
        None => Line::styled("preparing local result…", Palette::fg(palette.sub)),
        Some((Some(invalid), _)) => Line::from(vec![
            Span::styled(format!("{reason} · "), Palette::fg(palette.sub)),
            Span::styled(format!("invalid: {invalid}"), Palette::fg(palette.error)),
        ]),
        Some((None, best)) => Line::from(vec![
            Span::styled(reason, Palette::fg(palette.sub)),
            Span::styled(
                if best { "  ♛ personal best" } else { "" },
                Palette::fg(palette.main),
            ),
        ]),
    };
    frame.render_widget(Paragraph::new(line).alignment(Alignment::Center), message);
}
/// One web button: active uses main on bg, others text on sub-alt.
fn button(palette: &Palette, label: &str, active: bool) -> Span<'static> {
    let style = if active {
        Style::new().fg(palette.bg).bg(palette.main)
    } else {
        Style::new().fg(palette.text).bg(palette.sub_alt)
    };
    Span::styled(format!(" {label} "), style)
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
