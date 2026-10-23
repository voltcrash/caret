use typing_engine::{
    Text,
    custom_progress::{LongProgress, from_history},
};
#[test]
fn long_progress_preserves_space_newline_and_utf16_display_boundaries() {
    for (target, typed, increment) in [
        ("one ", "on", 0),
        ("one ", "one", 1),
        ("one\n", "one", 0),
        ("one\n", "one\n", 1),
        ("😀 ", "😀", 1),
        ("\t ", "\t", 1),
    ] {
        let targets = vec![Text::from(target), Text::from("later")];
        let history = vec![Text::from(typed)];
        assert_eq!(
            from_history(30, false, &history, &targets),
            LongProgress {
                completed: false,
                progress: 30 + increment
            }
        );
    }
    assert_eq!(
        from_history(0, true, &[Text(vec![0xd800])], &[Text(vec![0xd800, 32])]),
        LongProgress {
            completed: false,
            progress: 1
        }
    );
}
#[test]
fn completion_resets_progress_and_bailout_saves_only_complete_words() {
    let targets = vec![Text::from("one "), Text::from("two")];
    let history = vec![Text::from("one "), Text::from("t")];
    // Preserve the existing completion rule: a full-length history resets even
    // if its final snapshot is partial; an explicit bailout saves progress.
    assert_eq!(
        from_history(10, false, &history, &targets),
        LongProgress {
            completed: true,
            progress: 0
        }
    );
    assert_eq!(
        from_history(10, true, &history, &targets),
        LongProgress {
            completed: false,
            progress: 11
        }
    );
    assert_eq!(
        from_history(10, true, &[], &targets),
        LongProgress {
            completed: false,
            progress: 10
        }
    );
    assert_eq!(
        from_history(u32::MAX, true, &[Text::from("one")], &targets).progress,
        4_294_967_296
    );
}
