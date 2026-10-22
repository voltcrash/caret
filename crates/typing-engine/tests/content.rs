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
