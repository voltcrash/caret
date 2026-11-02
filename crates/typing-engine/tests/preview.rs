use typing_engine::{
    Config, Text,
    generation::{Content, Generator, Language, Prepare},
    random::Random,
};

fn language() -> Language {
    Language {
        name: "english".into(),
        words: [
            "colour",
            "centre",
            "a long phrase",
            "neighbor",
            "don't",
            "warm",
            "hello",
            "world",
        ]
        .into_iter()
        .map(Text::from)
        .collect(),
        ..Language::default()
    }
}

fn generator(config: Config, seed: u32) -> Generator {
    Generator::new(config, language(), None, Random::seeded(seed)).unwrap()
}

#[test]
fn preview_matches_fresh_generation_and_preserves_the_live_continuation() {
    for mode in ["time", "words"] {
        for words in [1, 25, 150] {
            for punctuation in [false, true] {
                let config = Config {
                    mode: mode.into(),
                    words,
                    punctuation,
                    numbers: true,
                    british_english: true,
                    lazy_mode: true,
                    show_all_lines: true,
                    ..Config::default()
                };
                let mut current = generator(config.clone(), 42);
                let mut control = generator(config.clone(), 42);
                let generated = current.generate(false).unwrap();
                control.generate(false).unwrap();
                let expected = generator(config, 99).generate(false).unwrap().words;
                assert_eq!(
                    current.preview(99).unwrap(),
                    expected[..expected.len().min(60)]
                );
                assert_eq!(
                    serde_json::to_value(current.random_state()).unwrap(),
                    serde_json::to_value(control.random_state()).unwrap()
                );
                let index = generated.words.len();
                assert_eq!(
                    current.next(index, index + 10, None, None).unwrap(),
                    control.next(index, index + 10, None, None).unwrap()
                );
            }
        }
    }
}

#[test]
fn preview_restores_generation_after_a_sampling_error() {
    let mut bad = language();
    bad.words = vec![Text::from(""), Text::from("valid")];
    let mut current = Generator::new(Config::default(), bad, None, Random::seeded(42)).unwrap();
    let before = serde_json::to_value(current.random_state()).unwrap();
    assert!((0..20).any(|seed| current.preview(seed).is_err()));
    assert_eq!(
        serde_json::to_value(current.random_state()).unwrap(),
        before
    );
    assert!(!current.is_repeating());
}

#[test]
fn preview_does_not_invalidate_prepared_session_words() {
    let mut content = Content::default();
    content
        .prepare(Prepare {
            config: Config::default(),
            language: language(),
            custom: None,
            random: Random::seeded(42),
            quotes: None,
            polyglot: vec![],
            selected_quote_id: 0,
            favorite_quote_ids: vec![],
            sections: vec![],
        })
        .unwrap();
    let generated = content.generate(false).unwrap();
    let preview = content.preview(99).unwrap();
    assert_ne!(preview, generated.words[..60]);
    let session = content.start_session(false).unwrap();
    assert_eq!(session.snapshot().words, generated.words);
}
