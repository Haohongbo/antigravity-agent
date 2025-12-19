/// 检查 Antigravity 进程是否正在运行
#[tauri::command]
pub async fn is_antigravity_running() -> bool {
    crate::platform::is_antigravity_running()
}
