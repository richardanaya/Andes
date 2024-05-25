// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
#[tauri::command]
fn greet(name: &str) -> String {
    format!(
        "<strong>Hello, {}! You've been greeted from Rust!</strong>",
        name
    )
}

#[tauri::command]
fn show_main_window(window: tauri::Window) {
    window.get_window("main").unwrap().show().unwrap(); // replace "main" by the name of your window
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![greet, show_main_window])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
