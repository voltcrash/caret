use super::chrome::{column, config_bar};
use crate::{engine::EngineHost, theme::Palette};
use ratatui::{
    Frame,
    layout::{Alignment, Constraint, Layout, Rect},
    text::{Line, Span},
    widgets::Paragraph,
};

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

pub(super) fn draw(frame: &mut Frame, area: Rect, host: &EngineHost, now: f64, palette: &Palette) {
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
        // Narrow terminals drop toggles, then presets, as the web collapses its bar.
        let line = [(true, true), (false, true), (false, false)]
            .into_iter()
            .map(|(toggles, amounts)| config_bar(palette, &host.config, toggles, amounts))
            .find(|line| line.width() <= bar.width as usize)
            .unwrap_or_else(|| config_bar(palette, &host.config, false, false));
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
