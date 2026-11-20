use caret_tui::{
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
fn history_crowns_use_group_bests_from_all_pages_until_refresh() {
    let temp = tempfile::tempdir().unwrap();
    let paths = Paths {
        config: temp.path().join("config"),
        data: temp.path().join("data"),
    };
    let mut store = Store::open(&paths).unwrap();
    let mut history = caret_tui::history::History::default();
    let score = |id: usize, group: &str, wpm: u32, eligible: bool| {
        serde_json::json!({
            "id": id.to_string(), "formatVersion": 1, "createdMs": id, "config": {"mode": "words"},
            "personalBestEligible": eligible, "personalBestGroup": group, "summary": {"wpm": wpm},
        })
    };
    store.save(&score(0, "a", 100, true)).unwrap();
    for i in 1..=100 {
        store.save(&score(i, "a", 80, true)).unwrap();
    }
    store.save(&score(101, "b", 50, true)).unwrap();
    store.save(&score(102, "b", 150, false)).unwrap();
    history.refresh(&store).unwrap();
    assert!(!history.best(&history.rows[0]));
    assert!(history.best(&history.rows[1]));
    assert!(!history.best(&history.rows[2]));
    store.save(&score(103, "b", 90, true)).unwrap();
    assert!(history.best(&history.rows[1]));
    history.refresh(&store).unwrap();
    assert!(history.best(&history.rows[0]));
    assert!(!history.best(&history.rows[2]));
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
    drop(local);
    let mut store = Store::open(&paths).unwrap();
    assert!(store.recover_pending().unwrap().is_empty());
    let mut local = Local::new(store, Settings::default());
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
    let summary_only = caret_tui::storage::record(&host, &cap, false, 10000.0).unwrap();
    assert!(Replay::new(&summary_only).is_err());
    let record = caret_tui::storage::record(&host, &cap, true, 10000.0).unwrap();
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

#[test]
fn recovery_preserves_bad_files_and_imports_valid_neighbors() {
    let temp = tempfile::tempdir().unwrap();
    let paths = Paths {
        config: temp.path().join("config"),
        data: temp.path().join("data"),
    };
    let mut store = Store::open(&paths).unwrap();
    let dir = paths.data.join("pending");
    std::fs::create_dir(&dir).unwrap();
    let bad = dir.join("broken.json");
    std::fs::write(&bad, b"{").unwrap();
    let id = "valid";
    let valid = serde_json::json!({"id": id, "createdMs": 1, "config": {"mode": "words"}});
    let spool = dir.join(format!("{}.json", caret_tui::storage::hash(&id).unwrap()));
    std::fs::write(&spool, serde_json::to_vec(&valid).unwrap()).unwrap();
    let warnings = store.recover_pending().unwrap();
    assert_eq!(warnings.len(), 1);
    assert!(warnings[0].contains(bad.to_str().unwrap()));
    assert_eq!(std::fs::read(bad).unwrap(), b"{");
    assert!(!spool.exists());
    assert_eq!(store.history(None, 10).unwrap(), vec![valid]);
}
