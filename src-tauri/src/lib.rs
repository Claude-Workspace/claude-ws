use std::sync::Mutex;
use std::time::Duration;
use tauri::{Emitter, Manager};
use tauri_plugin_shell::process::CommandChild;
use tauri_plugin_shell::ShellExt;

/// The port the existing server.ts listens on
const SERVER_PORT: u16 = 8556;

/// State to track server sidecar process
pub struct ServerState {
    pub port: u16,
    pub ready: Mutex<bool>,
    pub child: Mutex<Option<CommandChild>>,
}

/// Wait for the Next.js server to become ready.
/// Cold start with Next.js compilation can take 60+ seconds.
async fn wait_for_server(port: u16) -> Result<(), String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(3))
        .build()
        .map_err(|e| format!("Client build error: {}", e))?;

    let url = format!("http://localhost:{}", port);
    // 300 attempts × 300ms = 90 seconds max (covers cold Next.js build)
    let max_attempts = 300;

    for i in 0..max_attempts {
        match client.get(&url).send().await {
            Ok(resp) if resp.status().is_success() || resp.status().is_redirection() => {
                log::info!(
                    "Server ready after {} attempts (~{:.1}s)",
                    i + 1,
                    (i + 1) as f64 * 0.3
                );
                return Ok(());
            }
            _ => {
                tokio::time::sleep(Duration::from_millis(300)).await;
            }
        }
    }

    Err(format!(
        "Server not ready after {}s on port {}",
        max_attempts * 300 / 1000,
        port
    ))
}

/// Get server health status
#[tauri::command]
async fn server_health() -> Result<String, String> {
    let client = reqwest::Client::new();
    let url = format!("http://localhost:{}", SERVER_PORT);

    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Health check error: {}", e))?;

    Ok(format!(
        "{{\"status\":\"ok\",\"port\":{},\"statusCode\":{}}}",
        SERVER_PORT,
        response.status().as_u16()
    ))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Spawn the existing server.ts as sidecar
            let shell = app.shell();
            let sidecar_cmd = shell.sidecar("sidecar").map_err(|e| {
                log::error!("Failed to create sidecar command: {}", e);
                e
            })?;

            let (mut rx, child) = sidecar_cmd.spawn().map_err(|e| {
                log::error!("Failed to spawn sidecar: {}", e);
                e
            })?;

            log::info!("Server sidecar spawned, waiting for port {}...", SERVER_PORT);

            // Track server state including child process for cleanup
            app.manage(ServerState {
                port: SERVER_PORT,
                ready: Mutex::new(false),
                child: Mutex::new(Some(child)),
            });

            // Log sidecar output
            let handle_log = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                use tauri_plugin_shell::process::CommandEvent;
                while let Some(event) = rx.recv().await {
                    match event {
                        CommandEvent::Stdout(line) => {
                            let text = String::from_utf8_lossy(&line);
                            log::info!("[server] {}", text.trim());
                        }
                        CommandEvent::Stderr(line) => {
                            let text = String::from_utf8_lossy(&line);
                            log::warn!("[server] {}", text.trim());
                        }
                        CommandEvent::Terminated(payload) => {
                            log::error!(
                                "[server] Process terminated with code: {:?}",
                                payload.code
                            );
                            let _ = handle_log.emit("server-crashed", payload.code);
                        }
                        _ => {}
                    }
                }
            });

            // Wait for server readiness, then navigate webview to the server
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                match wait_for_server(SERVER_PORT).await {
                    Ok(()) => {
                        log::info!("Server is ready on port {}", SERVER_PORT);
                        if let Some(state) = handle.try_state::<ServerState>() {
                            if let Ok(mut ready) = state.ready.lock() {
                                *ready = true;
                            }
                        }
                        // Navigate the main webview to the server URL
                        let url = format!("http://localhost:{}", SERVER_PORT);
                        if let Some(window) = handle.get_webview_window("main") {
                            let _ = window.navigate(url.parse().unwrap());
                            log::info!("Navigated webview to {}", url);
                        }
                        let _ = handle.emit("server-ready", SERVER_PORT);
                    }
                    Err(e) => {
                        log::error!("Server failed to start: {}", e);
                        let _ = handle.emit("server-error", e);
                    }
                }
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            // Kill sidecar on window close
            if let tauri::WindowEvent::Destroyed = event {
                let app = window.app_handle();
                if let Some(state) = app.try_state::<ServerState>() {
                    if let Ok(mut child_guard) = state.child.lock() {
                        if let Some(child) = child_guard.take() {
                            log::info!("Shutting down server sidecar...");
                            let _ = child.kill();
                        }
                    }
                }
            }
        })
        .invoke_handler(tauri::generate_handler![server_health])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            // Kill sidecar when app exits
            if let tauri::RunEvent::Exit = event {
                if let Some(state) = app.try_state::<ServerState>() {
                    if let Ok(mut child_guard) = state.child.lock() {
                        if let Some(child) = child_guard.take() {
                            log::info!("App exiting, shutting down server sidecar...");
                            let _ = child.kill();
                        }
                    }
                }
            }
        });
}
