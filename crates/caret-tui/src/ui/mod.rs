//! Screen composition. Imperative work stays in the terminal; this only paints frames.
mod chart;
mod chrome;
mod editor;
mod help;
mod history;
mod replay;
mod result;
mod settings;
mod test;

use chrome::{footer, header};
use crate::theme::Palette;
use crate::{engine::EngineHost, local::Local, setup::Setup};
use ratatui::{
    Frame,
    layout::{Alignment, Constraint, Layout},
    text::Line,
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
        Screen::Editor => editor::draw(frame, rows[1], host, setup, &palette),
        Screen::Replay => replay::draw(frame, rows[1], local, &palette),
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
