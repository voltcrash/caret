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
