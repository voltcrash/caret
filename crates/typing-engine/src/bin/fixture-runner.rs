use serde::Deserialize;
use serde_json::json;
use std::io::{self, Read};
use typing_engine::{Command, Config, Session, Text};

#[derive(Deserialize)]
struct Fixture {
    name: String,
    config: Config,
    words: Vec<Text>,
    commands: Vec<Command>,
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input)?;
    let fixture: Fixture = serde_json::from_str(&input)?;
    let mut session = Session::new(fixture.config, fixture.words)?;
    let mut frames = vec![];
    for command in fixture.commands {
        let update = session.apply(command)?;
        frames.push(json!({"state":update.state,"log":session.log()}));
    }
    println!("{}", json!({"name":fixture.name,"frames":frames}));
    Ok(())
}
