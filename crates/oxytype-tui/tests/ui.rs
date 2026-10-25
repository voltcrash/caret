use oxytype_tui::{
    content::OfflineContent,
    engine::EngineHost,
    input::Capabilities,
    local::Local,
    setup::Setup,
    storage::{Paths, Store},
    ui::{Screen, View, draw},
};
use ratatui::{Terminal, backend::TestBackend, buffer::Buffer};
use typing_engine::Config;

struct Fixture {
    _temp: tempfile::TempDir,
    local: Local,
    host: EngineHost,
    setup: Setup,
}
fn fixture(config: Config) -> Fixture {
    let temp = tempfile::tempdir().unwrap();
    let mut store = Store::open(&Paths {
        config: temp.path().join("config"),
        data: temp.path().join("data"),
    })
    .unwrap();
    let preferences = store.settings().unwrap();
    let host =
        EngineHost::offline(config.clone(), OfflineContent::bundled().unwrap(), None, 42).unwrap();
    Fixture {
        _temp: temp,
        local: Local::new(store, preferences),
        host,
        setup: Setup::new(config, None),
    }
}
fn render(fixture: &Fixture, screen: Screen, width: u16, height: u16) -> Buffer {
    let mut terminal = Terminal::new(TestBackend::new(width, height)).unwrap();
    terminal
        .draw(|frame| {
            draw(
                frame,
                &fixture.host,
                5000.0,
                View {
                    screen,
                    notice: "",
                    local: &fixture.local,
                    setup: &fixture.setup,
                    capabilities: &Capabilities::default(),
                },
            )
        })
        .unwrap();
    terminal.backend().buffer().clone()
}
fn text(buffer: &Buffer) -> String {
    let area = buffer.area;
    (0..area.height)
        .map(|y| {
            (0..area.width)
                .map(|x| buffer[(x, y)].symbol())
                .collect::<String>()
        })
        .collect::<Vec<_>>()
        .join("\n")
}
fn find(buffer: &Buffer, needle: &str) -> Option<(u16, u16)> {
    let rows = text(buffer);
    rows.lines().enumerate().find_map(|(y, row)| {
        row.find(needle)
            .map(|byte| (row[..byte].chars().count() as u16, y as u16))
    })
}

#[test]
fn header_shows_logo_theme_and_nav_until_typing_starts() {
    let mut fixture = fixture(Config::default());
    let buffer = render(&fixture, Screen::Test, 100, 30);
    if std::env::var("OXYTYPE_UI_DUMP").is_ok() {
        println!("{}", text(&buffer));
    }
    let (x, y) = find(&buffer, "oxytype").unwrap();
    let palette = oxytype_tui::theme::Palette::named("rust");
    assert_eq!(buffer[(x, y)].fg, palette.text);
    assert_eq!(buffer[(x - 2, y)].fg, palette.main);
    assert!(find(&buffer, "settings").is_some());
    assert!(find(&buffer, "rust").is_some());
    let word = fixture.host.words[0].display_lossy();
    fixture.host.insert(&word[..1], 100.0, 1000.0).unwrap();
    let buffer = render(&fixture, Screen::Test, 100, 30);
    assert!(find(&buffer, "settings").is_none());
}

#[test]
fn idle_test_shows_config_bar_with_active_mode_and_untyped_words() {
    let fixture = fixture(Config {
        mode: "words".into(),
        words: 25,
        ..Default::default()
    });
    let palette = oxytype_tui::theme::Palette::named("rust");
    let buffer = render(&fixture, Screen::Test, 100, 30);
    let (x, y) = find(&buffer, "words  quote").unwrap();
    assert_eq!(buffer[(x, y)].fg, palette.main);
    assert_eq!(buffer[(x, y)].bg, palette.sub_alt);
    let (x, y) = find(&buffer, "25").unwrap();
    assert_eq!(buffer[(x, y)].fg, palette.main);
    let (x, y) = find(&buffer, "time  words").unwrap();
    assert_eq!(buffer[(x, y)].fg, palette.sub);
    let first = fixture.host.words[0].display_lossy();
    let (x, y) = find(&buffer, first.trim_end()).unwrap();
    assert_eq!(buffer[(x, y)].fg, palette.sub);
}

#[test]
fn active_test_hides_config_and_counts_words_in_main_color() {
    let mut fixture = fixture(Config {
        mode: "words".into(),
        words: 25,
        ..Default::default()
    });
    let palette = oxytype_tui::theme::Palette::named("rust");
    let word = fixture.host.words[0].display_lossy();
    fixture.host.insert(&word, 100.0, 1000.0).unwrap();
    let buffer = render(&fixture, Screen::Test, 100, 30);
    assert!(find(&buffer, "punctuation").is_none());
    let (x, y) = find(&buffer, "1/25").unwrap();
    assert_eq!(buffer[(x, y)].fg, palette.main);
    let (x, y) = find(&buffer, word.trim_end()).unwrap();
    assert_eq!(buffer[(x, y)].fg, palette.text);
}

#[test]
fn result_shows_big_wpm_acc_chart_and_stat_groups() {
    let mut fixture = fixture(Config {
        mode: "words".into(),
        words: 10,
        ..Default::default()
    });
    for i in 0..10 {
        let word = fixture.host.words[i].display_lossy();
        fixture
            .host
            .insert(&word, 100.0 + i as f64 * 1000.0, 1100.0 + i as f64 * 1000.0)
            .unwrap();
    }
    assert!(fixture.host.state().ended);
    let buffer = render(&fixture, Screen::Test, 100, 30);
    if std::env::var("OXYTYPE_UI_DUMP").is_ok() {
        println!("{}", text(&buffer));
    }
    let palette = oxytype_tui::theme::Palette::named("rust");
    for label in [
        "wpm",
        "acc",
        "test type",
        "raw",
        "characters",
        "consistency",
        "time",
    ] {
        let (x, y) = find(&buffer, label).unwrap_or_else(|| panic!("missing {label}"));
        assert_eq!(buffer[(x, y)].fg, palette.sub, "{label}");
    }
    let (x, y) = find(&buffer, "wpm").unwrap();
    assert_eq!(buffer[(x, y + 1)].fg, palette.main);
    assert!(find(&buffer, "words 10").is_some());
    assert!(find(&buffer, "next test").is_some());
}

#[test]
fn settings_render_button_groups_with_active_choice_in_main() {
    let mut fixture = fixture(Config::default());
    fixture.setup.selected = 3;
    let buffer = render(&fixture, Screen::Settings, 100, 30);
    if std::env::var("OXYTYPE_UI_DUMP").is_ok() {
        println!("{}", text(&buffer));
    }
    let palette = oxytype_tui::theme::Palette::named("rust");
    let (x, y) = find(&buffer, " time ").unwrap();
    assert_eq!(buffer[(x + 1, y)].bg, palette.main);
    let (x, y) = find(&buffer, " words ").unwrap();
    assert_eq!(buffer[(x + 1, y)].bg, palette.sub_alt);
    let (x, y) = find(&buffer, "› punctuation").unwrap();
    assert_eq!(buffer[(x, y)].fg, palette.main);
    assert!(find(&buffer, "▸ behavior").is_some());
}

#[test]
fn history_lists_saved_results_in_a_table_with_pb_crown() {
    let mut fixture = fixture(Config {
        mode: "words".into(),
        words: 10,
        ..Default::default()
    });
    for i in 0..10 {
        let word = fixture.host.words[i].display_lossy();
        fixture
            .host
            .insert(&word, 100.0 + i as f64 * 1000.0, 1100.0 + i as f64 * 1000.0)
            .unwrap();
    }
    assert!(
        fixture
            .local
            .capture(&fixture.host, &Capabilities::default(), 1_793_000_000_000.0)
            .unwrap()
    );
    fixture.local.history.refresh(&fixture.local.store).unwrap();
    let buffer = render(&fixture, Screen::History, 110, 30);
    if std::env::var("OXYTYPE_UI_DUMP").is_ok() {
        println!("{}", text(&buffer));
    }
    let palette = oxytype_tui::theme::Palette::named("rust");
    assert!(find(&buffer, "Local history").is_some());
    let (x, y) = find(&buffer, "accuracy").unwrap();
    assert_eq!(buffer[(x, y)].fg, palette.sub);
    let (x, y) = find(&buffer, "words 10").unwrap();
    assert_eq!(buffer[(x, y)].fg, palette.main);
    assert_eq!(buffer[(x, y)].bg, palette.sub_alt);
    assert!(find(&buffer, "♛").is_some());
    assert!(find(&buffer, "Oct 2026").is_some());
}

#[test]
fn help_groups_keybinds_as_key_chips() {
    let fixture = fixture(Config::default());
    let buffer = render(&fixture, Screen::Help, 100, 30);
    if std::env::var("OXYTYPE_UI_DUMP").is_ok() {
        println!("{}", text(&buffer));
    }
    let palette = oxytype_tui::theme::Palette::named("rust");
    let (x, y) = find(&buffer, " F6 ").unwrap();
    assert_eq!(buffer[(x + 1, y)].bg, palette.sub_alt);
    assert!(find(&buffer, "- repeat test").is_some());
    assert!(find(&buffer, "▸ terminal").is_some());
    assert!(find(&buffer, "protocol basic").is_some());
}
