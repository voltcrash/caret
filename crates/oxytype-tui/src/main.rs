use clap::Parser;
use crossterm::event::{self, Event, KeyCode, KeyEventKind, KeyModifiers};
use oxytype_tui::{Result, engine::EngineHost, terminal::TerminalGuard};
use oxytype_tui::{options::Cli, setup::Setup};
use ratatui::{
    Frame,
    layout::{Constraint, Layout},
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{Block, Paragraph, Wrap},
};
use std::{
    sync::atomic::Ordering,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use typing_engine::{Command, Config};

#[derive(Clone, Copy, PartialEq)]
enum Screen {
    Test,
    Help,
    Settings,
    History,
    Editor,
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
    let (config, content, custom) = cli.prepare(Config::default())?;
    let mut setup = Setup::new(config.clone(), custom.as_ref());
    let mut host = EngineHost::offline(
        config,
        content.clone(),
        custom,
        cli.seed.unwrap_or(date() as u32),
    )?;
    let (guard, mut terminal) = TerminalGuard::enter()?;
    #[cfg(debug_assertions)]
    match std::env::var("OXYTYPE_TERMINAL_TEST_FAILURE").as_deref() {
        Ok("panic") => panic!("Injected terminal cleanup test panic"),
        Ok("error") => return Err("Injected terminal cleanup test error".into()),
        _ => {}
    }
    let origin = Instant::now();
    let mut screen = Screen::Test;
    let mut notice = String::new();
    let mut history = vec![];
    let mut last_draw = Instant::now();
    let mut dirty = true;
    loop {
        if guard.resume_if_requested(&mut terminal)? {
            dirty = true;
        }
        if guard.quit.load(Ordering::SeqCst) {
            break;
        }
        let now = origin.elapsed().as_secs_f64() * 1000.0;
        if host.state().active {
            host.command(Command::Advance { now, date: date() })?;
        }
        if dirty || (host.state().active && last_draw.elapsed() >= Duration::from_millis(100)) {
            terminal.draw(|frame| draw(frame, &host, screen, &notice, &history, now, &setup))?;
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
        match event {
            // Fullscreen draw autoresizes and invalidates its viewport. An extra
            // clear queries cursor position, which basic terminals need not report.
            Event::Resize(_, _) => {}
            Event::Paste(text) if screen == Screen::Editor => {
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
                    guard.suspend.store(true, Ordering::SeqCst);
                    continue;
                }
                match key.code {
                    KeyCode::F(1) => screen = Screen::Help,
                    KeyCode::F(2) if !host.state().active => {
                        setup.config = host.config.clone();
                        screen = Screen::Settings;
                    }
                    KeyCode::F(4) if !host.state().active => screen = Screen::Editor,
                    KeyCode::F(6) if screen == Screen::Editor => setup.cycle_order(),
                    KeyCode::F(7) if screen == Screen::Editor => setup.cycle_limit(),
                    KeyCode::F(9) if screen == Screen::Editor => setup.length += 1.0,
                    KeyCode::F(8) if screen == Screen::Editor => {
                        setup.config.mode = "custom".into();
                        match setup.build(&content, host.seed.wrapping_add(1)) {
                            Ok(next) => {
                                host = next;
                                screen = Screen::Test;
                                notice.clear();
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
                        setup.text.pop();
                    }
                    KeyCode::Enter if screen == Screen::Editor => setup.text.push('\n'),
                    KeyCode::Tab if screen == Screen::Editor => setup.text.push('\t'),
                    KeyCode::Up if screen == Screen::Settings => setup.select(-1),
                    KeyCode::Down if screen == Screen::Settings => setup.select(1),
                    KeyCode::Left if screen == Screen::Settings => setup.adjust(-1),
                    KeyCode::Right if screen == Screen::Settings => setup.adjust(1),
                    KeyCode::F(3) if !host.state().active => screen = Screen::History,
                    KeyCode::Esc if screen != Screen::Test => screen = Screen::Test,
                    KeyCode::F(5) | KeyCode::F(6) => {
                        if let Some(summary) = host.result.clone() {
                            history.push(format!(
                                "{}: {:.1} WPM / {:.1}%",
                                host.config.mode, summary.wpm, summary.acc
                            ));
                        }
                        host.restart(key.code == KeyCode::F(6), now, date())?;
                        screen = Screen::Test;
                        notice.clear();
                    }
                    KeyCode::Enter if screen == Screen::Settings => {
                        if setup.config.mode == "custom" && setup.text.trim().is_empty() {
                            screen = Screen::Editor;
                        } else {
                            match setup.build(&content, host.seed.wrapping_add(1)) {
                                Ok(next) => {
                                    host = next;
                                    screen = Screen::Test;
                                    notice.clear();
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
                    KeyCode::Backspace if screen == Screen::Test && !host.state().ended => {
                        host.command(Command::Delete {
                            kind: if control || key.modifiers.contains(KeyModifiers::ALT) {
                                "deleteWordBackward"
                            } else {
                                "deleteContentBackward"
                            }
                            .into(),
                            now,
                            date: date(),
                            observed_input: None,
                            sentinel_removed: false,
                        })?;
                    }
                    KeyCode::Char(char)
                        if screen == Screen::Test
                            && !host.state().ended
                            && !control
                            && !key.modifiers.contains(KeyModifiers::ALT) =>
                    {
                        host.insert(&char.to_string(), now, date())?;
                    }
                    KeyCode::Enter if screen == Screen::Test && !host.state().ended => {
                        host.insert("\n", now, date())?
                    }
                    KeyCode::Tab if screen == Screen::Test && !host.state().ended => {
                        host.insert("\t", now, date())?
                    }
                    _ => {}
                }
            }
            _ => {}
        }
    }
    Ok(())
}
fn draw(
    frame: &mut Frame,
    host: &EngineHost,
    screen: Screen,
    notice: &str,
    history: &[String],
    now: f64,
    setup: &Setup,
) {
    let area = frame.area();
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
            "Oxytype {} | {}",
            env!("CARGO_PKG_VERSION"),
            host.config.mode
        ))
        .block(Block::bordered()),
        rows[0],
    );
    let state = host.state();
    let body = match screen {
        Screen::Help => vec![
            Line::from("F5 new · F6 repeat · F2 settings · F3 history · F4 custom · Esc return"),
            Line::from("F8 finish · Backspace delete · Ctrl+Backspace delete word"),
            Line::from("Ctrl+Q / Ctrl+C quit · Ctrl+Z suspend (Unix)"),
            Line::from("Physical-key timing is unavailable; no key releases are invented."),
        ],
        Screen::Settings => {
            let lines = setup.lines();
            let visible = rows[1].height.saturating_sub(3) as usize;
            let skip = setup.selected.saturating_sub(visible.saturating_sub(1));
            std::iter::once(lines[0].clone())
                .chain(lines.into_iter().skip(skip + 1).take(visible))
                .collect()
        }
        Screen::Editor => setup.editor_lines(),
        Screen::History => history
            .iter()
            .rev()
            .map(|row| Line::from(row.clone()))
            .chain(std::iter::once(Line::from("Session history")))
            .collect(),
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
            let mut spans = vec![];
            let targets = if host.config.mode == "zen" {
                &host.inputs
            } else {
                &host.words
            };
            for (index, word) in targets
                .iter()
                .enumerate()
                .skip(state.word_index.saturating_sub(5))
                .take(35)
            {
                spans.push(Span::styled(
                    word.display_lossy(),
                    if index == state.word_index {
                        Style::new()
                            .fg(Color::Cyan)
                            .add_modifier(Modifier::UNDERLINED)
                    } else {
                        Style::new()
                    },
                ));
            }
            lines.push(Line::from(spans));
            lines.push(Line::from(format!(
                "Input: {}▌",
                state.input_value.display_lossy()
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
            "F1 help · F5 new · F6 repeat · Ctrl+Q quit\n{notice}"
        )),
        rows[2],
    );
}
