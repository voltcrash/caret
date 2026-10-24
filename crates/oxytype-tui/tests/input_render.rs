use crossterm::event::{KeyCode, KeyEvent, KeyEventKind, KeyModifiers};
use oxytype_tui::{
    content::OfflineContent,
    engine::EngineHost,
    input::{self, Capabilities},
    render::text_view,
};
use ratatui::{Terminal, backend::TestBackend, widgets::Paragraph};
use typing_engine::{Config, Text};

#[test]
fn terminal_commits_repeats_once_ignores_releases_and_deletes_graphemes_in_utf16() {
    let mut host = EngineHost::offline(
        Config {
            mode: "zen".into(),
            ..Default::default()
        },
        OfflineContent::bundled().unwrap(),
        None,
        42,
    )
    .unwrap();
    host.insert("e\u{301}😀", 100.0, 1000.0).unwrap();
    assert_eq!(host.state().input_value.len(), 4);
    let backspace = KeyEvent::new(KeyCode::Backspace, KeyModifiers::NONE);
    input::apply(&mut host, backspace, 200.0, 1100.0).unwrap();
    assert_eq!(host.state().input_value, Text::from("e\u{301}"));
    input::apply(&mut host, backspace, 300.0, 1200.0).unwrap();
    assert!(host.state().input_value.is_empty());
    let key = KeyEvent::new(KeyCode::Char('x'), KeyModifiers::NONE);
    input::apply(&mut host, key, 400.0, 1300.0).unwrap();
    input::apply(
        &mut host,
        KeyEvent {
            kind: KeyEventKind::Repeat,
            ..key
        },
        500.0,
        1400.0,
    )
    .unwrap();
    let before = host.log().unwrap().events.len();
    input::apply(
        &mut host,
        KeyEvent {
            kind: KeyEventKind::Release,
            ..key
        },
        600.0,
        1500.0,
    )
    .unwrap();
    assert_eq!(host.log().unwrap().events.len(), before);
    assert_eq!(host.state().input_value, Text::from("xx"));
    assert!(
        host.log()
            .unwrap()
            .events
            .iter()
            .all(|e| !["keydown", "keyup"].contains(&e.kind.as_str()))
    );
    let mut capabilities = Capabilities::default();
    capabilities.observe(KeyEvent {
        kind: KeyEventKind::Release,
        ..key
    });
    assert!(capabilities.release_observed);
    assert!(!capabilities.physical_key_timing);
}
#[test]
fn ratatui_cells_and_caret_keep_graphemes_separate_from_utf16_positions() {
    let target = Text::from("e\u{301}界😀a");
    let view = text_view(&target, &Text::from("e\u{301}界"), "english", 4, 4);
    assert_eq!(view.caret, (0, 1));
    let mut terminal = Terminal::new(TestBackend::new(4, 4)).unwrap();
    terminal
        .draw(|frame| {
            frame.render_widget(Paragraph::new(view.lines), frame.area());
        })
        .unwrap();
    let buffer = terminal.backend().buffer();
    assert_eq!(buffer[(0, 0)].symbol(), "e\u{301}");
    assert_eq!(buffer[(1, 0)].symbol(), "界");
    assert_eq!(buffer[(0, 1)].symbol(), "😀");
    assert_eq!(buffer[(2, 1)].symbol(), "a");
    let control = text_view(
        &Text::from("a\tb\n界"),
        &Text::from("a\tb\n"),
        "english",
        8,
        4,
    );
    assert_eq!(control.caret, (0, 1));
    assert!(control.lines[0].to_string().contains("→   b↵"));
    let scrolled = text_view(
        &Text::from("abcdefghijk"),
        &Text::from("abcdefghij"),
        "english",
        2,
        2,
    );
    assert_eq!(scrolled.caret, (0, 1));
    assert_eq!(scrolled.lines.len(), 2);
}
#[test]
fn extra_emoji_and_error_markers_never_split_surrogates() {
    let view = text_view(&Text::from("a"), &Text::from("😀"), "english", 8, 4);
    assert!(view.errors);
    assert!(view.lines[0].to_string().contains("😀"));
    assert!(!view.lines[0].to_string().contains('\u{fffd}'));
    let normalized = text_view(&Text::from("’"), &Text::from("'"), "english", 8, 4);
    assert!(!normalized.errors);
    let config = Config {
        mode: "words".into(),
        words: 5,
        funbox: vec!["backwards".into()],
        ..Default::default()
    };
    let content = OfflineContent::parse(r#"{"formatVersion":1,"license":"CC0","attribution":"test","language":{"name":"english","words":["😀","abc"]}}"#).unwrap();
    assert!(EngineHost::offline(config, content, None, 42).is_err());
}

#[test]
fn stopped_letter_projects_native_visual_feedback_without_mutating_input() {
    let mut host = EngineHost::offline(
        Config {
            stop_on_error: "letter".into(),
            ..Default::default()
        },
        OfflineContent::bundled().unwrap(),
        None,
        42,
    )
    .unwrap();
    host.insert("☃", 100.0, 1000.0).unwrap();
    assert!(host.state().input_value.is_empty());
    assert_eq!(host.visual_input, Some(Text::from("☃")));
    assert!(
        text_view(
            &host.words[0],
            host.visual_input.as_ref().unwrap(),
            "english",
            20,
            4
        )
        .errors
    );
}

#[test]
fn deleting_partial_surrogate_feedback_preserves_original_utf16_prefix() {
    let original = Text(vec![0xd83d, 97, 0x301]);
    let after = input::delete_observation(&original).unwrap();
    assert_eq!(after, Text(vec![0xd83d]));
    assert!(input::delete_observation(&after).unwrap().is_empty());
}
