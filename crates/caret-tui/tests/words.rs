use caret_tui::{
    theme::Palette,
    words::{Letter, Stream, letters, view},
};
use typing_engine::Text;

fn words(list: &[&str]) -> Vec<Text> {
    list.iter().map(|w| Text::from(*w)).collect()
}

#[test]
fn letters_mark_correct_incorrect_untyped_and_extra() {
    let (marked, caret) = letters(&Text::from("two"), &Text::from("twxyz"), "english");
    let states: Vec<_> = marked.iter().map(|(_, l)| *l).collect();
    assert_eq!(
        states,
        [
            Letter::Correct,
            Letter::Correct,
            Letter::Incorrect,
            Letter::Extra,
            Letter::Extra
        ]
    );
    assert_eq!(caret, 5);
    let (_, caret) = letters(&Text::from("two"), &Text::from("t"), "english");
    assert_eq!(caret, 1);
}

#[test]
fn stream_wraps_whole_words_and_keeps_caret_line_near_top() {
    let palette = Palette::named("rust");
    let list = words(&["alpha ", "beta ", "gamma ", "delta ", "omega ", "kappa "]);
    let inputs = words(&["alpha ", "beta ", "gamma "]);
    let input = Text::from("de");
    let shown = view(
        Stream {
            words: &list,
            inputs: &inputs,
            index: 3,
            input: &input,
            language: "english",
            palette: &palette,
        },
        12,
        3,
    );
    assert_eq!(shown.lines.len(), 3);
    // Caret on the second line stays put; reaching the third line scrolls one.
    assert_eq!(shown.lines[1].to_string().trim_end(), "gamma delta");
    assert_eq!(shown.caret, (8, 1));
    assert!(!shown.errors);
    let first = &shown.lines[0].spans[0];
    assert_eq!(first.style.fg, Some(palette.text));
    let untyped = &shown.lines[2].spans[0];
    assert_eq!(untyped.style.fg, Some(palette.sub));
}

#[test]
fn committed_mistakes_are_underlined_errors() {
    let palette = Palette::named("rust");
    let list = words(&["one ", "two "]);
    let inputs = words(&["onx "]);
    let input = Text::default();
    let shown = view(
        Stream {
            words: &list,
            inputs: &inputs,
            index: 1,
            input: &input,
            language: "english",
            palette: &palette,
        },
        20,
        3,
    );
    assert!(shown.errors);
    let wrong = &shown.lines[0].spans[2];
    assert_eq!(wrong.content, "e");
    assert_eq!(wrong.style.fg, Some(palette.error));
    assert!(
        wrong
            .style
            .add_modifier
            .contains(ratatui::style::Modifier::UNDERLINED)
    );
    assert_eq!(shown.caret, (4, 0));
}

#[test]
fn zen_streams_typed_text_without_targets() {
    let palette = Palette::named("rust");
    let inputs = words(&["hello "]);
    let input = Text::from("wor");
    let shown = view(
        Stream {
            words: &[],
            inputs: &inputs,
            index: 1,
            input: &input,
            language: "english",
            palette: &palette,
        },
        20,
        3,
    );
    assert_eq!(shown.lines[0].to_string().trim_end(), "hello wor");
    assert_eq!(shown.caret, (9, 0));
}

#[test]
fn stream_scrolls_once_caret_reaches_third_line() {
    let palette = Palette::named("rust");
    let list = words(&[
        "alpha ", "beta ", "gamma ", "delta ", "omega ", "kappa ", "sigma ",
    ]);
    let inputs = words(&["alpha ", "beta ", "gamma ", "delta "]);
    let input = Text::default();
    let shown = view(
        Stream {
            words: &list,
            inputs: &inputs,
            index: 4,
            input: &input,
            language: "english",
            palette: &palette,
        },
        12,
        3,
    );
    assert_eq!(shown.lines[0].to_string().trim_end(), "gamma delta");
    assert_eq!(shown.caret, (0, 1));
}

#[test]
fn extra_letters_sit_before_the_separator() {
    let palette = Palette::named("rust");
    let list = words(&["two ", "six "]);
    let inputs = words(&["twox "]);
    let input = Text::default();
    let shown = view(
        Stream {
            words: &list,
            inputs: &inputs,
            index: 1,
            input: &input,
            language: "english",
            palette: &palette,
        },
        20,
        3,
    );
    assert_eq!(shown.lines[0].to_string().trim_end(), "twox six");
    assert_eq!(shown.lines[0].spans[3].style.fg, Some(palette.error_extra));
    assert_eq!(shown.caret, (5, 0));
}

#[test]
fn live_mistakes_are_underlined_without_relying_on_colour() {
    let palette = Palette::named("rust");
    let list = words(&["two "]);
    let input = Text::from("tx");
    let shown = view(
        Stream {
            words: &list,
            inputs: &[],
            index: 0,
            input: &input,
            language: "english",
            palette: &palette,
        },
        20,
        3,
    );
    let modifier = |i: usize| shown.lines[0].spans[i].style.add_modifier;
    assert!(!modifier(0).contains(ratatui::style::Modifier::UNDERLINED));
    assert!(modifier(1).contains(ratatui::style::Modifier::UNDERLINED));
    assert!(!modifier(2).contains(ratatui::style::Modifier::UNDERLINED));
}
