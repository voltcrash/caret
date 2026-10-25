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
        Screen::Test => {
            let mut lines = vec![];
            if let Ok(live) = host.live(now) {
                lines.push(Line::from(format!(
                    "{:.1} WPM · {:.1}% · {:.0}s",
                    live.wpm, live.acc, live.seconds
                )));
            }
            let input = host.visual_input.clone().unwrap_or(state.input_value);
            let mut target = typing_engine::Text::default();
            if host.config.mode != "zen" {
                target = host
                    .words
                    .get(state.word_index)
                    .cloned()
                    .unwrap_or_default();
            }
            let view = crate::render::text_view(
                &target,
                &input,
                &host.config.language,
                rows[1].width.saturating_sub(2),
                rows[1].height.saturating_sub(6),
            );
            if view.errors {
                lines.push(Line::from("! Incorrect text is underlined"));
            }
            let caret_y = rows[1].y + 1 + lines.len() as u16 + view.caret.1;
            frame.set_cursor_position((rows[1].x + 1 + view.caret.0, caret_y));
            lines.extend(view.lines.into_iter().map(|line| {
                line.style(
                    ratatui::style::Style::new().add_modifier(ratatui::style::Modifier::BOLD),
                )
            }));
            if host.config.mode != "zen" {
                let next = host
                    .words
                    .iter()
                    .skip(state.word_index + 1)
                    .take(5)
                    .map(|w| w.display_lossy().replace('\n', "↵").replace('\t', "→"))
                    .collect::<String>();
                lines.push(Line::from(format!(
                    "Next: {}",
                    crate::render::clip_cells(&next, rows[1].width.saturating_sub(8) as usize)
                )));
            }
            lines.push(Line::from(format!(
                "Input: {}",
                crate::render::clip_cells(
                    &input
                        .display_lossy()
                        .replace('\t', "→   ")
                        .replace('\n', "↵"),
                    rows[1].width.saturating_sub(9) as usize
                )
            )));
            lines
        }
    };
    frame.render_widget(
        Paragraph::new(body)
            .wrap(Wrap { trim: false })
            .block(Block::bordered()),
        rows[1],
    );
    frame.render_widget(
        Paragraph::new(format!(
            "F1 help · F5 new · F6 repeat · Ctrl+Q quit · F9 retry saves\n{notice}"
        )),
        rows[2],
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
