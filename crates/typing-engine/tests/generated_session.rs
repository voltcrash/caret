use typing_engine::{
    Command, Config, Session, Text,
    generation::{CustomLimit, CustomText, Generator, Language},
    random::Random,
};
fn generator(config: Config, custom: Option<CustomText>) -> Generator {
    Generator::new(
        config,
        Language {
            name: "english".into(),
            words: ["one", "two", "three", "four"]
                .into_iter()
                .map(Text::from)
                .collect(),
            ..Language::default()
        },
        custom,
        Random::seeded(42),
    )
    .unwrap()
}
fn insert(session: &mut Session, data: Text, now: f64) -> typing_engine::session::Update {
    session
        .apply(Command::Insert {
            data,
            now,
            date: now + 1_000_000.0,
            correct_shift_used: None,
            automatic: None,
            is_composition_ending: None,
            layout: None,
        })
        .unwrap()
}
#[test]
fn finite_session_generates_past_initial_window_and_finishes_on_final_bare_word() {
    let config = Config {
        mode: "words".into(),
        words: 150,
        ..Config::default()
    };
    let mut session = Session::from_generator(generator(config, None), false).unwrap();
    assert_eq!(session.snapshot().words.len(), 100);
    let mut changes = 0;
    for index in 0..150 {
        assert_eq!(session.state().word_index, index);
        let target = session.snapshot().words[index].clone();
        let update = insert(&mut session, target, 1000.0 + index as f64 * 100.0);
        changes += update.words.len();
        assert_eq!(update.state.ended, index == 149);
    }
    let snapshot = session.snapshot();
    assert!(changes >= 50);
    assert_eq!(snapshot.words.len(), 150);
    assert!(snapshot.all_words_generated);
    assert_ne!(snapshot.words.last().unwrap().0.last(), Some(&32));
    let ends = session.log()["events"]
        .as_array()
        .unwrap()
        .iter()
        .filter(|event| event["type"] == "timer" && event["data"]["event"] == "end")
        .count();
    assert_eq!(ends, 1);
}
#[test]
fn plus_zero_refills_before_deciding_completion() {
    let config = Config {
        mode: "words".into(),
        words: 3,
        funbox: vec!["plus_zero".into()],
        ..Config::default()
    };
    let mut session = Session::from_generator(generator(config, None), false).unwrap();
    assert_eq!(session.snapshot().words.len(), 1);
    for index in 0..3 {
        let target = session.snapshot().words[index].clone();
        let update = insert(&mut session, target, index as f64 * 500.0);
        assert_eq!(update.state.ended, index == 2);
        if index < 2 {
            assert_eq!(update.state.word_index, index + 1);
            assert!(!update.words.is_empty());
        }
    }
}
#[test]
fn custom_time_and_infinite_limits_do_not_finish_at_prepared_content_end() {
    for value in [2, 0] {
        let custom = CustomText {
            text: vec![Text::from("a")],
            mode: "repeat".into(),
            limit: CustomLimit {
                mode: "time".into(),
                value,
            },
            pipe_delimiter: false,
        };
        let mut session = Session::from_generator(
            generator(
                Config {
                    mode: "custom".into(),
                    ..Config::default()
                },
                Some(custom),
            ),
            false,
        )
        .unwrap();
        for index in 0..105 {
            insert(&mut session, Text::from("a "), index as f64 * 10.0);
        }
        assert!(!session.state().ended);
        session
            .apply(Command::Advance {
                now: 2000.0,
                date: 1_002_000.0,
            })
            .unwrap();
        assert_eq!(session.state().ended, value == 2);
        assert_eq!(
            session.log()["context"]["customTextLimitValue"].as_f64(),
            Some(value as f64)
        );
    }
}
#[test]
fn log_deltas_signal_rebasing_and_finalize_invalidation() {
    let mut session = Session::new(
        Config {
            mode: "words".into(),
            words: 1,
            ..Config::default()
        },
        vec![Text::from("a")],
    )
    .unwrap();
    session
        .apply(Command::Observe {
            now: 90.0,
            event_type: "keydown".into(),
            event_data: serde_json::json!({"code":"KeyA"}),
        })
        .unwrap();
    let update = insert(&mut session, Text::from("a"), 100.0);
    assert!(update.log_invalidated);
    assert_eq!(session.log()["events"][0]["testMs"], -10.0);
    assert!(
        session
            .apply(Command::Finalize { now: 120.0 })
            .unwrap()
            .log_invalidated
    );
    assert!(
        session
            .apply(Command::Reset { now: 130.0 })
            .unwrap()
            .log_invalidated
    );
}

#[test]
fn invalid_configuration_and_overdue_work_leave_session_unchanged() {
    let mut session = Session::new(Config::default(), vec![Text::from("word ")]).unwrap();
    let snapshot = serde_json::to_value(session.snapshot()).unwrap();
    let config = Config {
        difficulty: "unknown".into(),
        ..Config::default()
    };
    assert!(
        session
            .apply(Command::Configure {
                now: 0.0,
                config: Box::new(config)
            })
            .is_err()
    );
    assert!(
        session
            .apply(Command::Insert {
                data: Text(vec![97; 65537]),
                now: 0.0,
                date: 0.0,
                correct_shift_used: None,
                automatic: None,
                is_composition_ending: None,
                layout: None,
            })
            .is_err()
    );
    assert_eq!(snapshot, serde_json::to_value(session.snapshot()).unwrap());
    insert(&mut session, Text::from("w"), 0.0);
    let log = session.log();
    assert!(
        session
            .apply(Command::Advance {
                now: 1_000_001_000.0,
                date: 0.0
            })
            .is_err()
    );
    assert_eq!(log, session.log());
}
