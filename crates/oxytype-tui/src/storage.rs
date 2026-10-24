//! Offline durable storage. SQLite transactions arbitrate concurrent instances.
use crate::{Result, engine::EngineHost, input::Capabilities};
use directories::ProjectDirs;
use rusqlite::{Connection, OptionalExtension, TransactionBehavior, params};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::{
    fs,
    io::Write,
    path::{Path, PathBuf},
    time::Duration,
};
use typing_engine::{
    Config,
    results::{Limit, Validity, ValidityResult},
};

#[derive(Clone, Debug)]
pub struct Paths {
    pub config: PathBuf,
    pub data: PathBuf,
}
impl Paths {
    pub fn resolve(config: Option<&Path>, data: Option<&Path>) -> Result<Self> {
        let dirs = ProjectDirs::from("com", "Oxytype", "Oxytype");
        Ok(Self {
            config: config
                .map(Path::to_path_buf)
                .or_else(|| dirs.as_ref().map(|d| d.config_dir().into()))
                .ok_or("No config directory; use --config-dir")?,
            data: data
                .map(Path::to_path_buf)
                .or_else(|| dirs.as_ref().map(|d| d.data_local_dir().into()))
                .ok_or("No data directory; use --data-dir")?,
        })
    }
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub format_version: u32,
    pub config: Config,
    pub theme: String,
    pub reduced_animation: bool,
    pub record_replay: bool,
}
impl Default for Settings {
    fn default() -> Self {
        Self {
            format_version: 1,
            config: Config::default(),
            theme: "terminal".into(),
            reduced_animation: true,
            record_replay: false,
        }
    }
}
impl Settings {
    pub fn validate(&self) -> Result<()> {
        if self.format_version != 1 {
            return Err("Unsupported settings version; existing file preserved".into());
        }
        self.config.validate()?;
        if !["terminal", "high-contrast", "light"].contains(&self.theme.as_str()) {
            return Err("Unknown terminal theme".into());
        }
        Ok(())
    }
}
pub struct Store {
    config: Connection,
    history: Connection,
    pub revision: i64,
}
fn open(path: &Path, schema: &str) -> Result<Connection> {
    let dir = path.parent().ok_or("Missing storage directory")?;
    if !dir.exists() {
        fs::create_dir_all(dir)?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(dir, fs::Permissions::from_mode(0o700))?;
        }
    }
    let mut options = fs::OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    match options.open(path) {
        Ok(_) => {}
        Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => {}
        Err(e) => return Err(e.into()),
    }
    let mut db = Connection::open(path)?;
    db.busy_timeout(Duration::from_secs(2))?;
    let version: i64 = db.pragma_query_value(None, "user_version", |r| r.get(0))?;
    if version > 1 {
        return Err(format!(
            "Unsupported database version {version}; file preserved at {}",
            path.display()
        )
        .into());
    }
    db.pragma_update(None, "journal_mode", "WAL")?;
    db.pragma_update(None, "synchronous", "FULL")?;
    let transaction = db.transaction_with_behavior(TransactionBehavior::Immediate)?;
    transaction.execute_batch(schema)?;
    transaction.pragma_update(None, "user_version", 1)?;
    transaction.commit()?;
    Ok(db)
}
impl Store {
    pub fn open(paths: &Paths) -> Result<Self> {
        Ok(Self {
            config: open(
                &paths.config.join("settings.sqlite3"),
                "CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, json TEXT NOT NULL);",
            )?,
            history: open(
                &paths.data.join("history.sqlite3"),
                "CREATE TABLE IF NOT EXISTS results (id TEXT PRIMARY KEY NOT NULL, created_ms REAL NOT NULL, mode TEXT NOT NULL, json TEXT NOT NULL); CREATE INDEX IF NOT EXISTS results_mode_time ON results(mode,created_ms);",
            )?,
            revision: 0,
        })
    }
    pub fn settings(&mut self) -> Result<Settings> {
        let row: Option<(i64, String)> = self
            .config
            .query_row("SELECT revision,json FROM settings WHERE id=1", [], |r| {
                Ok((r.get(0)?, r.get(1)?))
            })
            .optional()?;
        let settings = match row {
            Some((revision, json)) => {
                self.revision = revision;
                serde_json::from_str(&json)?
            }
            None => Settings::default(),
        };
        settings.validate()?;
        Ok(settings)
    }
    pub fn save_settings(&mut self, settings: &Settings) -> Result<()> {
        settings.validate()?;
        let transaction = self
            .config
            .transaction_with_behavior(TransactionBehavior::Immediate)?;
        let current: i64 = transaction
            .query_row("SELECT revision FROM settings WHERE id=1", [], |r| r.get(0))
            .optional()?
            .unwrap_or(0);
        if current != self.revision {
            return Err("Settings changed in another instance; reload before saving (existing data preserved)".into());
        }
        let revision = current + 1;
        transaction.execute("INSERT INTO settings(id,revision,json) VALUES(1,?1,?2) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,json=excluded.json",params![revision,serde_json::to_string(settings)?])?;
        transaction.commit()?;
        self.revision = revision;
        Ok(())
    }
    pub fn save(&mut self, record: &Value) -> Result<()> {
        let id = record["id"].as_str().ok_or("Result missing ID")?;
        let json = serde_json::to_string(record)?;
        let transaction = self
            .history
            .transaction_with_behavior(TransactionBehavior::Immediate)?;
        let existing: Option<String> = transaction
            .query_row("SELECT json FROM results WHERE id=?1", [id], |r| r.get(0))
            .optional()?;
        if let Some(existing) = existing {
            if existing != json {
                return Err("Result ID collision; existing result preserved".into());
            }
        } else {
            transaction.execute(
                "INSERT INTO results(id,created_ms,mode,json) VALUES(?1,?2,?3,?4)",
                params![
                    id,
                    record["createdMs"]
                        .as_f64()
                        .ok_or("Missing result timestamp")?,
                    record["config"]["mode"]
                        .as_str()
                        .ok_or("Missing result mode")?,
                    json
                ],
            )?;
        }
        transaction.commit()?;
        Ok(())
    }
    pub fn history(&self, mode: Option<&str>, limit: usize) -> Result<Vec<Value>> {
        let mut query=self.history.prepare("SELECT json FROM results WHERE (?1 IS NULL OR mode=?1) ORDER BY created_ms DESC,id DESC LIMIT ?2")?;
        let rows = query.query_map(params![mode, limit.min(100_000) as i64], |r| {
            r.get::<_, String>(0)
        })?;
        rows.map(|row| Ok(serde_json::from_str(&row?)?)).collect()
    }
    pub fn best(&self, group: &str) -> Result<Option<f64>> {
        Ok(self.history.query_row("SELECT MAX(json_extract(json,'$.summary.wpm')) FROM results WHERE json_extract(json,'$.formatVersion')=1 AND json_extract(json,'$.personalBestEligible')=1 AND json_extract(json,'$.personalBestGroup')=?1", [group], |r|r.get(0))?)
    }
    /// Export the stored bytes/fields semantically; never recompute old scores.
    pub fn export(&self, path: &Path, mode: Option<&str>) -> Result<()> {
        let mut query = self.history.prepare(
            "SELECT json FROM results WHERE (?1 IS NULL OR mode=?1) ORDER BY created_ms,id",
        )?;
        let rows = query.query_map([mode], |r| r.get::<_, String>(0))?;
        let parent = path
            .parent()
            .filter(|p| !p.as_os_str().is_empty())
            .unwrap_or(Path::new("."));
        let mut temporary = tempfile::NamedTempFile::new_in(parent)?;
        temporary.write_all(b"{\"formatVersion\":1,\"results\":[")?;
        for (i, row) in rows.enumerate() {
            let raw = row?;
            let _: Value = serde_json::from_str(&raw)?;
            if i > 0 {
                temporary.write_all(b",")?;
            }
            temporary.write_all(raw.as_bytes())?;
        }
        temporary.write_all(b"]}\n")?;
        temporary.as_file().sync_all()?;
        temporary.persist_noclobber(path).map_err(|e| e.error)?;
        #[cfg(unix)]
        {
            fs::File::open(parent)?.sync_all()?;
        }
        Ok(())
    }
}
pub fn hash(value: &impl Serialize) -> Result<String> {
    Ok(format!("{:x}", Sha256::digest(serde_json::to_vec(value)?)))
}
pub fn record(
    host: &EngineHost,
    capabilities: &Capabilities,
    replay: bool,
    created: f64,
) -> Result<Value> {
    if !host.state().ended {
        return Err("Cannot save unfinished result".into());
    }
    let log = host.log()?;
    let quote = host.session().snapshot().current_quote;
    let mode2 = log.context.mode2.clone();
    let limit = host.custom_limit();
    let invalid = host
        .result
        .as_ref()
        .map(|summary| {
            typing_engine::results::invalid_reason(
                &log,
                &Validity {
                    result: ValidityResult {
                        mode: host.config.mode.clone(),
                        mode2: mode2.clone(),
                        test_duration: summary.test_duration,
                        wpm: summary.wpm,
                        raw_wpm: summary.raw_wpm,
                        acc: summary.acc,
                    },
                    bailed_out: log.context.bailed_out,
                    failed: host.state().reason.is_some(),
                    repeated: host.repeated,
                    lb_opt_out: false,
                    custom_limit: limit.clone().unwrap_or(Limit {
                        mode: "word".into(),
                        value: 0.0,
                    }),
                },
            )
            .map(str::to_string)
        })
        .unwrap_or_else(|| Some("unavailable metrics".into()));
    let mut summary = serde_json::to_value(&host.result)?;
    if let Value::Object(values) = &mut summary {
        for field in [
            "keySpacing",
            "keyDuration",
            "keyOverlap",
            "keyConsistency",
            "startToFirstKey",
            "lastKeyToEnd",
        ] {
            values.insert(field.into(), Value::Null);
        }
    }
    let pb_eligible = invalid.is_none()
        && host
            .config
            .funbox
            .iter()
            .all(|n| typing_engine::funboxes::get(n).is_some_and(|f| f.can_get_pb));
    Ok(
        json!({ "formatVersion":1,"id":uuid::Uuid::new_v4().to_string(),"createdMs":created,"engineBehaviorVersion":typing_engine::BEHAVIOR_VERSION,"eventLogVersion":typing_engine::EVENT_LOG_VERSION,"buildVersion":crate::version(),"config":host.config,"mode2":mode2,"seed":host.seed,"contentIdentity":host.content_identity,"quoteId":quote.map(|q|q.id),"customLimit":limit,"capabilities":capabilities,"measurements":{"clock":"monotonic terminal event delivery","physicalKeyTiming":null},"summary":summary,"summaryError":host.result_error,"invalidReason":invalid,"personalBestEligible":pb_eligible,"personalBestGroup":hash(&(&host.config,&host.content_identity,&mode2))?,"repeated":host.repeated,"bailedOut":log.context.bailed_out,"failureReason":host.state().reason,"replayLog":if replay { Some(log) } else { None } }),
    )
}
pub fn is_personal_best(record: &Value, history: &[Value]) -> bool {
    record["personalBestEligible"] == true
        && record["summary"]["wpm"].as_f64().is_some_and(|wpm| {
            history
                .iter()
                .filter(|r| {
                    r["personalBestEligible"] == true
                        && r["personalBestGroup"] == record["personalBestGroup"]
                        && r["id"] != record["id"]
                })
                .filter_map(|r| r["summary"]["wpm"].as_f64())
                .all(|prior| wpm > prior)
        })
}
