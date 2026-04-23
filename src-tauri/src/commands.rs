use std::process::Command;
use std::path::PathBuf;

use serde::Serialize;
use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;

use crate::backend::BackendState;

#[derive(Debug, Serialize)]
pub struct DesktopRuntimeInfo {
    desktop_runtime: bool,
    backend_url: String,
    platform: String,
}

#[tauri::command]
pub fn desktop_runtime_info(state: State<'_, BackendState>) -> DesktopRuntimeInfo {
    DesktopRuntimeInfo {
        desktop_runtime: true,
        backend_url: state.backend_url.clone(),
        platform: std::env::consts::OS.to_string(),
    }
}

#[tauri::command]
pub async fn select_knowledge_base_directory(app: AppHandle) -> Result<Option<String>, String> {
    let Some(file_path) = app.dialog().file().blocking_pick_folder() else {
        return Ok(None);
    };

    let path = file_path
        .into_path()
        .map_err(|error| format!("failed to resolve selected directory path: {error}"))?;

    Ok(Some(path.to_string_lossy().into_owned()))
}

#[tauri::command]
pub async fn select_markdown_save_path(
    app: AppHandle,
    root_path: String,
    default_file_name: String,
) -> Result<Option<String>, String> {
    let mut dialog = app.dialog().file();

    let trimmed_root = root_path.trim();
    if !trimmed_root.is_empty() {
        dialog = dialog.set_directory(PathBuf::from(trimmed_root));
    }

    let trimmed_name = default_file_name.trim();
    if !trimmed_name.is_empty() {
        dialog = dialog.set_file_name(trimmed_name);
    }

    let Some(file_path) = dialog
        .add_filter("Markdown", &["md"])
        .blocking_save_file()
    else {
        return Ok(None);
    };

    let path = file_path
        .into_path()
        .map_err(|error| format!("无法解析保存路径：{error}"))?;

    Ok(Some(path.to_string_lossy().into_owned()))
}

#[tauri::command]
pub fn open_path(path: String) -> Result<(), String> {
    let target = path.trim();
    if target.is_empty() {
        return Err("path cannot be empty".to_string());
    }

    let mut command = if cfg!(target_os = "macos") {
        let mut command = Command::new("open");
        command.arg(target);
        command
    } else if cfg!(target_os = "windows") {
        let mut command = Command::new("explorer");
        command.arg(normalize_windows_shell_value(target));
        command
    } else {
        let mut command = Command::new("xdg-open");
        command.arg(target);
        command
    };

    command
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("failed to open path: {error}"))
}

#[cfg(target_os = "windows")]
fn normalize_windows_shell_value(value: &str) -> String {
    if let Some(rest) = value.strip_prefix(r"\\?\UNC\") {
        return format!(r"\\{rest}");
    }
    if let Some(rest) = value.strip_prefix(r"\\?\") {
        return rest.to_string();
    }
    value.to_string()
}

#[cfg(not(target_os = "windows"))]
fn normalize_windows_shell_value(value: &str) -> String {
    value.to_string()
}
