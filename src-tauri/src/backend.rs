use std::env;
use std::io::{Read, Write};
use std::net::{SocketAddr, TcpListener, TcpStream};
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, Instant};

use anyhow::{anyhow, Context, Result};
use serde::Serialize;

const BACKEND_HOST: &str = "127.0.0.1";
const HEALTH_PATH: &str = "/api/health";
const HEALTH_TIMEOUT: Duration = Duration::from_secs(30);
const HEALTH_POLL_INTERVAL: Duration = Duration::from_millis(100);
const BRIDGE_POLL_INTERVAL: Duration = Duration::from_millis(150);

#[derive(Debug)]
struct Launcher {
    label: String,
    program: String,
    args: Vec<String>,
}

pub struct BackendRuntime {
    pub backend_url: String,
    child: Mutex<Option<Child>>,
    bridge: Option<DesktopBridgeRuntime>,
}

pub struct BackendState {
    pub backend_url: String,
    runtime: Option<BackendRuntime>,
}

impl BackendState {
    pub fn dev(backend_url: String) -> Self {
        Self {
            backend_url,
            runtime: None,
        }
    }

    pub fn managed(runtime: BackendRuntime) -> Self {
        let backend_url = runtime.backend_url.clone();
        Self {
            backend_url,
            runtime: Some(runtime),
        }
    }
}

impl Drop for BackendState {
    fn drop(&mut self) {
        if let Some(runtime) = self.runtime.as_ref() {
            runtime.stop();
        }
    }
}

impl BackendRuntime {
    fn new(backend_url: String, child: Child, bridge: DesktopBridgeRuntime) -> Self {
        Self {
            backend_url,
            child: Mutex::new(Some(child)),
            bridge: Some(bridge),
        }
    }

    pub fn stop(&self) {
        let Ok(mut guard) = self.child.lock() else {
            return;
        };
        if let Some(child) = guard.as_mut() {
            let _ = child.kill();
            let _ = child.wait();
        }
        *guard = None;
        if let Some(bridge) = self.bridge.as_ref() {
            bridge.stop();
        }
    }
}

impl Drop for BackendRuntime {
    fn drop(&mut self) {
        self.stop();
    }
}

pub fn launch_backend() -> Result<BackendRuntime> {
    let app_root = resolve_app_root()?;
    let port = pick_available_port()?;
    let backend_url = format!("http://{BACKEND_HOST}:{port}");
    let bridge = start_desktop_bridge(&app_root)?;
    let launchers = build_launchers(&app_root, port);
    let mut last_error: Option<anyhow::Error> = None;

    for launcher in launchers {
        match spawn_backend(&app_root, &backend_url, &bridge.bridge_url, &launcher) {
            Ok(mut child) => match wait_for_backend_ready(&mut child, port) {
                Ok(()) => return Ok(BackendRuntime::new(backend_url.clone(), child, bridge)),
                Err(error) => {
                    let _ = child.kill();
                    let _ = child.wait();
                    last_error = Some(anyhow!(
                        "launcher `{}` started but backend did not become ready: {error}",
                        launcher.label
                    ));
                }
            },
            Err(error) => {
                last_error = Some(anyhow!(
                    "launcher `{}` failed to start: {error}",
                    launcher.label
                ));
            }
        }
    }

    bridge.stop();
    Err(last_error.unwrap_or_else(|| anyhow!("no backend launcher succeeded")))
}

fn resolve_app_root() -> Result<PathBuf> {
    if let Ok(raw) = env::var("GOGO_APP_ROOT") {
        let candidate = PathBuf::from(raw);
        if is_app_root(&candidate) {
            return Ok(candidate);
        }
    }

    let current_dir = env::current_dir().context("failed to read current dir")?;
    if is_app_root(&current_dir) {
        return Ok(current_dir);
    }

    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let candidate = manifest_dir
        .parent()
        .map(Path::to_path_buf)
        .ok_or_else(|| anyhow!("failed to resolve app root from CARGO_MANIFEST_DIR"))?;
    if is_app_root(&candidate) {
        return Ok(candidate);
    }

    Err(anyhow!(
        "could not resolve gogo-app root; set GOGO_APP_ROOT explicitly"
    ))
}

fn is_app_root(path: &Path) -> bool {
    path.join("app/backend/main.py").exists() && path.join("app/frontend/index.html").exists()
}

fn pick_available_port() -> Result<u16> {
    let listener = TcpListener::bind((BACKEND_HOST, 0)).context("failed to bind a free port")?;
    let port = listener.local_addr().context("failed to read local addr")?.port();
    drop(listener);
    Ok(port)
}

fn build_launchers(app_root: &Path, port: u16) -> Vec<Launcher> {
    let mut launchers = Vec::new();

    if let Ok(raw_python) = env::var("GOGO_DESKTOP_PYTHON") {
        let candidate = raw_python.trim();
        if !candidate.is_empty() {
            launchers.push(python_launcher(
                "env:GOGO_DESKTOP_PYTHON",
                candidate,
                port,
            ));
        }
    }

    let venv_python_unix = app_root.join(".venv/bin/python");
    if venv_python_unix.exists() {
        launchers.push(python_launcher(
            ".venv/bin/python",
            &venv_python_unix.to_string_lossy(),
            port,
        ));
    }

    let venv_python_windows = app_root.join(".venv/Scripts/python.exe");
    if venv_python_windows.exists() {
        launchers.push(python_launcher(
            ".venv/Scripts/python.exe",
            &venv_python_windows.to_string_lossy(),
            port,
        ));
    }

    launchers.push(Launcher {
        label: "uv run uvicorn".to_string(),
        program: "uv".to_string(),
        args: vec![
            "run".to_string(),
            "uvicorn".to_string(),
            "app.backend.main:app".to_string(),
            "--host".to_string(),
            BACKEND_HOST.to_string(),
            "--port".to_string(),
            port.to_string(),
        ],
    });

    launchers.push(python_launcher("python3", "python3", port));
    launchers.push(python_launcher("python", "python", port));

    launchers
}

fn python_launcher(label: &str, program: &str, port: u16) -> Launcher {
    Launcher {
        label: label.to_string(),
        program: program.to_string(),
        args: vec![
            "-m".to_string(),
            "uvicorn".to_string(),
            "app.backend.main:app".to_string(),
            "--host".to_string(),
            BACKEND_HOST.to_string(),
            "--port".to_string(),
            port.to_string(),
        ],
    }
}

fn spawn_backend(
    app_root: &Path,
    backend_url: &str,
    bridge_url: &str,
    launcher: &Launcher,
) -> Result<Child> {
    let mut command = Command::new(&launcher.program);
    command
        .args(&launcher.args)
        .current_dir(app_root)
        .stdin(Stdio::null())
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .env("GOGO_RUNTIME", "desktop")
        .env("GOGO_DESKTOP_BACKEND_URL", backend_url)
        .env("GOGO_DESKTOP_BRIDGE_URL", bridge_url)
        .env("PYTHONUNBUFFERED", "1");

    command
        .spawn()
        .with_context(|| format!("failed to spawn `{}`", launcher.program))
}

fn wait_for_backend_ready(child: &mut Child, port: u16) -> Result<()> {
    let deadline = Instant::now() + HEALTH_TIMEOUT;

    while Instant::now() < deadline {
        if let Some(status) = child.try_wait().context("failed to poll backend child")? {
            return Err(anyhow!("backend exited early with status {status}"));
        }

        if healthcheck_ok(port) {
            return Ok(());
        }

        thread::sleep(HEALTH_POLL_INTERVAL);
    }

    Err(anyhow!(
        "timed out waiting for backend healthcheck on {BACKEND_HOST}:{port}"
    ))
}

fn healthcheck_ok(port: u16) -> bool {
    let socket_addr = SocketAddr::from(([127, 0, 0, 1], port));
    let Ok(mut stream) = TcpStream::connect_timeout(&socket_addr, Duration::from_millis(500)) else {
        return false;
    };

    let _ = stream.set_read_timeout(Some(Duration::from_millis(500)));
    let _ = stream.set_write_timeout(Some(Duration::from_millis(500)));

    let request = format!(
        "GET {HEALTH_PATH} HTTP/1.1\r\nHost: {BACKEND_HOST}:{port}\r\nConnection: close\r\n\r\n"
    );

    if stream.write_all(request.as_bytes()).is_err() {
        return false;
    }

    let mut response = String::new();
    if stream.read_to_string(&mut response).is_err() {
        return false;
    }

    response.starts_with("HTTP/1.1 200") || response.starts_with("HTTP/1.0 200")
}

#[derive(Debug)]
struct DesktopBridgeRuntime {
    bridge_url: String,
    shutdown: Arc<AtomicBool>,
    thread: Mutex<Option<thread::JoinHandle<()>>>,
}

impl DesktopBridgeRuntime {
    fn stop(&self) {
        self.shutdown.store(true, Ordering::Relaxed);
        let Ok(mut guard) = self.thread.lock() else {
            return;
        };
        if let Some(handle) = guard.take() {
            let _ = handle.join();
        }
    }
}

#[derive(Debug, Serialize)]
struct DesktopLoginResponse {
    success: bool,
    detail: String,
    command_hint: String,
}

fn start_desktop_bridge(app_root: &Path) -> Result<DesktopBridgeRuntime> {
    let listener = TcpListener::bind((BACKEND_HOST, 0)).context("failed to bind desktop bridge")?;
    listener
        .set_nonblocking(true)
        .context("failed to configure desktop bridge listener")?;
    let port = listener
        .local_addr()
        .context("failed to read desktop bridge addr")?
        .port();
    let shutdown = Arc::new(AtomicBool::new(false));
    let thread_shutdown = shutdown.clone();
    let thread_app_root = app_root.to_path_buf();
    let handle = thread::spawn(move || {
        while !thread_shutdown.load(Ordering::Relaxed) {
            match listener.accept() {
                Ok((stream, _)) => {
                    let _ = handle_desktop_bridge_client(stream, &thread_app_root);
                }
                Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                    thread::sleep(BRIDGE_POLL_INTERVAL);
                }
                Err(_) => {
                    thread::sleep(BRIDGE_POLL_INTERVAL);
                }
            }
        }
    });

    Ok(DesktopBridgeRuntime {
        bridge_url: format!("http://{BACKEND_HOST}:{port}"),
        shutdown,
        thread: Mutex::new(Some(handle)),
    })
}

fn handle_desktop_bridge_client(mut stream: TcpStream, app_root: &Path) -> Result<()> {
    let mut request_bytes = Vec::new();
    let mut buffer = [0_u8; 4096];
    let header_end;
    loop {
        let read = stream.read(&mut buffer).context("failed to read bridge request")?;
        if read == 0 {
            return Ok(());
        }
        request_bytes.extend_from_slice(&buffer[..read]);
        if let Some(position) = request_bytes
            .windows(4)
            .position(|window| window == b"\r\n\r\n")
        {
            header_end = position + 4;
            break;
        }
        if request_bytes.len() > 1024 * 1024 {
            write_json_response(
                &mut stream,
                413,
                &serde_json::json!({ "detail": "desktop bridge request too large" }),
            )?;
            return Ok(());
        }
    }

    let header_text = String::from_utf8_lossy(&request_bytes[..header_end]).into_owned();
    let mut lines = header_text.lines();
    let request_line = lines.next().unwrap_or_default();
    let mut request_parts = request_line.split_whitespace();
    let method = request_parts.next().unwrap_or_default();
    let path = request_parts.next().unwrap_or_default();

    let mut content_length = 0usize;
    for line in lines {
        let Some((name, value)) = line.split_once(':') else {
            continue;
        };
        if name.trim().eq_ignore_ascii_case("content-length") {
            content_length = value.trim().parse::<usize>().unwrap_or(0);
        }
    }

    let body_start = header_end;
    while request_bytes.len().saturating_sub(body_start) < content_length {
        let read = stream.read(&mut buffer).context("failed to read bridge request body")?;
        if read == 0 {
            break;
        }
        request_bytes.extend_from_slice(&buffer[..read]);
    }
    let body_end = body_start.saturating_add(content_length).min(request_bytes.len());
    let body = &request_bytes[body_start..body_end];

    if method != "POST" || path != "/desktop-login" {
        write_json_response(
            &mut stream,
            404,
            &serde_json::json!({ "detail": "desktop bridge endpoint not found" }),
        )?;
        return Ok(());
    }

    if !body.is_empty() {
        let parsed = serde_json::from_slice::<serde_json::Value>(body);
        if let Err(error) = parsed {
            write_json_response(
                &mut stream,
                400,
                &serde_json::json!({ "detail": format!("invalid desktop bridge payload: {error}") }),
            )?;
            return Ok(());
        }
    }

    match launch_desktop_pi_login(app_root) {
        Ok(response) => {
            write_json_response(&mut stream, 200, &response)?;
        }
        Err(error) => {
            write_json_response(
                &mut stream,
                500,
                &serde_json::json!({ "detail": error.to_string() }),
            )?;
        }
    }
    Ok(())
}

fn write_json_response(stream: &mut TcpStream, status_code: u16, payload: &impl Serialize) -> Result<()> {
    let body = serde_json::to_vec(payload).context("failed to encode desktop bridge response")?;
    let status_text = match status_code {
        200 => "OK",
        400 => "Bad Request",
        404 => "Not Found",
        413 => "Payload Too Large",
        500 => "Internal Server Error",
        _ => "OK",
    };
    let header = format!(
        "HTTP/1.1 {status_code} {status_text}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
        body.len()
    );
    stream
        .write_all(header.as_bytes())
        .context("failed to write desktop bridge header")?;
    stream
        .write_all(&body)
        .context("failed to write desktop bridge body")?;
    Ok(())
}

fn launch_desktop_pi_login(app_root: &Path) -> Result<DesktopLoginResponse> {
    #[cfg(target_os = "macos")]
    {
        let shell_command = build_pi_terminal_shell_command(app_root);
        launch_macos_terminal(shell_command)?;
        return Ok(DesktopLoginResponse {
            success: true,
            detail:
                "已打开 Pi 终端。请在终端里手动输入 `/login`，完成登录后 gogo-app 会自动刷新 Provider 状态。"
                    .to_string(),
            command_hint: "/login".to_string(),
        });
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = app_root;
        Err(anyhow!("当前桌面版 Pi 登录桥暂时只实现了 macOS 终端拉起流程。"))
    }
}

fn build_pi_terminal_shell_command(app_root: &Path) -> String {
    let mut parts = vec![
        format!("cd {}", shell_quote(app_root.to_string_lossy().as_ref())),
        build_pi_command(app_root),
    ];
    parts.push("printf '\\nPi 已启动。若未自动触发登录，请输入上方提示中的 /login 命令。\\n'".to_string());
    parts.push("exec $SHELL -l".to_string());
    parts.join(" ; ")
}

fn build_pi_command(app_root: &Path) -> String {
    let pi_program = env::var("PI_COMMAND")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "pi".to_string());
    let mut args = vec![shell_quote(&pi_program)];
    let managed_extension = app_root
        .parent()
        .map(|parent| parent.join(".gogo/pi-extensions/managed-providers.ts"));
    if let Some(path) = managed_extension.filter(|path| path.exists()) {
        args.push("--extension".to_string());
        args.push(shell_quote(path.to_string_lossy().as_ref()));
    }
    args.join(" ")
}

#[cfg(target_os = "macos")]
fn launch_macos_terminal(shell_command: String) -> Result<()> {
    let script = vec![
        r#"tell application "Terminal" to activate"#.to_string(),
        format!(r#"tell application "Terminal" to do script "{}""#, applescript_escape(&shell_command)),
    ];
    run_osascript(&script)
}

#[cfg(target_os = "macos")]
fn run_osascript(lines: &[String]) -> Result<()> {
    let mut command = Command::new("osascript");
    for line in lines {
        command.arg("-e").arg(line);
    }
    let output = command.output().context("failed to launch osascript")?;
    if output.status.success() {
        return Ok(());
    }
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    Err(anyhow!(if !stderr.is_empty() { stderr } else { stdout }))
}

#[cfg(target_os = "macos")]
fn applescript_escape(value: &str) -> String {
    value.replace('\\', "\\\\").replace('"', "\\\"")
}

fn shell_quote(value: &str) -> String {
    let escaped = value.replace('\'', r#"'\''"#);
    format!("'{escaped}'")
}
