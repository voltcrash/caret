use typing_engine::{Command, Config, Session, Text};
fn command(value: serde_json::Value) -> Command {
    serde_json::from_value(value).unwrap()
}
#[test]
fn live_queries_preserve_clock_accuracy_spacing_and_reset_without_log_reads() {
    let mut session = Session::new(
        Config {
            mode: "time".into(),
            time: 0.0,
            ..Config::default()
        },
        vec![Text::from("one "), Text::from("two ")],
    )
    .unwrap();
    let empty = session.live_stats(100.0).unwrap();
    assert_eq!(empty.acc, 100.0);
    assert_eq!(empty.time_limit_seconds, Some(0.0));
    assert_eq!(empty.wpm, 0.0);
    assert_eq!(empty.timer_start_ms, None);
    assert_eq!(empty.ms_since_last_input, None);
    session
        .apply(command(
            serde_json::json!({"op":"insert","data":Text::from("o"),"now":100.123}),
        ))
        .unwrap();
    session
        .apply(command(
            serde_json::json!({"op":"insert","data":Text::from("x"),"now":200.237}),
        ))
        .unwrap();
    session
        .apply(command(
            serde_json::json!({"op":"delete","kind":"deleteContentBackward","now":250.0}),
        ))
        .unwrap();
    session
        .apply(command(
            serde_json::json!({"op":"insert","data":Text::from("ne "),"now":300.349}),
        ))
        .unwrap();
    let live = session.live_stats(1100.123).unwrap();
    assert_eq!(live.acc, 80.0);
    assert_eq!(live.seconds, 1.0);
    assert_eq!(live.duration_ms, 1000.0);
    assert_eq!(live.timer_start_ms, Some(100.123));
    assert_eq!(live.ms_since_last_input, Some(0.0));
    assert_eq!(live.chars.correct_word, 4);
    assert_eq!(live.wpm, 48.0);
    assert_eq!(live.raw, 48.0);
    let log = serde_json::from_value(session.log()).unwrap();
    assert_eq!(
        session.word_burst(0, 1100.123).unwrap(),
        typing_engine::stats::word_burst(&log, 0, 1000.0)
    );
    assert_eq!(session.word_burst(100, 1100.123).unwrap(), 0.0);
    assert!(session.word_burst(0, f64::INFINITY).is_err());
    session.apply(Command::Finalize { now: 1100.123 }).unwrap();
    let after = session.live_stats(1100.123).unwrap();
    assert_eq!(
        serde_json::to_value(live).unwrap(),
        serde_json::to_value(after).unwrap()
    );
    assert!(session.live_stats(f64::NAN).is_err());
    session.apply(Command::Reset { now: 1200.0 }).unwrap();
    let fresh = session.live_stats(1200.0).unwrap();
    assert_eq!(fresh.acc, 100.0);
    assert_eq!(fresh.ms_since_last_input, None);
    assert_eq!(fresh.timer_start_ms, None);
    assert_eq!(fresh.wpm, 0.0);
}

#[test]
fn owned_delete_preflight_preserves_confidence_freedom_and_visible_word_guards() {
    let mut session = Session::new(
        Config {
            mode: "words".into(),
            words: 0,
            ..Config::default()
        },
        vec![Text::from("a "), Text::from("b ")],
    )
    .unwrap();
    assert!(!session.can_delete());
    session
        .apply(command(
            serde_json::json!({"op":"insert","data":Text::from("a "),"now":1}),
        ))
        .unwrap();
    assert!(!session.can_delete()); // completed previous word, freedom off
    let config = Config {
        mode: "words".into(),
        words: 0,
        freedom_mode: true,
        ..Config::default()
    };
    session
        .apply(Command::Configure {
            now: 2.0,
            config: Box::new(config),
        })
        .unwrap();
    assert!(session.can_delete());
    session
        .apply(command(
            serde_json::json!({"op":"view","now":2,"earliestVisibleWord":1}),
        ))
        .unwrap();
    assert!(!session.can_delete());
    session
        .apply(command(
            serde_json::json!({"op":"insert","data":Text::from("x"),"now":3}),
        ))
        .unwrap();
    assert!(session.can_delete());
    let config = Config {
        mode: "words".into(),
        words: 0,
        confidence_mode: "max".into(),
        ..Config::default()
    };
    session
        .apply(Command::Configure {
            now: 4.0,
            config: Box::new(config),
        })
        .unwrap();
    assert!(!session.can_delete());
}
