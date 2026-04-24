use std::env;
use std::fs;
#[cfg(target_os = "windows")]
use std::fs::OpenOptions;
use std::io::{Read, Write};
use std::net::{SocketAddr, TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, Instant, UNIX_EPOCH};

use anyhow::{anyhow, Context, Result};
use serde::Serialize;
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

const BACKEND_HOST: &str = "127.0.0.1";
const HEALTH_PATH: &str = "/api/health";
const HEALTH_TIMEOUT: Duration = Duration::from_secs(30);
const HEALTH_POLL_INTERVAL: Duration = Duration::from_millis(100);
const BRIDGE_POLL_INTERVAL: Duration = Duration::from_millis(150);
const PI_PACKAGE_NAME: &str = "@mariozechner/pi-coding-agent";
const MANAGED_BACKEND_FINGERPRINT_FILE: &str = ".gogo-backend-runtime-fingerprint";
#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[derive(Debug, Default)]
struct PiInstallerState {
    in_progress: bool,
    last_exit_code: Option<i32>,
    last_detail: String,
}

#[derive(Debug, Serialize)]
struct PiInstallStatus {
    platform: String,
    command: String,
    command_path: Option<String>,
    bundled_command_path: Option<String>,
    managed_command_path: Option<String>,
    command_source: String,
    bundled_runtime_dir: String,
    runtime_dir: String,
    install_log_path: String,
    npm_command_path: Option<String>,
    installed: bool,
    install_supported: bool,
    install_in_progress: bool,
    detail: String,
}

#[derive(Debug, Serialize)]
struct PiInstallResponse {
    success: bool,
    detail: String,
    status: PiInstallStatus,
}

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

pub fn launch_backend(
    app_root: PathBuf,
    app_state_dir: PathBuf,
    companion_template_dir: PathBuf,
    default_knowledge_base_dir: PathBuf,
) -> Result<BackendRuntime> {
    let port = pick_available_port()?;
    let backend_url = format!("http://{BACKEND_HOST}:{port}");
    let bridge = start_desktop_bridge(&app_root, &app_state_dir)?;
    let bundled_backend_root = prepare_bundled_backend_runtime(&app_root, &app_state_dir)?;
    let launchers = build_launchers(&app_root, bundled_backend_root.as_deref(), port);
    let mut last_error: Option<anyhow::Error> = None;

    for launcher in launchers {
        match spawn_backend(
            &app_root,
            &app_state_dir,
            &companion_template_dir,
            &default_knowledge_base_dir,
            port,
            &backend_url,
            &bridge.bridge_url,
            &launcher,
        ) {
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

fn pick_available_port() -> Result<u16> {
    let listener = TcpListener::bind((BACKEND_HOST, 0)).context("failed to bind a free port")?;
    let port = listener
        .local_addr()
        .context("failed to read local addr")?
        .port();
    drop(listener);
    Ok(port)
}

fn build_launchers(
    app_root: &Path,
    bundled_backend_root: Option<&Path>,
    port: u16,
) -> Vec<Launcher> {
    let mut launchers = Vec::new();

    let bundled_backend_base = bundled_backend_root.unwrap_or(app_root);

    let bundled_backend_unix = bundled_backend_base.join("backend-runtime/gogo-backend");
    if bundled_backend_unix.exists() {
        launchers.push(Launcher {
            label: "bundled backend-runtime/gogo-backend".to_string(),
            program: bundled_backend_unix.to_string_lossy().into_owned(),
            args: Vec::new(),
        });
    }

    let bundled_backend_windows = bundled_backend_base.join("backend-runtime/gogo-backend.exe");
    if bundled_backend_windows.exists() {
        launchers.push(Launcher {
            label: "bundled backend-runtime/gogo-backend.exe".to_string(),
            program: bundled_backend_windows.to_string_lossy().into_owned(),
            args: Vec::new(),
        });
    }

    if let Ok(raw_python) = env::var("GOGO_DESKTOP_PYTHON") {
        let candidate = raw_python.trim();
        if !candidate.is_empty() {
            launchers.push(python_launcher("env:GOGO_DESKTOP_PYTHON", candidate, port));
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

fn prepare_bundled_backend_runtime(
    app_root: &Path,
    app_state_dir: &Path,
) -> Result<Option<PathBuf>> {
    let bundled_dir = app_root.join("backend-runtime");
    if !bundled_dir.exists() {
        return Ok(None);
    }

    let bundled_unix = bundled_dir.join("gogo-backend");
    if bundled_unix.exists() {
        return Ok(None);
    }

    let bundled_windows = bundled_dir.join("gogo-backend.exe");
    if bundled_windows.exists() {
        return Ok(None);
    }

    let packaged_windows = bundled_dir.join("gogo-backend.bin");
    let sidecar_windows = app_root.join("gogo-backend.exe");
    if !packaged_windows.exists() && !sidecar_windows.exists() {
        return Ok(None);
    }

    let managed_root = app_state_dir.join("bundled-resources");
    let managed_backend_dir = managed_root.join("backend-runtime");
    fs::create_dir_all(&managed_root).context("failed to create managed bundled resource root")?;
    let expected_fingerprint =
        backend_runtime_fingerprint(&packaged_windows, &sidecar_windows)?;

    if managed_backend_runtime_ready(&managed_backend_dir, &expected_fingerprint) {
        return Ok(Some(managed_root));
    }

    if managed_backend_dir.exists() {
        match fs::remove_dir_all(&managed_backend_dir) {
            Ok(()) => {}
            Err(error) if managed_backend_runtime_layout_ready(&managed_backend_dir) => {
                eprintln!(
                    "failed to replace managed backend runtime `{}`; reusing existing runtime: {error}",
                    managed_backend_dir.display()
                );
                return Ok(Some(managed_root));
            }
            Err(error) => {
                return Err(error).with_context(|| {
                    format!(
                        "failed to remove incomplete managed backend runtime `{}`",
                        managed_backend_dir.display()
                    )
                });
            }
        }
    }

    copy_directory_contents(&bundled_dir, &managed_backend_dir)?;

    let managed_windows = managed_backend_dir.join("gogo-backend.exe");
    if managed_windows.exists() {
        let _ = fs::remove_file(&managed_windows);
    }

    if sidecar_windows.exists() {
        fs::copy(&sidecar_windows, &managed_windows).with_context(|| {
            format!(
                "failed to copy bundled backend sidecar `{}` to `{}`",
                sidecar_windows.display(),
                managed_windows.display()
            )
        })?;
    } else {
        let managed_packaged = managed_backend_dir.join("gogo-backend.bin");
        fs::rename(&managed_packaged, &managed_windows).with_context(|| {
            format!(
                "failed to restore packaged backend launcher `{}`",
                managed_packaged.display()
            )
        })?;
    }

    fs::write(
        managed_backend_dir.join(MANAGED_BACKEND_FINGERPRINT_FILE),
        expected_fingerprint,
    )
    .with_context(|| {
        format!(
            "failed to write managed backend runtime fingerprint in `{}`",
            managed_backend_dir.display()
        )
    })?;

    Ok(Some(managed_root))
}

fn managed_backend_runtime_ready(managed_backend_dir: &Path, expected_fingerprint: &str) -> bool {
    if !managed_backend_runtime_layout_ready(managed_backend_dir) {
        return false;
    }

    let marker = managed_backend_dir.join(MANAGED_BACKEND_FINGERPRINT_FILE);
    fs::read_to_string(marker)
        .map(|value| value == expected_fingerprint)
        .unwrap_or(false)
}

fn managed_backend_runtime_layout_ready(managed_backend_dir: &Path) -> bool {
    managed_backend_dir.join("gogo-backend.exe").is_file()
        && managed_backend_dir.join("_internal").is_dir()
}

fn backend_runtime_fingerprint(packaged_windows: &Path, sidecar_windows: &Path) -> Result<String> {
    let launcher = if sidecar_windows.exists() {
        sidecar_windows
    } else {
        packaged_windows
    };
    let metadata = fs::metadata(launcher).with_context(|| {
        format!(
            "failed to read bundled backend launcher metadata `{}`",
            launcher.display()
        )
    })?;
    let modified = metadata
        .modified()
        .ok()
        .and_then(|value| value.duration_since(UNIX_EPOCH).ok())
        .map(|value| value.as_secs())
        .unwrap_or(0);
    Ok(format!("{}:{}:{}", launcher.display(), metadata.len(), modified))
}

fn copy_directory_contents(source: &Path, destination: &Path) -> Result<()> {
    fs::create_dir_all(destination)
        .with_context(|| format!("failed to create directory `{}`", destination.display()))?;

    for entry in
        fs::read_dir(source).with_context(|| format!("failed to read `{}`", source.display()))?
    {
        let entry =
            entry.with_context(|| format!("failed to read entry in `{}`", source.display()))?;
        let source_path = entry.path();
        let destination_path = destination.join(entry.file_name());
        let file_type = entry
            .file_type()
            .with_context(|| format!("failed to read file type for `{}`", source_path.display()))?;

        if file_type.is_dir() {
            copy_directory_contents(&source_path, &destination_path)?;
        } else if file_type.is_file() {
            fs::copy(&source_path, &destination_path).with_context(|| {
                format!(
                    "failed to copy `{}` to `{}`",
                    source_path.display(),
                    destination_path.display()
                )
            })?;
        }
    }

    Ok(())
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
    app_state_dir: &Path,
    companion_template_dir: &Path,
    default_knowledge_base_dir: &Path,
    port: u16,
    backend_url: &str,
    bridge_url: &str,
    launcher: &Launcher,
) -> Result<Child> {
    let mut command = Command::new(&launcher.program);
    command
        .args(&launcher.args)
        .current_dir(app_root)
        .env("GOGO_RUNTIME", "desktop")
        .env("GOGO_APP_ROOT", app_root)
        .env("GOGO_APP_STATE_DIR", app_state_dir)
        .env("GOGO_BACKEND_HOST", BACKEND_HOST)
        .env("GOGO_BACKEND_PORT", port.to_string())
        .env(
            "GOGO_COMPANION_KNOWLEDGE_BASE_TEMPLATE_DIR",
            companion_template_dir,
        )
        .env(
            "GOGO_DEFAULT_KNOWLEDGE_BASE_DIR",
            default_knowledge_base_dir,
        )
        .env("GOGO_DESKTOP_BACKEND_URL", backend_url)
        .env("GOGO_DESKTOP_BRIDGE_URL", bridge_url)
        .env("PYTHONUNBUFFERED", "1");

    configure_backend_command_stdio(&mut command, app_state_dir)?;

    command
        .spawn()
        .with_context(|| format!("failed to spawn `{}`", launcher.program))
}

fn configure_backend_command_stdio(command: &mut Command, app_state_dir: &Path) -> Result<()> {
    command.stdin(Stdio::null());

    #[cfg(target_os = "windows")]
    {
        let log_path = backend_log_path(app_state_dir);
        let backend_log = log_path
            .parent()
            .and_then(|parent| fs::create_dir_all(parent).ok().map(|_| ()))
            .and_then(|_| {
                OpenOptions::new()
                    .create(true)
                    .append(true)
                    .open(&log_path)
                    .ok()
            })
            .and_then(|stdout| stdout.try_clone().ok().map(|stderr| (stdout, stderr)));

        if let Some((stdout, stderr)) = backend_log {
            command.stdout(Stdio::from(stdout)).stderr(Stdio::from(stderr));
        } else {
            command.stdout(Stdio::null()).stderr(Stdio::null());
        }

        command.creation_flags(CREATE_NO_WINDOW);
    }

    #[cfg(not(target_os = "windows"))]
    {
        command.stdout(Stdio::inherit()).stderr(Stdio::inherit());
    }

    Ok(())
}

fn backend_log_path(app_state_dir: &Path) -> PathBuf {
    app_state_dir.join("logs/backend.log")
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
    let Ok(mut stream) = TcpStream::connect_timeout(&socket_addr, Duration::from_millis(500))
    else {
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
    _pi_installer: Arc<Mutex<PiInstallerState>>,
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

#[derive(Debug)]
struct PiCommandSpec {
    program: String,
    args: Vec<String>,
}

fn start_desktop_bridge(app_root: &Path, app_state_dir: &Path) -> Result<DesktopBridgeRuntime> {
    let listener = TcpListener::bind((BACKEND_HOST, 0)).context("failed to bind desktop bridge")?;
    listener
        .set_nonblocking(true)
        .context("failed to configure desktop bridge listener")?;
    let port = listener
        .local_addr()
        .context("failed to read desktop bridge addr")?
        .port();
    let shutdown = Arc::new(AtomicBool::new(false));
    let pi_installer = Arc::new(Mutex::new(PiInstallerState::default()));
    let thread_shutdown = shutdown.clone();
    let thread_app_root = app_root.to_path_buf();
    let thread_app_state_dir = app_state_dir.to_path_buf();
    let thread_pi_installer = pi_installer.clone();
    let handle = thread::spawn(move || {
        while !thread_shutdown.load(Ordering::Relaxed) {
            match listener.accept() {
                Ok((stream, _)) => {
                    let _ = handle_desktop_bridge_client(
                        stream,
                        &thread_app_root,
                        &thread_app_state_dir,
                        &thread_pi_installer,
                    );
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
        _pi_installer: pi_installer,
        thread: Mutex::new(Some(handle)),
    })
}

fn handle_desktop_bridge_client(
    mut stream: TcpStream,
    app_root: &Path,
    app_state_dir: &Path,
    pi_installer: &Arc<Mutex<PiInstallerState>>,
) -> Result<()> {
    let mut request_bytes = Vec::new();
    let mut buffer = [0_u8; 4096];
    let header_end;
    loop {
        let read = stream
            .read(&mut buffer)
            .context("failed to read bridge request")?;
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
        let read = stream
            .read(&mut buffer)
            .context("failed to read bridge request body")?;
        if read == 0 {
            break;
        }
        request_bytes.extend_from_slice(&buffer[..read]);
    }
    let body_end = body_start
        .saturating_add(content_length)
        .min(request_bytes.len());
    let body = &request_bytes[body_start..body_end];

    if method != "POST" || !matches!(path, "/desktop-login" | "/pi-status" | "/pi-install") {
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

    match path {
        "/desktop-login" => match launch_desktop_pi_login(app_root, app_state_dir) {
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
        },
        "/pi-status" => {
            let status = build_pi_install_status(app_root, app_state_dir, pi_installer);
            write_json_response(&mut stream, 200, &status)?;
        }
        "/pi-install" => match start_pi_install(app_root, app_state_dir, pi_installer) {
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
        },
        _ => {}
    }
    Ok(())
}

fn start_pi_install(
    app_root: &Path,
    app_state_dir: &Path,
    pi_installer: &Arc<Mutex<PiInstallerState>>,
) -> Result<PiInstallResponse> {
    let status = build_pi_install_status(app_root, app_state_dir, pi_installer);
    if status.installed {
        return Ok(PiInstallResponse {
            success: true,
            detail: "当前已经检测到可用的 `pi` 命令。".to_string(),
            status,
        });
    }

    let npm_command_path = resolve_npm_command_path()
        .ok_or_else(|| anyhow!("当前未检测到可用的 npm，无法在应用内安装 Pi。"))?;

    {
        let Ok(mut state) = pi_installer.lock() else {
            return Err(anyhow!("无法锁定 Pi 安装状态。"));
        };
        if state.in_progress {
            let current = build_pi_install_status(app_root, app_state_dir, pi_installer);
            return Ok(PiInstallResponse {
                success: true,
                detail: "Pi 正在后台安装中。".to_string(),
                status: current,
            });
        }
        state.in_progress = true;
        state.last_exit_code = None;
        state.last_detail = "正在后台安装 Pi…".to_string();
    }

    let thread_state = pi_installer.clone();
    let thread_app_root = app_root.to_path_buf();
    let thread_app_state_dir = app_state_dir.to_path_buf();
    thread::spawn(move || {
        let result = run_pi_install(&thread_app_state_dir, &npm_command_path);
        if let Ok(mut state) = thread_state.lock() {
            state.in_progress = false;
            match result {
                Ok(exit_code) => {
                    state.last_exit_code = Some(exit_code);
                    if preferred_pi_command_path(&thread_app_root, &thread_app_state_dir).is_some()
                    {
                        state.last_detail =
                            "Pi 已安装到 gogo-app 的托管目录，可以直接继续登录。".to_string();
                    } else {
                        state.last_detail = format!(
                            "Pi 安装进程已结束，但当前仍未检测到可执行文件（退出码：{exit_code}）。"
                        );
                    }
                }
                Err(error) => {
                    state.last_exit_code = None;
                    state.last_detail = error.to_string();
                }
            }
        }
    });

    Ok(PiInstallResponse {
        success: true,
        detail: "已开始在后台安装 Pi，请稍候刷新状态。".to_string(),
        status: build_pi_install_status(app_root, app_state_dir, pi_installer),
    })
}

fn run_pi_install(app_state_dir: &Path, npm_command_path: &Path) -> Result<i32> {
    let runtime_dir = managed_pi_runtime_dir(app_state_dir);
    fs::create_dir_all(&runtime_dir).context("failed to create managed pi runtime dir")?;

    let log_path = managed_pi_install_log_path(app_state_dir);
    let install_command = format!(
        "\"{}\" install --prefix \"{}\" {} --no-fund --no-audit",
        npm_command_path.display(),
        runtime_dir.display(),
        PI_PACKAGE_NAME
    );

    let mut command = build_npm_command(npm_command_path);
    command
        .arg("install")
        .arg("--prefix")
        .arg(&runtime_dir)
        .arg(PI_PACKAGE_NAME)
        .arg("--no-fund")
        .arg("--no-audit")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let output = command
        .output()
        .context("failed to launch npm install for Pi")?;
    let mut log_lines = vec![format!("$ {install_command}"), String::new()];
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    if !stdout.is_empty() {
        log_lines.push("[stdout]".to_string());
        log_lines.push(stdout);
    }
    if !stderr.is_empty() {
        log_lines.push("[stderr]".to_string());
        log_lines.push(stderr);
    }
    if let Some(parent) = log_path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let _ = fs::write(&log_path, log_lines.join("\n") + "\n");

    if output.status.success() {
        return Ok(output.status.code().unwrap_or(0));
    }

    Err(anyhow!(
        "Pi 安装失败，请查看安装日志：{}",
        log_path.to_string_lossy()
    ))
}

fn build_pi_install_status(
    app_root: &Path,
    app_state_dir: &Path,
    pi_installer: &Arc<Mutex<PiInstallerState>>,
) -> PiInstallStatus {
    let command = env::var("PI_COMMAND")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "pi".to_string());
    let command_path = preferred_pi_command_path(app_root, app_state_dir)
        .map(|path| path.to_string_lossy().into_owned());
    let bundled_command_path =
        bundled_pi_command_path(app_root).map(|path| path.to_string_lossy().into_owned());
    let managed_command_path =
        managed_pi_command_path(app_state_dir).map(|path| path.to_string_lossy().into_owned());
    let npm_command_path =
        resolve_npm_command_path().map(|path| path.to_string_lossy().into_owned());
    let install_supported = npm_command_path.is_some();
    let runtime_dir = managed_pi_runtime_dir(app_state_dir);
    let install_log_path = managed_pi_install_log_path(app_state_dir);

    let mut install_in_progress = false;
    let mut last_detail = String::new();
    if let Ok(state) = pi_installer.lock() {
        install_in_progress = state.in_progress;
        last_detail = state.last_detail.clone();
    }

    let command_source = match (&bundled_command_path, &managed_command_path, &command_path) {
        (Some(bundled), _, Some(current)) if bundled == current => "bundled",
        (_, Some(managed), Some(current)) if managed == current => "managed",
        (_, _, Some(_)) => "path",
        _ => "",
    }
    .to_string();

    let detail = if install_in_progress {
        if last_detail.trim().is_empty() {
            "Pi 正在后台安装中，请稍候刷新状态。".to_string()
        } else {
            last_detail
        }
    } else if command_path.is_some() {
        if command_source == "bundled" {
            "已检测到随 gogo-app 一起打包的 `pi` binary。".to_string()
        } else if command_source == "managed" {
            "已检测到 gogo-app 托管的 `pi` 运行时。".to_string()
        } else {
            "已检测到系统中的 `pi` 命令。".to_string()
        }
    } else if !install_supported {
        "当前未检测到可用的 npm，无法在应用内安装 Pi。".to_string()
    } else if !last_detail.trim().is_empty() {
        last_detail
    } else {
        "当前未检测到可用的 `pi` 命令，可以在启动引导中触发本地 fallback 安装。".to_string()
    };

    PiInstallStatus {
        platform: env::consts::OS.to_string(),
        command,
        command_path,
        bundled_command_path,
        managed_command_path,
        command_source,
        bundled_runtime_dir: bundled_pi_runtime_dir(app_root)
            .to_string_lossy()
            .into_owned(),
        runtime_dir: runtime_dir.to_string_lossy().into_owned(),
        install_log_path: install_log_path.to_string_lossy().into_owned(),
        npm_command_path,
        installed: preferred_pi_command_path(app_root, app_state_dir).is_some(),
        install_supported,
        install_in_progress,
        detail,
    }
}

fn bundled_pi_runtime_dir(app_root: &Path) -> PathBuf {
    app_root.join("pi-runtime")
}

fn bundled_pi_command_path(app_root: &Path) -> Option<PathBuf> {
    [
        bundled_pi_runtime_dir(app_root).join("pi"),
        bundled_pi_runtime_dir(app_root).join("pi.exe"),
        bundled_pi_runtime_dir(app_root).join("pi.cmd"),
    ]
    .into_iter()
    .find(|path| path.exists())
}

fn managed_pi_runtime_dir(app_state_dir: &Path) -> PathBuf {
    app_state_dir.join("pi-runtime")
}

fn managed_pi_install_log_path(app_state_dir: &Path) -> PathBuf {
    managed_pi_runtime_dir(app_state_dir).join("install.log")
}

fn managed_pi_command_path(app_state_dir: &Path) -> Option<PathBuf> {
    [
        managed_pi_runtime_dir(app_state_dir).join("node_modules/.bin/pi"),
        managed_pi_runtime_dir(app_state_dir).join("node_modules/.bin/pi.cmd"),
        managed_pi_runtime_dir(app_state_dir).join("node_modules/.bin/pi.exe"),
    ]
    .into_iter()
    .find(|path| path.exists())
}

fn preferred_pi_command_path(app_root: &Path, app_state_dir: &Path) -> Option<PathBuf> {
    bundled_pi_command_path(app_root)
        .or_else(|| managed_pi_command_path(app_state_dir))
        .or_else(|| resolve_command_path(&pi_command_candidates()))
}

fn resolve_npm_command_path() -> Option<PathBuf> {
    resolve_command_path(&npm_command_candidates())
}

fn pi_command_candidates() -> Vec<String> {
    let mut candidates = Vec::new();
    if let Ok(raw) = env::var("PI_COMMAND") {
        let trimmed = raw.trim();
        if !trimmed.is_empty() {
            candidates.push(trimmed.to_string());
        }
    }
    candidates.push("pi".to_string());
    candidates
}

fn npm_command_candidates() -> Vec<String> {
    let mut candidates = Vec::new();
    if let Ok(raw) = env::var("NPM_COMMAND") {
        let trimmed = raw.trim();
        if !trimmed.is_empty() {
            candidates.push(trimmed.to_string());
        }
    }
    candidates.push("npm".to_string());
    #[cfg(target_os = "windows")]
    {
        candidates.push("npm.cmd".to_string());
        candidates.push("npm.exe".to_string());
    }
    candidates
}

fn resolve_command_path(candidates: &[String]) -> Option<PathBuf> {
    for candidate in candidates {
        let trimmed = candidate.trim();
        if trimmed.is_empty() {
            continue;
        }
        let candidate_path = PathBuf::from(trimmed);
        if candidate_path.components().count() > 1 {
            if candidate_path.exists() {
                return Some(candidate_path);
            }
            continue;
        }

        let path_env = env::var_os("PATH")?;
        for base_dir in env::split_paths(&path_env) {
            let direct = base_dir.join(trimmed);
            if direct.exists() {
                return Some(direct);
            }
            for variant in windows_command_variants(trimmed) {
                let variant_path = base_dir.join(variant);
                if variant_path.exists() {
                    return Some(variant_path);
                }
            }
        }
    }
    None
}

#[cfg(target_os = "windows")]
fn windows_command_variants(command: &str) -> Vec<String> {
    let lower = command.to_ascii_lowercase();
    if lower.ends_with(".exe") || lower.ends_with(".cmd") || lower.ends_with(".bat") {
        return Vec::new();
    }
    vec![
        format!("{command}.exe"),
        format!("{command}.cmd"),
        format!("{command}.bat"),
    ]
}

#[cfg(not(target_os = "windows"))]
fn windows_command_variants(_command: &str) -> Vec<String> {
    Vec::new()
}

fn build_npm_command(npm_command_path: &Path) -> Command {
    #[cfg(target_os = "windows")]
    {
        let extension = npm_command_path
            .extension()
            .and_then(|value| value.to_str())
            .map(|value| value.to_ascii_lowercase())
            .unwrap_or_default();
        if extension == "cmd" || extension == "bat" {
            let mut command = Command::new("cmd.exe");
            command.arg("/C").arg(npm_command_path);
            return command;
        }
    }

    Command::new(npm_command_path)
}

fn write_json_response(
    stream: &mut TcpStream,
    status_code: u16,
    payload: &impl Serialize,
) -> Result<()> {
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

fn launch_desktop_pi_login(app_root: &Path, app_state_dir: &Path) -> Result<DesktopLoginResponse> {
    #[cfg(target_os = "macos")]
    {
        let shell_command = build_pi_terminal_shell_command(app_root, app_state_dir);
        launch_macos_terminal(shell_command)?;
        return Ok(DesktopLoginResponse {
            success: true,
            detail:
                "已打开 Pi 终端。请在终端里手动输入 `/login`，完成登录后 gogo-app 会自动刷新 Provider 状态。"
                    .to_string(),
            command_hint: "/login".to_string(),
        });
    }

    #[cfg(target_os = "windows")]
    {
        let shell_command = build_pi_terminal_powershell_command(app_root, app_state_dir);
        let cmd_fallback = build_pi_terminal_cmd_command(app_root, app_state_dir);
        launch_windows_login_shell(app_root, shell_command, cmd_fallback)?;
        return Ok(DesktopLoginResponse {
            success: true,
            detail:
                "已打开 Pi 终端。请在终端里手动输入 `/login`，完成登录后 gogo-app 会自动刷新 Provider 状态。"
                    .to_string(),
            command_hint: "/login".to_string(),
        });
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let _ = app_root;
        let _ = app_state_dir;
        Err(anyhow!(
            "当前桌面版 Pi 登录桥暂时只实现了 macOS / Windows 终端拉起流程。"
        ))
    }
}

#[cfg(target_os = "macos")]
fn build_pi_terminal_shell_command(app_root: &Path, app_state_dir: &Path) -> String {
    let spec = build_pi_command_spec(app_root, app_state_dir);
    let mut parts = vec![
        format!("cd {}", shell_quote(app_root.to_string_lossy().as_ref())),
        build_pi_shell_command(&spec),
    ];
    parts.push(
        "printf '\\nPi 已启动。若未自动触发登录，请输入上方提示中的 /login 命令。\\n'".to_string(),
    );
    parts.push("exec $SHELL -l".to_string());
    parts.join(" ; ")
}

#[cfg(target_os = "windows")]
fn build_pi_terminal_cmd_command(app_root: &Path, app_state_dir: &Path) -> String {
    let spec = build_pi_command_spec(app_root, app_state_dir);
    let app_root = normalize_windows_shell_path(app_root);
    let mut parts = vec![format!(
        "cd /d {}",
        windows_cmd_quote(app_root.to_string_lossy().as_ref())
    )];
    parts.push("echo.".to_string());
    parts.push("echo Pi 已启动。若未自动触发登录，请输入 /login 命令。".to_string());
    parts.push(build_pi_cmd_command(&spec));
    parts.join(" && ")
}

#[cfg(target_os = "windows")]
fn build_pi_terminal_powershell_command(app_root: &Path, app_state_dir: &Path) -> String {
    let spec = build_pi_command_spec(app_root, app_state_dir);
    let app_root = normalize_windows_shell_path(app_root);
    let parts = vec![
        format!(
            "Set-Location -LiteralPath {}",
            windows_powershell_quote(app_root.to_string_lossy().as_ref())
        ),
        "Write-Host ''".to_string(),
        "Write-Host 'Pi started. If the login menu is not visible, type /login and press Enter.'"
            .to_string(),
        build_pi_powershell_command(&spec),
    ];
    parts.join("; ")
}

fn build_pi_command_spec(app_root: &Path, app_state_dir: &Path) -> PiCommandSpec {
    let pi_program = preferred_pi_command_path(app_root, app_state_dir)
        .map(|path| {
            normalize_windows_shell_path(&path)
                .to_string_lossy()
                .into_owned()
        })
        .or_else(|| {
            env::var("PI_COMMAND")
                .ok()
                .map(|value| normalize_windows_shell_value(value.trim()))
                .filter(|value| !value.trim().is_empty())
        })
        .unwrap_or_else(|| "pi".to_string());

    let mut args = Vec::new();
    let managed_extension = app_state_dir.join("pi-extensions/managed-providers.ts");
    if managed_extension.exists() {
        args.push("--extension".to_string());
        args.push(
            normalize_windows_shell_path(&managed_extension)
                .to_string_lossy()
                .into_owned(),
        );
    }

    PiCommandSpec {
        program: pi_program,
        args,
    }
}

#[cfg(target_os = "macos")]
fn build_pi_shell_command(spec: &PiCommandSpec) -> String {
    let mut args = vec![shell_quote(&spec.program)];
    for item in &spec.args {
        args.push(shell_quote(item));
    }
    args.join(" ")
}

#[cfg(target_os = "windows")]
fn build_pi_cmd_command(spec: &PiCommandSpec) -> String {
    let mut args = Vec::new();
    let program = if is_windows_batch_script(&spec.program) {
        format!("call {}", windows_cmd_quote(&spec.program))
    } else {
        windows_cmd_quote(&spec.program)
    };
    args.push(program);
    for item in &spec.args {
        args.push(windows_cmd_quote(item));
    }
    args.join(" ")
}

#[cfg(target_os = "windows")]
fn build_pi_powershell_command(spec: &PiCommandSpec) -> String {
    let mut args = vec!["&".to_string(), windows_powershell_quote(&spec.program)];
    for item in &spec.args {
        args.push(windows_powershell_quote(item));
    }
    args.join(" ")
}

#[cfg(target_os = "macos")]
fn launch_macos_terminal(shell_command: String) -> Result<()> {
    let script = vec![
        r#"tell application "Terminal" to activate"#.to_string(),
        format!(
            r#"tell application "Terminal" to do script "{}""#,
            applescript_escape(&shell_command)
        ),
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

#[cfg(target_os = "windows")]
fn launch_windows_login_shell(
    app_root: &Path,
    shell_command: String,
    cmd_fallback: String,
) -> Result<()> {
    let app_root = normalize_windows_shell_path(app_root);
    let powershell =
        resolve_command_path(&["powershell.exe".to_string(), "powershell".to_string()]);

    if let Some(powershell) = powershell {
        Command::new(powershell)
            .arg("-NoExit")
            .arg("-NoProfile")
            .arg("-ExecutionPolicy")
            .arg("Bypass")
            .arg("-Command")
            .arg(&shell_command)
            .current_dir(&app_root)
            .spawn()
            .context("failed to launch PowerShell for Pi login")?;
        return Ok(());
    }

    Command::new("cmd.exe")
        .arg("/K")
        .arg(cmd_fallback)
        .current_dir(&app_root)
        .spawn()
        .context("failed to launch cmd.exe for Pi login")?;
    Ok(())
}

#[cfg(target_os = "macos")]
fn applescript_escape(value: &str) -> String {
    value.replace('\\', "\\\\").replace('"', "\\\"")
}

#[cfg(target_os = "windows")]
fn windows_cmd_quote(value: &str) -> String {
    let escaped = value.replace('"', "\"\"");
    format!("\"{escaped}\"")
}

#[cfg(target_os = "windows")]
fn windows_powershell_quote(value: &str) -> String {
    let escaped = normalize_windows_shell_value(value).replace('\'', "''");
    format!("'{escaped}'")
}

#[cfg(target_os = "windows")]
fn is_windows_batch_script(value: &str) -> bool {
    value
        .rsplit_once('.')
        .map(|(_, extension)| matches!(extension.to_ascii_lowercase().as_str(), "cmd" | "bat"))
        .unwrap_or(false)
}

#[cfg(target_os = "windows")]
fn normalize_windows_shell_path(path: &Path) -> PathBuf {
    PathBuf::from(normalize_windows_shell_value(
        path.to_string_lossy().as_ref(),
    ))
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
fn normalize_windows_shell_path(path: &Path) -> PathBuf {
    path.to_path_buf()
}

#[cfg(not(target_os = "windows"))]
fn normalize_windows_shell_value(value: &str) -> String {
    value.to_string()
}

#[cfg(target_os = "macos")]
fn shell_quote(value: &str) -> String {
    let escaped = value.replace('\'', r#"'\''"#);
    format!("'{escaped}'")
}
