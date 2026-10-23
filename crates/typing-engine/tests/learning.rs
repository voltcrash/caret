use serde_json::json;
use typing_engine::{
    Session, Text,
    generation::{Content, Prepare},
    pace::PaceCommand,
};
fn input() -> Prepare {
    serde_json::from_value(json!({
        "config":{"mode":"words","words":30,"funbox":["weakspot"]},
        "language":{"name":"english","words":[[97],[120]]},
        "random":{"kind":"seeded","state":1}
    }))
    .unwrap()
}
#[test]
fn recycling_retains_learning_and_pace_but_discards_input_and_pending_work() {
    let mut owner = Content::default();
    owner.prepare(input()).unwrap();
    let mut session = owner.start_session(false).unwrap();
    for (now, data) in [(0, "a"), (100, "x")] {
        session
            .apply(
                serde_json::from_value(json!({"op":"insert","now":now,"data":Text::from(data)}))
                    .unwrap(),
            )
            .unwrap();
    }
    session
        .pace_command(PaceCommand::Remember {
            wpm: 77.0,
            repeating: false,
        })
        .unwrap();
    session
        .pace_command(PaceCommand::Remember {
            wpm: 40.0,
            repeating: true,
        })
        .unwrap();
    owner.recycle_session(session);
    owner.prepare(input()).unwrap();
    let mut next = owner.start_session(false).unwrap();
    assert_eq!(
        next.pace_command(PaceCommand::Reset { wpm: None })
            .unwrap()
            .last_wpm,
        77.0
    );
    assert!(
        next.snapshot()
            .words
            .iter()
            .all(|word| word.0 == [120, 32] || word.0 == [120])
    );
    assert!(next.log()["events"].as_array().unwrap().is_empty());
    assert!(!next.snapshot().state.active);
    let mut isolated = Content::default();
    isolated.prepare(input()).unwrap();
    let mut fresh = isolated.start_session(false).unwrap();
    assert_eq!(
        fresh
            .pace_command(PaceCommand::Reset { wpm: None })
            .unwrap()
            .last_wpm,
        0.0
    );
    assert!(
        fresh
            .snapshot()
            .words
            .iter()
            .any(|word| word.0 == [97, 32] || word.0 == [97])
    );
}
#[test]
fn session_pace_uses_bare_utf16_words_and_rejects_excessive_catchup_before_mutation() {
    let mut session = Session::new(
        Default::default(),
        vec![Text::from("a "), Text::from("😀\n")],
    )
    .unwrap();
    session
        .pace_command(PaceCommand::Reset { wpm: Some(120.0) })
        .unwrap();
    session
        .pace_command(PaceCommand::Start { now: 100.0 })
        .unwrap();
    assert_eq!(
        session
            .pace_command(PaceCommand::Step)
            .unwrap()
            .position
            .unwrap()
            .letter_index,
        1
    );
    let second = session.pace_command(PaceCommand::Step).unwrap();
    assert_eq!(second.position.unwrap().word_index, 1);
    assert_eq!(second.step_end, 300.0);
    assert!(
        session
            .pace_command(PaceCommand::Advance { now: f64::NAN })
            .is_err()
    );
    assert!(
        session
            .pace_command(PaceCommand::Advance { now: 1e12 })
            .is_err()
    );
    let third = session.pace_command(PaceCommand::Step).unwrap();
    assert_eq!(third.position.unwrap().letter_index, 1);
    assert_eq!(third.step_end, 400.00000000000006);
}
