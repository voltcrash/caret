use oxytype_tui::{
    content::OfflineContent,
    engine::EngineHost,
    input::Capabilities,
    local::Local,
    replay::Replay,
    storage::{Paths, Settings, Store},
};
use typing_engine::{Config, replay::Cursor};

fn finished() -> EngineHost {
    let mut host = EngineHost::offline(
        Config {
            mode: "words".into(),
            words: 10,
            ..Default::default()
        },
        OfflineContent::bundled().unwrap(),
        None,
        42,
    )
    .unwrap();
    for i in 0..10 {
        let word = host.words[i].display_lossy();
        host.insert(&word, 100.0 + i as f64 * 1000.0, 1100.0 + i as f64 * 1000.0)
            .unwrap();
    }
    host
}
#[test]
fn failed_write_queue_retries_the_same_uuid_once_and_history_filters_page() {
    let temp = tempfile::tempdir().unwrap();
    let paths = Paths {
        config: temp.path().join("config"),
        data: temp.path().join("data"),
    };
    let store = Store::open(&paths).unwrap();
    let mut local = Local::new(store, Settings::default());
    let host = finished();
    let lock = rusqlite::Connection::open(paths.data.join("history.sqlite3")).unwrap();
    lock.execute_batch("BEGIN IMMEDIATE").unwrap();
    assert!(
        local
            .capture(&host, &Capabilities::default(), 10000.0)
            .is_err()
    );
    assert_eq!(local.pending.len(), 1);
    let id = local.pending[0]["id"].clone();
    assert!(
        !local
            .capture(&host, &Capabilities::default(), 10001.0)
            .unwrap()
    );
    lock.execute_batch("ROLLBACK").unwrap();
    local.retry().unwrap();
    assert!(local.pending.is_empty());
    local.history.refresh(&local.store).unwrap();
    assert_eq!(local.history.rows[0]["id"], id);
    local.history.filter(&local.store).unwrap();
    assert!(local.history.rows.is_empty()); // time
    local.history.filter(&local.store).unwrap();
    assert_eq!(local.history.rows.len(), 1); // words
    local.history.page(1, &local.store).unwrap();
    assert_eq!(local.history.rows.len(), 1);
    assert!(local.store.history_page(None, 100, 1).unwrap().is_empty());
}
#[test]
fn replay_requires_opt_in_and_compatible_versions_and_uses_native_steps_and_seek() {
    let host = finished();
    let cap = Capabilities::default();
    let summary_only = oxytype_tui::storage::record(&host, &cap, false, 10000.0).unwrap();
    assert!(Replay::new(&summary_only).is_err());
    let record = oxytype_tui::storage::record(&host, &cap, true, 10000.0).unwrap();
    let mut replay = Replay::new(&record).unwrap();
    let mut steps = 0;
    while replay.frame.next_time.is_some() {
        replay.step();
        steps += 1;
    }
    assert!(steps > 10);
    assert_eq!(replay.frame.next_index, steps);
    replay.seek(Cursor::default());
    assert_eq!(replay.frame.next_index, 0);
    replay.seek(Cursor {
        word_index: 5,
        letter_index: 0,
    });
    assert_eq!(replay.frame.cursor.word_index, 5);
    let mut future = record;
    future["engineBehaviorVersion"] = serde_json::json!(99);
    assert!(Replay::new(&future).is_err());
}
