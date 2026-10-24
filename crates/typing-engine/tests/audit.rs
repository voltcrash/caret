use serde_json::{Value, json};
use typing_engine::audit::{Query, audit};

fn run(query: Value) -> Value {
    let query: Query = serde_json::from_value(query).unwrap();
    serde_json::to_value(audit(query).unwrap()).unwrap()
}

#[test]
fn host_wire_shapes_round_trip() {
    let gaps: Vec<f64> = (0..150).map(|i| 90.0 + f64::from(i % 17) * 3.5).collect();
    let review = run(json!({"op":"review","keySpacing":gaps,"keyDuration":gaps}));
    assert_eq!(review["op"], "review");
    assert!(review["result"]["features"]["gaps"]["autocorrelationSigmas"].is_number());
    assert_eq!(
        run(json!({"op":"review","keySpacing":[1],"keyDuration":[1]}))["result"],
        Value::Null
    );
    assert_eq!(
        run(json!({"op":"distribution","values":[]}))["result"],
        Value::Null
    );
    assert_eq!(
        run(json!({"op":"distribution","values":[2, 4]}))["result"]["distinctCount"],
        2
    );
    assert_eq!(
        run(json!({"op":"bellness","values":gaps,"useLogs":true}))["op"],
        "bellness"
    );
    assert!(
        run(json!({"op":"cross","spacing":gaps,"duration":gaps}))["result"]["overlapRate"]
            .is_number()
    );
    assert_eq!(
        run(json!({"op":"probit","values":[0.5]}))["result"],
        json!([0.0])
    );
    assert_eq!(
        run(json!({"op":"challenge",
            "result":{"wpm":10,"acc":100,"rawWpm":10,"consistency":50,"afkDuration":0,"testDuration":60,"funbox":[]},
            "config":{},"requirements":{"wpm":{"min":20}}}))["result"],
        json!(["WPM below 20"])
    );
    assert_eq!(
        run(json!({"op":"compatible","names":["nospace","nospace"]}))["result"],
        false
    );
}

#[test]
fn non_finite_samples_are_rejected() {
    let query: Query = serde_json::from_value(json!({"op":"distribution","values":[1]})).unwrap();
    assert!(audit(query).is_ok());
    // JSON cannot carry NaN; a direct host passing one must still be refused.
    let query = Query::Distribution {
        values: vec![f64::NAN],
    };
    assert!(audit(query).is_err());
}
