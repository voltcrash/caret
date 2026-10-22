use ts_rs::TS;
use typing_engine::{
    Command, Config,
    session::{State, Update},
};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../packages/typing-engine/generated/types");
    let config = ts_rs::Config::new().with_out_dir(root.clone());
    std::fs::create_dir_all(root.parent().unwrap())?;
    std::fs::write(
        root.parent().unwrap().join("defaults.json"),
        serde_json::to_vec_pretty(&typing_engine::Config::default())?,
    )?;
    std::fs::write(
        root.parent().unwrap().join("funboxes.json"),
        serde_json::to_vec_pretty(typing_engine::funboxes::all())?,
    )?;
    Command::export_all(&config)?;
    Config::export_all(&config)?;
    State::export_all(&config)?;
    typing_engine::session::Snapshot::export_all(&config)?;
    Update::export_all(&config)?;
    typing_engine::stats::Log::export_all(&config)?;
    typing_engine::analysis::Query::export_all(&config)?;
    typing_engine::analysis::Response::export_all(&config)?;
    typing_engine::replay::Word::export_all(&config)?;
    typing_engine::replay::Seek::export_all(&config)?;
    typing_engine::generation::Prepare::export_all(&config)?;
    typing_engine::generation::Generated::export_all(&config)?;
    typing_engine::generation::NextWord::export_all(&config)?;
    typing_engine::quotes::Quote::export_all(&config)?;
    Ok(())
}
