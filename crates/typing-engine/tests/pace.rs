use typing_engine::{
    Text,
    pace::{Pace, Position, TypingTime},
};
#[test]
fn pace_corrects_each_error_once_and_remembers_repeated_speed() {
    let words = vec![Text::from("abc"), Text::from("def"), Text::from("ghi")];
    let mut pace = Pace::default();
    assert!(pace.reset(Some(120.0)));
    pace.correct(0, false, &Text::from("abc "), false);
    pace.correct(0, false, &Text::from("abc "), false);
    assert_eq!(
        pace.step(&words, false),
        Some(Position {
            word_index: 1,
            letter_index: 1,
            wpm: 120.0
        })
    );
    pace.correct(0, true, &Text::from("abc "), false);
    assert_eq!(
        pace.step(&words, false),
        Some(Position {
            word_index: 0,
            letter_index: 2,
            wpm: 120.0
        })
    );
    pace.remember(70.0, false);
    pace.remember(40.0, true);
    assert_eq!(pace.last_wpm(), 70.0);
    pace.remember(90.0, true);
    assert!(!pace.reset(None));
    assert_eq!(pace.last_wpm(), 90.0);
}
#[test]
fn pace_catches_up_from_start_then_disables_when_out_of_words() {
    let words = vec![Text::from("hi"), Text::from("you"), Text::from("all")];
    let mut pace = Pace::default();
    pace.reset(Some(60.0));
    pace.start(0.0);
    assert_eq!(pace.advance(199.0, &words, false).unwrap().letter_index, 0);
    assert_eq!(
        pace.advance(1200.0, &words, false),
        Some(Position {
            word_index: 1,
            letter_index: 3,
            wpm: 60.0
        })
    );
    assert!(pace.advance(5000.0, &words, false).is_none());
    assert!(!pace.reset(Some(f64::INFINITY)));
}
#[test]
fn typing_time_uses_explicit_local_day_and_preserves_session_before_load() {
    let mut time = TypingTime::default();
    time.add(10.0, 1);
    time.add(10.0, 2);
    assert_eq!(time.seconds(), 20.0);
    assert!(!time.is_today());
    time.load_today(10.0, 2);
    time.add(5.0, 2);
    assert_eq!(time.seconds(), 15.0);
    time.add(10.0, 3);
    time.add(5.0, 3);
    assert_eq!(time.seconds(), 15.0);
}
