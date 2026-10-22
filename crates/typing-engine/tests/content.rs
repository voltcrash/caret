use serde_json::Value;
use typing_engine::{
    Text,
    content::{Queue, Source},
};
#[test]
fn poetry_and_extracted_article_cleanup_match_unchanged_typescript() {
    let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../packages/typing-fixtures/oracle/content.json");
    let references: Vec<Value> = serde_json::from_slice(&std::fs::read(path).unwrap()).unwrap();
    for (index, reference) in references.into_iter().enumerate() {
        let source: Source = serde_json::from_value(reference["source"].clone()).unwrap();
        let section = source
            .normalize(reference["english"].as_bool().unwrap())
            .unwrap();
        assert_eq!(
            serde_json::to_value(section).unwrap(),
            reference["expected"],
            "content case {index}"
        );
    }
}
fn poem(word: &str) -> Source {
    Source::Poem {
        title: Text::from("Title"),
        author: Text::from("Author"),
        lines: vec![Text::from(word)],
    }
}
#[test]
fn section_requests_are_owned_bounded_and_cancelled_by_generation() {
    let mut queue = Queue::new("poetry".into(), "english".into(), true);
    let first = queue.request();
    assert_eq!(queue.request(), first);
    assert!(
        queue
            .supply(
                &first,
                Source::Article {
                    title: Text::default(),
                    author: None,
                    plain_text: Text::from("text")
                }
            )
            .is_err()
    );
    assert_eq!(queue.pending(), Some(&first));
    queue.reset(1);
    let second = queue.request();
    assert_ne!(first, second);
    assert!(queue.supply(&first, poem("stale")).is_err());
    let mut forged = second.clone();
    forged.language = "french".into();
    assert!(queue.supply(&forged, poem("forged")).is_err());
    queue.supply(&second, poem("fresh")).unwrap();
    assert!(queue.pending().is_none());
    assert_eq!(queue.pop().unwrap().words, vec![Text::from("fresh")]);
    for _ in 0..16 {
        queue.prefetch(poem("word")).unwrap();
    }
    assert!(queue.prefetch(poem("overflow")).is_err());
    for _ in 0..16 {
        assert_eq!(queue.pop().unwrap().words, vec![Text::from("word")]);
    }
    assert!(queue.is_empty());
}

fn section_generator(prefetch: Vec<Source>) -> typing_engine::generation::Generator {
    use typing_engine::{
        Config,
        generation::{Assets, Generator, Language},
        random::Random,
    };
    let config = Config {
        mode: "words".into(),
        words: 12,
        punctuation: true,
        funbox: vec!["poetry".into()],
        ..Config::default()
    };
    Generator::with_assets(
        config,
        Language {
            name: "english".into(),
            words: vec![Text::from("base")],
            ..Language::default()
        },
        None,
        Random::seeded(4),
        &mut Assets {
            sections: prefetch,
            ..Assets::default()
        },
    )
    .unwrap()
}
#[test]
fn deferred_initial_generation_resumes_without_repeating_words_or_random_draws() {
    let sources: Vec<_> = (0..4)
        .map(|index| poem(&format!("Section{index} café Three Four")))
        .collect();
    let mut baseline = section_generator(sources.clone());
    let expected = baseline.generate(false).unwrap();
    let mut deferred = section_generator(vec![]);
    let mut replies = 0;
    let actual = loop {
        match deferred.generate(false) {
            Ok(generated) => break generated,
            Err(error) => {
                assert_eq!(error, "Section content required");
                let request = deferred.pending_request().unwrap().clone();
                assert!(deferred.generate(true).is_err());
                deferred.supply(&request, sources[replies].clone()).unwrap();
                assert!(deferred.supply(&request, poem("duplicate")).is_err());
                replies += 1;
            }
        }
    };
    assert_eq!(replies, 3);
    assert_eq!(
        serde_json::to_value(&actual).unwrap(),
        serde_json::to_value(&expected).unwrap()
    );
    assert_eq!(actual.words[0], Text::from("Section0 "));
    assert_eq!(actual.words[1], Text::from("café "));
    assert_eq!(
        serde_json::to_value(deferred.generate(true).unwrap()).unwrap(),
        serde_json::to_value(expected).unwrap()
    );
}
#[test]
fn content_retains_initial_generator_while_session_creation_waits() {
    use typing_engine::{
        Config,
        generation::{Content, Language, Prepare},
        random::Random,
    };
    let mut content = Content::default();
    content
        .prepare(Prepare {
            config: Config {
                mode: "words".into(),
                words: 2,
                funbox: vec!["poetry".into()],
                ..Config::default()
            },
            language: Language {
                name: "english".into(),
                words: vec![Text::from("base")],
                ..Language::default()
            },
            custom: None,
            random: Random::seeded(1),
            quotes: None,
            polyglot: vec![],
            selected_quote_id: 1,
            favorite_quote_ids: vec![],
            sections: vec![],
        })
        .unwrap();
    assert!(content.start_session(false).is_err());
    let request = content
        .generator()
        .unwrap()
        .pending_request()
        .unwrap()
        .clone();
    content
        .generator()
        .unwrap()
        .supply(&request, poem("one two"))
        .unwrap();
    let session = content.start_session(false).unwrap();
    assert_eq!(
        session.snapshot().words,
        vec![Text::from("one "), Text::from("two")]
    );
}
