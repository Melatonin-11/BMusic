use serde::Serialize;
use std::{
    env, fs,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc,
    },
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter};
use tauri_plugin_updater::UpdaterExt;

const PORTABLE_MARKER: &str = "portable.marker";
const PORTABLE_UPDATE_TARGET: &str = "windows-x86_64-portable";

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct PortableUpdateProgress {
    phase: &'static str,
    downloaded: u64,
    total: Option<u64>,
}

fn current_executable() -> Result<PathBuf, String> {
    env::current_exe().map_err(|error| format!("无法确定当前程序位置：{error}"))
}

fn portable_marker_path(executable: &Path) -> Result<PathBuf, String> {
    executable
        .parent()
        .map(|directory| directory.join(PORTABLE_MARKER))
        .ok_or_else(|| "无法确定便携版程序目录".to_string())
}

#[tauri::command]
pub fn is_portable_mode() -> bool {
    current_executable()
        .and_then(|executable| portable_marker_path(&executable))
        .map(|marker| marker.is_file())
        .unwrap_or(false)
}

#[cfg(target_os = "windows")]
fn launch_replacement_helper(
    script: &Path,
    current_exe: &Path,
    new_exe: &Path,
    backup_exe: &Path,
    working_directory: &Path,
) -> Result<(), String> {
    use std::os::windows::process::CommandExt;
    use std::process::Command;

    const CREATE_NO_WINDOW: u32 = 0x08000000;
    Command::new("powershell.exe")
        .args([
            "-NoLogo",
            "-NoProfile",
            "-NonInteractive",
            "-WindowStyle",
            "Hidden",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
        ])
        .arg(script)
        .arg("-ParentProcessId")
        .arg(std::process::id().to_string())
        .arg("-CurrentExe")
        .arg(current_exe)
        .arg("-NewExe")
        .arg(new_exe)
        .arg("-BackupExe")
        .arg(backup_exe)
        .arg("-WorkingDirectory")
        .arg(working_directory)
        .creation_flags(CREATE_NO_WINDOW)
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("无法启动便携版替换程序：{error}"))
}

#[cfg(not(target_os = "windows"))]
fn launch_replacement_helper(
    _script: &Path,
    _current_exe: &Path,
    _new_exe: &Path,
    _backup_exe: &Path,
    _working_directory: &Path,
) -> Result<(), String> {
    Err("便携版原地更新目前仅支持 Windows".to_string())
}

#[tauri::command]
pub async fn install_portable_update(app: AppHandle) -> Result<(), String> {
    let current_exe = current_executable()?;
    let working_directory = current_exe
        .parent()
        .ok_or_else(|| "无法确定便携版程序目录".to_string())?
        .to_path_buf();

    if !portable_marker_path(&current_exe)?.is_file() {
        return Err("当前程序不是受支持的便携版，请使用安装版更新流程".to_string());
    }

    let update = app
        .updater_builder()
        .target(PORTABLE_UPDATE_TARGET)
        .build()
        .map_err(|error| format!("初始化便携版更新器失败：{error}"))?
        .check()
        .await
        .map_err(|error| format!("检查便携版更新失败：{error}"))?
        .ok_or_else(|| "当前便携版已经是最新版本".to_string())?;

    let downloaded = Arc::new(AtomicU64::new(0));
    let progress_downloaded = Arc::clone(&downloaded);
    let progress_app = app.clone();
    let finish_app = app.clone();
    let bytes = update
        .download(
            move |chunk_length, content_length| {
                let current = progress_downloaded.fetch_add(chunk_length as u64, Ordering::Relaxed)
                    + chunk_length as u64;
                let _ = progress_app.emit(
                    "portable-update-progress",
                    PortableUpdateProgress {
                        phase: "downloading",
                        downloaded: current,
                        total: content_length,
                    },
                );
            },
            move || {
                let current = downloaded.load(Ordering::Relaxed);
                let _ = finish_app.emit(
                    "portable-update-progress",
                    PortableUpdateProgress {
                        phase: "installing",
                        downloaded: current,
                        total: Some(current),
                    },
                );
            },
        )
        .await
        .map_err(|error| format!("下载或验证便携版更新失败：{error}"))?;

    if bytes.is_empty() {
        return Err("下载到的便携版更新文件为空".to_string());
    }

    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| format!("系统时间异常：{error}"))?
        .as_millis();
    let update_directory = env::temp_dir().join(format!(
        "bili-randomizer-portable-update-{}-{timestamp}",
        std::process::id()
    ));
    fs::create_dir_all(&update_directory)
        .map_err(|error| format!("无法创建更新临时目录：{error}"))?;

    let new_exe = update_directory.join("BiliRandomizer.new.exe");
    let script = update_directory.join("replace-portable.ps1");
    let backup_exe = working_directory.join("BiliRandomizer.update-backup.exe");

    fs::write(&new_exe, bytes).map_err(|error| format!("无法保存新版程序：{error}"))?;
    if backup_exe.exists() {
        fs::remove_file(&backup_exe)
            .map_err(|error| format!("无法清理上次更新的备份文件：{error}"))?;
    }
    fs::copy(&current_exe, &backup_exe)
        .map_err(|error| format!("当前目录不可写，无法备份便携版程序：{error}"))?;

    const REPLACEMENT_SCRIPT: &str = r#"param(
  [Parameter(Mandatory=$true)][int]$ParentProcessId,
  [Parameter(Mandatory=$true)][string]$CurrentExe,
  [Parameter(Mandatory=$true)][string]$NewExe,
  [Parameter(Mandatory=$true)][string]$BackupExe,
  [Parameter(Mandatory=$true)][string]$WorkingDirectory
)
$ErrorActionPreference = 'Stop'
Wait-Process -Id $ParentProcessId -ErrorAction SilentlyContinue
$updated = $false
for ($attempt = 0; $attempt -lt 30; $attempt++) {
  try {
    Copy-Item -LiteralPath $NewExe -Destination $CurrentExe -Force
    $updated = $true
    break
  } catch {
    Start-Sleep -Milliseconds 500
  }
}
if (-not $updated) {
  Copy-Item -LiteralPath $BackupExe -Destination $CurrentExe -Force -ErrorAction SilentlyContinue
  exit 1
}
try {
  Start-Process -FilePath $CurrentExe -WorkingDirectory $WorkingDirectory
  Start-Sleep -Seconds 2
  Remove-Item -LiteralPath $BackupExe -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $NewExe -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $PSCommandPath -Force -ErrorAction SilentlyContinue
} catch {
  Copy-Item -LiteralPath $BackupExe -Destination $CurrentExe -Force -ErrorAction SilentlyContinue
  exit 1
}
"#;
    fs::write(&script, REPLACEMENT_SCRIPT)
        .map_err(|error| format!("无法创建便携版替换脚本：{error}"))?;

    if let Err(error) = launch_replacement_helper(
        &script,
        &current_exe,
        &new_exe,
        &backup_exe,
        &working_directory,
    ) {
        let _ = fs::remove_file(&backup_exe);
        let _ = fs::remove_dir_all(&update_directory);
        return Err(error);
    }

    let _ = app.emit(
        "portable-update-progress",
        PortableUpdateProgress {
            phase: "restarting",
            downloaded: 1,
            total: Some(1),
        },
    );
    app.exit(0);
    Ok(())
}
