use oxytype_tui::{
    content::OfflineContent,
    engine::EngineHost,
    input::Capabilities,
    storage::{self, Paths, Store},
};
use serde_json::{Value, json};
use typing_engine::Config;

fn paths(root: &std::path::Path) -> Paths {
    Paths {
        config: root.join("config"),
        data: root.join("data"),
    }
}
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
    assert!(host.state().ended);
    host
}
#[test]
fn restart_persistence_idempotency_private_defaults_and_lossless_export() {
    let temp = tempfile::tempdir().unwrap();
    let paths = paths(temp.path());
    let mut store = Store::open(&paths).unwrap();
    let mut settings = store.settings().unwrap();
    settings.config.words = 25;
    store.save_settings(&settings).unwrap();
    let host = finished();
    let record = storage::record(&host, &Capabilities::default(), false, 10000.0).unwrap();
    assert!(record["replayLog"].is_null());
    for field in [
        "keySpacing",
        "keyDuration",
        "keyOverlap",
        "keyConsistency",
        "startToFirstKey",
        "lastKeyToEnd",
    ] {
        assert!(record["summary"][field].is_null());
    }
    assert_eq!(
        record["summary"]["wpm"],
        serde_json::to_value(host.result.as_ref().unwrap().wpm).unwrap()
    );
    assert_eq!(record["personalBestEligible"], true);
    store.save(&record).unwrap();
    assert_eq!(
        store
            .best(record["personalBestGroup"].as_str().unwrap())
            .unwrap(),
        host.result.as_ref().map(|s| s.wpm)
    );
    store.save(&record).unwrap();
    drop(store);
    let mut store = Store::open(&paths).unwrap();
    assert_eq!(store.settings().unwrap().config.words, 25);
    let history = store.history(Some("words"), 100).unwrap();
    assert_eq!(history, vec![record.clone()]);
    assert!(store.history(Some("zen"), 100).unwrap().is_empty());
    let mut future = record.clone();
    future["id"] = json!("future");
    future["formatVersion"] = json!(99);
    future["unknownFutureField"] = json!({"preserve":true});
    store.save(&future).unwrap();
    let output = temp.path().join("export.json");
    store.export(&output, None).unwrap();
    let exported: Value = serde_json::from_slice(&std::fs::read(&output).unwrap()).unwrap();
    assert!(exported["results"].as_array().unwrap().contains(&future));
    assert!(store.export(&output, None).is_err()); // Never overwrite a prior export.
    let mut collision = record.clone();
    collision["seed"] = json!(99);
    assert!(store.save(&collision).is_err());
    assert_eq!(store.history(None, 100).unwrap().len(), 2);
    let replay = storage::record(&host, &Capabilities::default(), true, 11000.0).unwrap();
    assert_eq!(
        replay["replayLog"],
        serde_json::to_value(host.log().unwrap()).unwrap()
    );
}
#[test]
fn concurrent_settings_use_revision_checks_and_result_writes_do_not_clobber() {
    let temp = tempfile::tempdir().unwrap();
    let paths = paths(temp.path());
    let mut a = Store::open(&paths).unwrap();
    let mut b = Store::open(&paths).unwrap();
    let mut settings = a.settings().unwrap();
    b.settings().unwrap();
    settings.config.words = 25;
    a.save_settings(&settings).unwrap();
    assert!(b.save_settings(&settings).is_err());
    assert_eq!(b.settings().unwrap().config.words, 25);
    let base = storage::record(&finished(), &Capabilities::default(), false, 10000.0).unwrap();
    let workers: Vec<_> = (0..8)
        .map(|i| {
            let paths = paths.clone();
            let mut record = base.clone();
            record["id"] = json!(format!("worker-{i}"));
            std::thread::spawn(move || {
                Store::open(&paths).unwrap().save(&record).unwrap();
            })
        })
        .collect();
    for worker in workers {
        worker.join().unwrap();
    }
    assert_eq!(a.history(None, 100).unwrap().len(), 8);
}
#[test]
fn malformed_future_and_interrupted_storage_preserve_prior_data() {
    let temp = tempfile::tempdir().unwrap();
    let paths = paths(temp.path());
    let mut store = Store::open(&paths).unwrap();
    store.settings().unwrap();
    drop(store);
    let dbpath = paths.data.join("history.sqlite3");
    let mut db = rusqlite::Connection::open(&dbpath).unwrap();
    {
        let tx = db.transaction().unwrap();
        tx.execute(
            "INSERT INTO results VALUES('interrupted',1,'words','{}')",
            [],
        )
        .unwrap();
    } // Uncommitted write rolled back.
    assert!(
        Store::open(&paths)
            .unwrap()
            .history(None, 100)
            .unwrap()
            .is_empty()
    );
    db.pragma_update(None, "user_version", 99).unwrap();
    drop(db);
    assert!(Store::open(&paths).is_err());
    assert_eq!(
        rusqlite::Connection::open(&dbpath)
            .unwrap()
            .pragma_query_value(None, "user_version", |r| r.get::<_, i64>(0))
            .unwrap(),
        99
    );
    let bad = temp.path().join("malformed");
    std::fs::create_dir_all(&bad).unwrap();
    let path = bad.join("settings.sqlite3");
    std::fs::write(&path, b"not a database").unwrap();
    assert!(
        Store::open(&Paths {
            config: bad,
            data: paths.data
        })
        .is_err()
    );
    assert_eq!(std::fs::read(path).unwrap(), b"not a database");
}
