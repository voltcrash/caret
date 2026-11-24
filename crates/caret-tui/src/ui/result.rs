use super::{
    chart::Series,
    chrome::{big, column, stat, tip},
};
use crate::{engine::EngineHost, local::Local, theme::Palette};
use ratatui::{
    Frame,
    layout::{Alignment, Constraint, Layout, Rect},
    text::{Line, Span},
    widgets::{Paragraph, Wrap},
};

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
pub(super) fn draw(
    frame: &mut Frame,
    area: Rect,
    host: &EngineHost,
    local: &Local,
    palette: &Palette,
) {
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
    let Some(summary) = host.result() else {
        let error = host
            .result_error()
            .map(str::to_owned)
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
    let (wpm_text, acc_text) = (
        format!("{:.0}", summary.wpm),
        format!("{:.0}%", summary.acc),
    );
    if stats.height >= 8 {
        let [wpm, acc] = Layout::vertical([Constraint::Length(4); 2]).areas(stats);
        frame.render_widget(big("wpm", &wpm_text, palette), wpm);
        frame.render_widget(big("acc", &acc_text, palette), acc);
    } else {
        // Short terminals: plain figures rather than clipped block numerals.
        let [wpm, acc] = Layout::vertical([Constraint::Length(2); 2]).areas(stats);
        frame.render_widget(stat("wpm", vec![Line::from(wpm_text)], palette), wpm);
        frame.render_widget(stat("acc", vec![Line::from(acc_text)], palette), acc);
    }
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
