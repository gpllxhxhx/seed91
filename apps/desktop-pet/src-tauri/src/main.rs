#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod app_config;
mod app_logger;

use app_config::{apply_window_config, load_user_config_or_default, read_user_config_for_frontend};
use serde_json::json;
use std::path::Path;
use std::process::Command;
use tauri::{Manager, WindowEvent};

#[tauri::command]
fn read_user_config(app: tauri::AppHandle) -> Result<app_config::UserConfig, String> {
    read_user_config_for_frontend(&app)
}

#[tauri::command]
fn update_user_config(
    app: tauri::AppHandle,
    patch: app_config::UserConfigPatch,
) -> Result<app_config::UserConfig, String> {
    app_config::update_user_config_for_frontend(&app, patch)
}

#[tauri::command]
fn reset_user_config(app: tauri::AppHandle) -> Result<app_config::UserConfig, String> {
    app_config::reset_user_config_for_frontend(&app)
}

#[tauri::command]
fn append_log_entry(
    app: tauri::AppHandle,
    level: String,
    message: String,
    context: Option<serde_json::Value>,
) -> Result<(), String> {
    app_logger::append_log_entry(&app, &level, &message, context.as_ref())
}

#[tauri::command]
fn get_storage_paths(app: tauri::AppHandle) -> Result<app_logger::StoragePaths, String> {
    app_logger::resolve_storage_paths(&app)
}

fn open_directory(path: &Path) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    let mut command = {
        let mut command = Command::new("explorer");
        command.arg(path);
        command
    };

    #[cfg(target_os = "macos")]
    let mut command = {
        let mut command = Command::new("open");
        command.arg(path);
        command
    };

    #[cfg(all(unix, not(target_os = "macos")))]
    let mut command = {
        let mut command = Command::new("xdg-open");
        command.arg(path);
        command
    };

    command
        .spawn()
        .map_err(|error| format!("无法打开目录: {error}"))?;

    Ok(())
}

#[tauri::command]
fn open_log_directory(app: tauri::AppHandle) -> Result<(), String> {
    let paths = app_logger::resolve_storage_paths(&app)?;
    open_directory(Path::new(&paths.log_dir))
}

#[tauri::command]
fn open_config_directory(app: tauri::AppHandle) -> Result<(), String> {
    let paths = app_logger::resolve_storage_paths(&app)?;
    open_directory(Path::new(&paths.app_data_dir))
}

#[tauri::command]
fn apply_window_preferences(app: tauri::AppHandle, always_on_top: bool) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "主窗口不存在".to_string())?;

    window
        .set_always_on_top(always_on_top)
        .map_err(|error| format!("无法设置窗口置顶: {error}"))
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let app_handle = app.handle().clone();
            let _ = app_logger::append_log_entry(
                &app_handle,
                "info",
                "软件启动",
                Some(&json!({
                    "platform": "tauri",
                    "window": "main"
                })),
            );
            let main_window = app
                .get_webview_window("main")
                .ok_or_else(|| "主窗口初始化失败".to_string())?;
            let config = load_user_config_or_default(&app_handle);

            if let Err(error) = apply_window_config(&main_window, &config) {
                let _ = app_logger::append_log_entry(
                    &app_handle,
                    "warn",
                    "窗口初始化失败",
                    Some(&json!({
                        "detail": error
                    })),
                );
            } else {
                let _ = app_logger::append_log_entry(
                    &app_handle,
                    "info",
                    "窗口初始化成功",
                    Some(&json!({
                        "alwaysOnTop": config.window.always_on_top,
                        "x": config.window.x,
                        "y": config.window.y
                    })),
                );
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() != "main" {
                return;
            }

            match event {
                WindowEvent::Moved(position) => {
                    let _ = app_config::update_window_position(
                        &window.app_handle(),
                        position.x,
                        position.y,
                    );
                }
                WindowEvent::CloseRequested { .. } => {
                    if let Ok(position) = window.outer_position() {
                        let _ = app_config::update_window_position(
                            &window.app_handle(),
                            position.x,
                            position.y,
                        );
                    }
                    let _ = app_logger::append_log_entry(
                        &window.app_handle(),
                        "info",
                        "软件退出",
                        Some(&json!({
                            "window": "main"
                        })),
                    );
                }
                _ => {}
            }
        })
        .invoke_handler(tauri::generate_handler![
            read_user_config,
            update_user_config,
            reset_user_config,
            append_log_entry,
            get_storage_paths,
            open_log_directory,
            open_config_directory,
            apply_window_preferences
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
