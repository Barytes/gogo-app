mod backend;
mod commands;

use std::env;
use std::error::Error;
use std::fs;
use std::io;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::panic;

use serde_json::{Map, Value};
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

const COMPANION_KNOWLEDGE_BASE_DIRNAME: &str = "gogo-knowledge-base";
const STARTUP_ONBOARDING_PENDING_KEY: &str = "startup_onboarding_pending";
const STARTUP_LOG_PATH: &str = "/tmp/gogo-app-desktop-startup.log";

fn append_startup_log(message: impl AsRef<str>) {
    let line = format!("{}\n", message.as_ref());
    if let Ok(mut file) = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(STARTUP_LOG_PATH)
    {
        let _ = file.write_all(line.as_bytes());
    }
}

fn is_knowledge_base_dir(path: &Path) -> bool {
    path.join("wiki").is_dir() && path.join("raw").is_dir()
}

fn is_empty_directory(path: &Path) -> bool {
    fs::read_dir(path)
        .ok()
        .map(|mut entries| entries.next().is_none())
        .unwrap_or(false)
}

fn load_configured_knowledge_base_dir(app_state_dir: &Path) -> Option<PathBuf> {
    let settings_path = app_state_dir.join("app-settings.json");
    let raw = fs::read_to_string(settings_path).ok()?;
    let parsed = serde_json::from_str::<Value>(&raw).ok()?;
    let candidate = parsed
        .get("knowledge_base_dir")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())?;
    Some(PathBuf::from(candidate))
}

fn load_settings_map(app_state_dir: &Path) -> Map<String, Value> {
    let settings_path = app_state_dir.join("app-settings.json");
    match fs::read_to_string(&settings_path)
        .ok()
        .and_then(|raw| serde_json::from_str::<Value>(&raw).ok())
    {
        Some(Value::Object(map)) => map,
        _ => Map::new(),
    }
}

fn write_settings_map(app_state_dir: &Path, root: Map<String, Value>) -> io::Result<()> {
    let settings_path = app_state_dir.join("app-settings.json");
    fs::create_dir_all(app_state_dir)?;
    let encoded = serde_json::to_string_pretty(&Value::Object(root))
        .map_err(|error| io::Error::other(error.to_string()))?;
    fs::write(settings_path, encoded)
}

fn persist_configured_knowledge_base_dir(
    app_state_dir: &Path,
    knowledge_base_dir: &Path,
) -> io::Result<()> {
    let mut root = load_settings_map(app_state_dir);

    let knowledge_base_dir_string = knowledge_base_dir.to_string_lossy().into_owned();
    root.insert(
        "knowledge_base_dir".to_string(),
        Value::String(knowledge_base_dir_string.clone()),
    );

    let mut recent_paths = vec![Value::String(knowledge_base_dir_string)];
    if let Some(existing) = root.get("recent_knowledge_bases").and_then(Value::as_array) {
        for item in existing {
            let Some(path) = item
                .as_str()
                .map(str::trim)
                .filter(|value| !value.is_empty())
            else {
                continue;
            };
            if recent_paths.iter().any(|value| {
                value
                    .as_str()
                    .is_some_and(|existing_path| existing_path == path)
            }) {
                continue;
            }
            recent_paths.push(Value::String(path.to_string()));
            if recent_paths.len() >= 8 {
                break;
            }
        }
    }
    root.insert(
        "recent_knowledge_bases".to_string(),
        Value::Array(recent_paths),
    );
    write_settings_map(app_state_dir, root)
}

fn persist_startup_onboarding_pending(app_state_dir: &Path, pending: bool) -> io::Result<()> {
    let mut root = load_settings_map(app_state_dir);
    root.insert(
        STARTUP_ONBOARDING_PENDING_KEY.to_string(),
        Value::Bool(pending),
    );
    write_settings_map(app_state_dir, root)
}

fn normalize_companion_knowledge_base_dir(selected_dir: PathBuf) -> PathBuf {
    if is_knowledge_base_dir(&selected_dir) || is_empty_directory(&selected_dir) {
        selected_dir
    } else {
        selected_dir.join(COMPANION_KNOWLEDGE_BASE_DIRNAME)
    }
}

fn resolve_initial_knowledge_base_dir(
    app_state_dir: &Path,
    fallback_dir: &Path,
) -> Result<PathBuf, Box<dyn Error>> {
    if let Some(existing_path) = load_configured_knowledge_base_dir(app_state_dir) {
        return Ok(existing_path);
    }

    let selected_dir = normalize_companion_knowledge_base_dir(fallback_dir.to_path_buf());

    persist_configured_knowledge_base_dir(app_state_dir, &selected_dir)
        .map_err(|error| -> Box<dyn Error> { Box::new(error) })?;
    persist_startup_onboarding_pending(app_state_dir, true)
        .map_err(|error| -> Box<dyn Error> { Box::new(error) })?;

    Ok(selected_dir)
}

fn main() {
    let _ = fs::write(STARTUP_LOG_PATH, "");
    append_startup_log("main: entered");
    panic::set_hook(Box::new(|panic_info| {
        append_startup_log(format!("panic: {panic_info}"));
    }));

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::desktop_runtime_info,
            commands::select_knowledge_base_directory,
            commands::select_markdown_save_path,
            commands::open_path
        ])
        .setup(|app| -> Result<(), Box<dyn Error>> {
            append_startup_log("setup: entered");
            let backend_state = if tauri::is_dev() {
                append_startup_log("setup: dev runtime path");
                let backend_url = env::var("GOGO_DESKTOP_BACKEND_URL")
                    .ok()
                    .filter(|value| !value.trim().is_empty())
                    .unwrap_or_else(|| "http://127.0.0.1:8000".to_string());
                append_startup_log(format!("setup: using dev backend url {backend_url}"));
                backend::BackendState::dev(backend_url)
            } else {
                append_startup_log("setup: bundled runtime path");
                let resource_dir = app
                    .path()
                    .resource_dir()
                    .map_err(|error| io::Error::other(error.to_string()))?;
                append_startup_log(format!(
                    "setup: resource_dir={}",
                    resource_dir.to_string_lossy()
                ));
                let app_state_dir = app
                    .path()
                    .app_data_dir()
                    .map_err(|error| io::Error::other(error.to_string()))?;
                append_startup_log(format!(
                    "setup: app_state_dir={}",
                    app_state_dir.to_string_lossy()
                ));
                let companion_template_dir = resource_dir.join("knowledge-base");
                let fallback_knowledge_base_dir = app_state_dir.join("knowledge-base");
                append_startup_log(format!(
                    "setup: companion_template_dir={}",
                    companion_template_dir.to_string_lossy()
                ));
                append_startup_log(format!(
                    "setup: fallback_knowledge_base_dir={}",
                    fallback_knowledge_base_dir.to_string_lossy()
                ));
                let default_knowledge_base_dir = resolve_initial_knowledge_base_dir(
                    &app_state_dir,
                    &fallback_knowledge_base_dir,
                )
                .map_err(|error| io::Error::other(error.to_string()))?;
                append_startup_log(format!(
                    "setup: default_knowledge_base_dir={}",
                    default_knowledge_base_dir.to_string_lossy()
                ));
                let runtime = backend::launch_backend(
                    resource_dir,
                    app_state_dir,
                    companion_template_dir,
                    default_knowledge_base_dir,
                )
                .map_err(|error| io::Error::other(error.to_string()))?;
                append_startup_log("setup: backend launched");
                backend::BackendState::managed(runtime)
            };
            let backend_url = backend_state.backend_url.clone();
            append_startup_log(format!("setup: backend_url={backend_url}"));
            app.manage(backend_state);
            append_startup_log("setup: backend state managed");

            let url = WebviewUrl::External(
                backend_url
                    .parse()
                    .map_err(|error| -> Box<dyn Error> { Box::new(error) })?,
            );
            append_startup_log("setup: webview url parsed");

            WebviewWindowBuilder::new(app, "main", url)
                .title("gogo-app")
                .inner_size(1480.0, 980.0)
                .min_inner_size(1120.0, 760.0)
                .build()
                .map(|_| ())
                .map_err(|error| -> Box<dyn Error> { Box::new(error) })?;
            append_startup_log("setup: main window built");

            Ok(())
        })
        .run(tauri::generate_context!())
        .unwrap_or_else(|error| {
            append_startup_log(format!("run: error={error}"));
            panic!("failed to run gogo-app tauri shell: {error}");
        });
}
