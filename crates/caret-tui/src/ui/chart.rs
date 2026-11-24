use crate::theme::Palette;
use ratatui::{
    symbols::Marker,
    text::Span,
    widgets::{Axis, Chart, Dataset, GraphType},
};

/// Chart series: wpm, burst (raw) and error seconds, as plotted on the web.
pub(super) struct Series {
    wpm: Vec<(f64, f64)>,
    burst: Vec<(f64, f64)>,
    errors: Vec<(f64, f64)>,
    top: f64,
    end: f64,
}

impl Series {
    pub(super) fn new(data: &typing_engine::stats::ChartData) -> Self {
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

    pub(super) fn chart<'a>(&'a self, palette: &Palette) -> Chart<'a> {
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
