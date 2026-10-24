use serde_json::{Value, json};
use typing_engine::{
    Command, Config, Session, Text,
    analysis::{self, Query},
    error::ErrorCode,
    replay::Playback,
    stats::Log,
    validation,
};
fn valid_log() -> Log {
    serde_json::from_value(json!({"version":1,"context":{"targetWords":[[97]],"mode":"words","mode2":"1","bailedOut":false,"koreanStatus":false},"events":[
{"type":"keydown","testMs":-20,"data":{"code":"KeyA"}},
{"type":"timer","testMs":0,"data":{"event":"start","timer":0,"date":1000}},
{"type":"input","testMs":10,"data":{"inputType":"insertText","wordIndex":0,"charIndex":0,"inputValue":[97],"data":[97],"correct":true}},
{"type":"timer","testMs":10,"data":{"event":"end","timer":0,"date":1010}}
]})).unwrap()
}
#[test]
fn malformed_history_is_rejected_before_replay_allocation_or_analysis() {
    let original = serde_json::to_value(valid_log()).unwrap();
    for (path, value) in [
        ("/version", json!(999)),
        ("/context/mode", json!("unknown")),
        ("/events/2/data/wordIndex", json!(u64::MAX)),
        ("/events/2/data/charIndex", json!(1_000_001)),
        ("/events/2/data/inputValue", json!([65536])),
        ("/events/2/data/data", json!([1.5])),
        ("/events/2/data/inputType", json!("paste")),
        ("/events/2/data/correct", json!("true")),
        ("/events/2/type", json!("unknown")),
        ("/events/1/data/event", json!("unknown")),
        ("/events/1/data/date", Value::Null),
        ("/events/1/data/timer", json!(1_000_001)),
        ("/events/0/data/code", Value::Null),
        ("/events/2/testMs", json!(-21)),
        ("/events/3/testMs", json!(1_000_000_001)),
    ] {
        let mut value_log = original.clone();
        *value_log.pointer_mut(path).unwrap() = value;
        let log: Log = serde_json::from_value(value_log).unwrap();
        assert_eq!(
            validation::log(&log).unwrap_err().code,
            ErrorCode::InvalidLog,
            "{path}"
        );
        assert_eq!(
            Playback::new(&log, false).err().unwrap().code,
            ErrorCode::InvalidLog,
            "{path}"
        );
        assert_eq!(
            analysis::analyze(&log, Query::Stats { now: 20.0 })
                .err()
                .unwrap()
                .code,
            ErrorCode::InvalidLog,
            "{path}"
        );
    }
    let mut nan = valid_log();
    nan.events[0].test_ms = f64::NAN;
    assert!(validation::log(&nan).is_err());
    assert!(validation::log(&valid_log()).is_ok()); // negative pre-start keys remain supported
    assert!(
        analysis::analyze(
            &valid_log(),
            Query::Frame {
                time: f64::INFINITY
            }
        )
        .is_err()
    );
}
#[test]
fn malformed_observations_and_settings_do_not_mutate_a_session() {
    let mut session = Session::new(Config::default(), vec![Text::from("one ")]).unwrap();
    for (kind, data) in [
        ("composition", json!({"event":"wrong"})),
        ("composition", json!({"event":"update","data":[65536]})),
        ("timer", json!({"event":"step","timer":-1})),
        ("keydown", json!({"code":"KeyA","ctrl":"yes"})),
        ("keyup", json!({"code":"KeyA","wordIndex":u64::MAX})),
        ("input", json!({})),
    ] {
        let before = session.log();
        assert_eq!(
            session
                .apply(Command::Observe {
                    now: 0.0,
                    event_type: kind.into(),
                    event_data: data
                })
                .err()
                .unwrap()
                .code,
            ErrorCode::InvalidInput
        );
        assert_eq!(session.log(), before);
    }
    let mut deep = json!({});
    for _ in 0..20 {
        deep = json!({"nested":deep});
    }
    assert!(validation::observation("keydown", &json!({"code":"KeyA","extra":deep})).is_err());
    let before = session.log();
    let config = Config {
        words: u32::MAX,
        ..Config::default()
    };
    assert_eq!(
        session
            .apply(Command::Configure {
                now: 0.0,
                config: Box::new(config)
            })
            .err()
            .unwrap()
            .code,
        ErrorCode::InvalidConfig
    );
    assert_eq!(session.log(), before);
    assert!(
        session
            .apply(Command::Delete {
                kind: "deleteContentBackward".into(),
                now: 0.0,
                date: f64::NAN,
                observed_input: None,
                sentinel_removed: false
            })
            .is_err()
    );
}
#[test]
fn content_metadata_limits_cover_sources_quotes_languages_and_random_streams() {
    use typing_engine::{
        content::Source, generation::Language, quotes::QuoteAsset, random::Random,
    };
    let source = Source::Poem {
        title: Text(vec![97; 10001]),
        author: Text::default(),
        lines: vec![Text::from("one")],
    };
    assert_eq!(
        source.normalize(true).unwrap_err().code,
        ErrorCode::InvalidContent
    );
    let language = Language {
        additional_accents: vec![(Text(vec![0; 1_000_001]), Text::default())],
        ..Language::default()
    };
    assert!(validation::language(&language).is_err());
    assert!(
        validation::random(&Random::Stream {
            values: vec![0.5],
            cursor: 2
        })
        .is_err()
    );
    assert!(
        validation::random(&Random::Stream {
            values: vec![f64::NAN],
            cursor: 0
        })
        .is_err()
    );
    let quote: QuoteAsset =
        serde_json::from_value(json!({"language":"english","groups":[[100,0]],"quotes":[]}))
            .unwrap();
    assert!(validation::quote_asset(&quote).is_err());
    assert!(validation::words(&vec![Text(vec![0; 1_000_000]); 6]).is_err());
    let config = Config {
        quote_length: vec![99],
        ..Config::default()
    };
    assert!(config.validate().is_err());
}
