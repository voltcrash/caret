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
