use clap::Parser;
use crossterm::event::{self, Event, KeyCode, KeyEventKind, KeyModifiers};
use oxytype_tui::{Result, engine::EngineHost, terminal::TerminalGuard};
use oxytype_tui::{
    local::Local,
    storage::{Paths, Store},
};
use oxytype_tui::{options::Cli, setup::Setup};
use ratatui::{
    Frame,
    layout::{Constraint, Layout},
    text::Line,
    widgets::{Block, Paragraph, Wrap},
};
use std::{
    sync::atomic::Ordering,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use typing_engine::Command;

#[derive(Clone, Copy, PartialEq)]
enum Screen {
    Test,
    Help,
    Settings,
    History,
    Editor,
    Replay,
}
fn date() -> f64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as f64
}
fn main() {
    if let Err(error) = run() {
        eprintln!("oxytype: {error}");
        std::process::exit(1);
    }
}
fn run() -> Result<()> {
    let cli = Cli::parse();
    if cli.smoke_test {
        return oxytype_tui::engine::smoke();
    }
    if cli.capabilities {
        println!("{}", oxytype_tui::options::capabilities());
        return Ok(());
    }
    if cli.diagnostics {
        println!(
            "{}",
            serde_json::json!({"version":oxytype_tui::version(),"os":std::env::consts::OS,"architecture":std::env::consts::ARCH,"bindingVersion":typing_engine::BINDING_VERSION,"offlinePackVersion":1,"keyboard":"Inspect F1 after terminal negotiation","physicalKeyTiming":null})
        );
        return Ok(());
    }
    let paths = Paths::resolve(cli.config_dir.as_deref(), cli.data_dir.as_deref())?;
    if cli.paths {
        println!(
            "Config: {}\nData: {}",
            paths.config.display(),
            paths.data.display()
        );
        return Ok(());
    }
    let mut store = Store::open(&paths)?;
    if let Some(output) = &cli.export {
        store.export(output, cli.history_mode.as_deref())?;
        println!("Exported to {}", output.display());
        return Ok(());
    }
    let mut preferences = store.settings()?;
    preferences.record_replay |= cli.record_replay;
    if let Some(theme) = &cli.theme {
        preferences.theme = theme.clone();
    }
    let (config, content, custom) = cli.prepare(preferences.config.clone())?;
    let mut local = Local::new(store, preferences);
    let mut setup = Setup::new(config.clone(), custom.as_ref());
    local.configure_setup(&mut setup);
    let mut host = EngineHost::offline(
        config,
        content.clone(),
        custom,
        cli.seed.unwrap_or(date() as u32),
    )?;
    let (guard, mut terminal) = TerminalGuard::enter(cli.keyboard != "basic")?;
    #[cfg(debug_assertions)]
    match std::env::var("OXYTYPE_TERMINAL_TEST_FAILURE").as_deref() {
        Ok("panic") => panic!("Injected terminal cleanup test panic"),
        Ok("error") => return Err("Injected terminal cleanup test error".into()),
        _ => {}
    }
    let mut capabilities = oxytype_tui::input::Capabilities {
        enhanced_keyboard_negotiated: guard.enhanced.load(Ordering::SeqCst),
        ..Default::default()
    };
    let origin = Instant::now();
    let mut screen = Screen::Test;
    let mut notice = String::new();
    let mut last_draw = Instant::now();
    let mut dirty = true;
    loop {
        if guard.resume_if_requested(&mut terminal)? {
            capabilities.enhanced_keyboard_negotiated = guard.enhanced.load(Ordering::SeqCst);
            dirty = true;
        }
        let now = origin.elapsed().as_secs_f64() * 1000.0;
        if host.state().active {
            host.command(Command::Advance { now, date: date() })?;
        }
        match local.capture(&host, &capabilities, date()) {
            Ok(true) => {
                notice = "Result saved locally.".into();
                dirty = true;
            }
            Ok(false) => {}
            Err(error) => {
                notice =
                    format!("UNSAVED result: {error}. F9 retries; quitting loses pending data.");
                dirty = true;
            }
        }
        if guard.quit.load(Ordering::SeqCst) {
            break;
        }
        if dirty
            || (host.state().active
                && last_draw.elapsed()
                    >= Duration::from_millis(if local.preferences.reduced_animation {
                        250
                    } else {
                        100
                    }))
        {
            terminal.draw(|frame| {
                draw(
                    frame,
                    &host,
                    now,
                    View {
                        screen,
                        notice: &notice,
                        local: &local,
                        setup: &setup,
                        capabilities: &capabilities,
                    },
                )
            })?;
            dirty = false;
            last_draw = Instant::now();
        }
        match event::poll(Duration::from_millis(50)) {
            Ok(false) => continue,
            Err(error) if error.kind() == std::io::ErrorKind::Interrupted => continue,
            Err(error) => return Err(error.into()),
            Ok(true) => {}
        }
        dirty = true;
        let event = event::read()?;
        // Capture delivery time after poll/read, never the earlier polling time.
        let now = origin.elapsed().as_secs_f64() * 1000.0;
        if let Event::Key(key) = event {
            capabilities.observe(key);
        }
        match event {
            // Fullscreen draw autoresizes and invalidates its viewport. An extra
            // clear queries cursor position, which basic terminals need not report.
            Event::Resize(_, _) => {}
            Event::Paste(text) if screen == Screen::Editor => {
                let text = oxytype_tui::content::line_endings(&text);
                match oxytype_tui::content::safe_text(&text) {
                    Ok(()) if setup.text.len() + text.len() <= 8 * 1024 * 1024 => {
                        setup.text.push_str(&text)
                    }
                    Ok(()) => notice = "Custom text exceeds 8 MiB".into(),
                    Err(error) => notice = error.to_string(),
                }
            }
            Event::Paste(_) => notice = "Paste blocked during typing.".into(),
            Event::Key(key) if key.kind != KeyEventKind::Release => {
                let control = key.modifiers.contains(KeyModifiers::CONTROL);
                if (control && matches!(key.code, KeyCode::Char('q' | 'c')))
                    || key.code == KeyCode::F(10)
                {
                    break;
                }
                if control && key.code == KeyCode::Char('z') {
                    if cfg!(unix) {
                        guard.suspend.store(true, Ordering::SeqCst);
                    } else {
                        notice = "Suspend is unavailable on this platform.".into();
                    }
                    continue;
                }
                match key.code {
                    KeyCode::F(1) => screen = Screen::Help,
                    KeyCode::F(2) if !host.state().active => {
                        setup.config = host.config.clone();
                        local.configure_setup(&mut setup);
                        screen = Screen::Settings;
                    }
                    KeyCode::F(4) if !host.state().active => screen = Screen::Editor,
                    KeyCode::F(6) if screen == Screen::Editor => setup.cycle_order(),
                    KeyCode::F(7) if screen == Screen::Editor => setup.cycle_limit(),
                    KeyCode::F(9) if screen == Screen::Editor => setup.increase_length(),
                    KeyCode::F(8) if screen == Screen::Editor => {
                        if !local.pending.is_empty() {
                            notice =
                                "Save the pending result with F9 before starting another test."
                                    .into();
                            continue;
                        }
                        setup.config.mode = "custom".into();
                        match setup.build(&content, host.seed.wrapping_add(1)) {
                            Ok(next) => {
                                host = next;
                                local.restarted();
                                screen = Screen::Test;
                                notice = local
                                    .apply(&setup)
                                    .err()
                                    .map(|e| format!("Settings not saved: {e}"))
                                    .unwrap_or_default();
                            }
                            Err(error) => notice = error.to_string(),
                        }
                    }
                    KeyCode::Char(c)
                        if screen == Screen::Editor
                            && !control
                            && !key.modifiers.contains(KeyModifiers::ALT) =>
                    {
                        if !c.is_control() && setup.text.len() < 8 * 1024 * 1024 {
                            setup.text.push(c);
                        }
                    }
                    KeyCode::Backspace if screen == Screen::Editor => {
                        oxytype_tui::input::pop_grapheme(&mut setup.text);
                    }
                    KeyCode::Enter if screen == Screen::Editor => setup.text.push('\n'),
                    KeyCode::Tab if screen == Screen::Editor => setup.text.push('\t'),
                    KeyCode::Up if screen == Screen::Settings => setup.select(-1),
                    KeyCode::Down if screen == Screen::Settings => setup.select(1),
                    KeyCode::Left if screen == Screen::Settings => setup.adjust(-1),
                    KeyCode::Right if screen == Screen::Settings => setup.adjust(1),
                    KeyCode::F(3) if !host.state().active => {
                        local.history.refresh(&local.store)?;
                        screen = Screen::History;
                    }
                    KeyCode::Up if screen == Screen::History => local.history.select(-1),
                    KeyCode::Down if screen == Screen::History => local.history.select(1),
                    KeyCode::PageUp if screen == Screen::History => {
                        local.history.page(-1, &local.store)?
                    }
                    KeyCode::PageDown if screen == Screen::History => {
                        local.history.page(1, &local.store)?
                    }
                    KeyCode::Enter if screen == Screen::History => {
                        local.history.details = !local.history.details;
                        local.history.scroll = 0;
                    }
                    KeyCode::Char('m') if screen == Screen::History => {
                        local.history.filter(&local.store)?
                    }
                    KeyCode::F(7) if screen == Screen::History => {
                        let output = paths
                            .data
                            .join(format!("export-{}.json", uuid::Uuid::new_v4()));
                        notice = match local.store.export(&output, local.history.mode()) {
                            Ok(()) => format!("Exported {}", output.display()),
                            Err(e) => format!("Export failed: {e}"),
                        };
                    }
                    KeyCode::F(8) if screen == Screen::History => {
                        if let Some(record) = local.history.current() {
                            match oxytype_tui::replay::Replay::new(record) {
                                Ok(replay) => {
                                    local.replay = Some(replay);
                                    screen = Screen::Replay;
                                }
                                Err(e) => notice = e.to_string(),
                            }
                        }
                    }
                    KeyCode::Right | KeyCode::Char(' ') if screen == Screen::Replay => {
                        if let Some(replay) = &mut local.replay {
                            replay.step();
                        }
                    }
                    KeyCode::Home if screen == Screen::Replay => {
                        if let Some(replay) = &mut local.replay {
                            replay.seek(typing_engine::replay::Cursor::default());
                        }
                    }
                    KeyCode::PageUp | KeyCode::PageDown if screen == Screen::Replay => {
                        if let Some(replay) = &mut local.replay {
                            let direction = if key.code == KeyCode::PageUp { -1 } else { 1 };
                            replay.seek(typing_engine::replay::Cursor {
                                word_index: (replay.frame.cursor.word_index + direction).max(0),
                                letter_index: 0,
                            });
                        }
                    }
                    KeyCode::Esc if screen == Screen::Replay => {
                        local.replay = None;
                        screen = Screen::History;
                    }
                    KeyCode::F(9) => {
                        notice = match local.retry() {
                            Ok(()) => "Pending results saved.".into(),
                            Err(e) => format!("Still unsaved: {e}"),
                        }
                    }
                    KeyCode::Esc if screen != Screen::Test => screen = Screen::Test,
                    KeyCode::F(5) | KeyCode::F(6) => {
                        if !local.pending.is_empty() {
                            notice =
                                "Save the pending result with F9 before starting another test."
                                    .into();
                            continue;
                        }
                        host.restart(key.code == KeyCode::F(6), now, date())?;
                        local.restarted();
                        screen = Screen::Test;
                        notice.clear();
                    }
                    KeyCode::Enter if screen == Screen::Settings => {
                        if !local.pending.is_empty() {
                            notice =
                                "Save the pending result with F9 before starting another test."
                                    .into();
                            continue;
                        }
                        if setup.config.mode == "custom" && setup.text.trim().is_empty() {
                            screen = Screen::Editor;
                        } else {
                            match setup.build(&content, host.seed.wrapping_add(1)) {
                                Ok(next) => {
                                    host = next;
                                    local.restarted();
                                    screen = Screen::Test;
                                    notice = local
                                        .apply(&setup)
                                        .err()
                                        .map(|e| format!("Settings not saved: {e}"))
                                        .unwrap_or_default();
                                }
                                Err(error) => notice = error.to_string(),
                            }
                        }
                    }
                    KeyCode::F(8) if screen == Screen::Test => {
                        host.command(Command::Bailout { now, date: date() })?;
                    }
                    KeyCode::Enter if control && screen == Screen::Test => {
                        host.command(Command::Bailout { now, date: date() })?;
                    }
                    _ if screen == Screen::Test && !host.state().ended => {
                        let (columns, rows) = crossterm::terminal::size()?;
                        if columns >= 60 && rows >= 18 {
                            oxytype_tui::input::apply(&mut host, key, now, date())?;
                        }
                    }
                    _ => {}
                }
            }
            _ => {}
        }
    }
    if !local.pending.is_empty() {
        return Err(format!(
            "{} result(s) could not be saved; prior history is intact",
            local.pending.len()
        )
        .into());
    }
    Ok(())
}
struct View<'a> {
    screen: Screen,
    notice: &'a str,
    local: &'a Local,
    setup: &'a Setup,
    capabilities: &'a oxytype_tui::input::Capabilities,
}
fn draw(frame: &mut Frame, host: &EngineHost, now: f64, view: View<'_>) {
    let View {
        screen,
        notice,
        local,
        setup,
        capabilities,
    } = view;
    let area = frame.area();
    let palette = oxytype_tui::theme::Palette::named(&local.preferences.theme);
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
    frame.render_widget(
        Paragraph::new(format!(
            "Oxytype {} | {}{}{}",
            env!("CARGO_PKG_VERSION"),
            host.config.mode,
            if local.preferences.record_replay {
                " | RECORDING PRIVATE TEXT"
            } else {
                ""
            },
            if local.pending.is_empty() {
                String::new()
            } else {
                format!(" | {} UNSAVED", local.pending.len())
            }
        ))
        .block(Block::bordered()),
        rows[0],
    );
    let state = host.state();
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
                *line = Line::from(oxytype_tui::render::clip_cells(
                    &line.to_string(),
                    rows[1].width.saturating_sub(2) as usize,
                ));
            }
            let input = typing_engine::Text::from(setup.text.as_str());
            let mut view = oxytype_tui::render::text_view(
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
            let view = oxytype_tui::render::text_view(
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
                    oxytype_tui::render::clip_cells(
                        &next,
                        rows[1].width.saturating_sub(8) as usize
                    )
                )));
            }
            lines.push(Line::from(format!(
                "Input: {}",
                oxytype_tui::render::clip_cells(
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
