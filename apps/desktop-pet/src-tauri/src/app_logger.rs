use chrono::Local;
use serde::Serialize;
use serde_json::Value;
use std::{
    fs::{self, OpenOptions},
    io::Write,
    path::PathBuf,
};
use tauri::{AppHandle, Manager, Runtime};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StoragePaths {
    pub app_data_dir: String,
    pub config_file_path: String,
    pub log_dir: String,
    pub current_log_file_path: String,
}

pub fn resolve_storage_paths<R: Runtime>(app: &AppHandle<R>) -> Result<StoragePaths, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("无法解析 app data 目录: {error}"))?;
    let log_dir = app
        .path()
        .app_log_dir()
        .unwrap_or_else(|_| app_data_dir.join("logs"));
    let current_log_file_path =
        log_dir.join(format!("app-{}.log", Local::now().format("%Y-%m-%d")));
    let config_file_path = app_data_dir.join("user-config.json");

    Ok(StoragePaths {
        app_data_dir: app_data_dir.display().to_string(),
        config_file_path: config_file_path.display().to_string(),
        log_dir: log_dir.display().to_string(),
        current_log_file_path: current_log_file_path.display().to_string(),
    })
}

pub fn config_file_path<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    let paths = resolve_storage_paths(app)?;
    Ok(PathBuf::from(paths.config_file_path))
}

pub fn append_log_entry<R: Runtime>(
    app: &AppHandle<R>,
    level: &str,
    message: &str,
    context: Option<&Value>,
) -> Result<(), String> {
    let paths = resolve_storage_paths(app)?;
    let log_path = PathBuf::from(paths.current_log_file_path);

    if let Some(parent_dir) = log_path.parent() {
        fs::create_dir_all(parent_dir).map_err(|error| format!("无法创建日志目录: {error}"))?;
    }

    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
        .map_err(|error| format!("无法写入日志文件: {error}"))?;
    let timestamp = Local::now().format("%Y-%m-%d %H:%M:%S");
    let serialized_context = context
        .and_then(|value| {
            if value.is_null() {
                None
            } else {
                Some(value.to_string())
            }
        })
        .unwrap_or_default();
    let log_line = if serialized_context.is_empty() {
        format!("[{timestamp}] [{}] {message}\n", level.to_uppercase())
    } else {
        format!(
            "[{timestamp}] [{}] {message} {serialized_context}\n",
            level.to_uppercase()
        )
    };

    file.write_all(log_line.as_bytes())
        .map_err(|error| format!("无法写入日志内容: {error}"))
}
