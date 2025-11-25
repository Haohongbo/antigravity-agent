// Antigravity 用户数据清除模块
// 负责清除 Antigravity 应用的所有用户认证和设置信息

use rusqlite::{Connection, OptionalExtension};
use serde_json::Value;
use std::path::Path;

// 导入 platform_utils 模块
use crate::constants::database;
use crate::platform;

/// 使用常量定义需要物理删除的字段
const DELETE_KEYS: &[&str] = database::DELETE_KEYS;

/// 智能更新 Marker：彻底移除指定的 Key（而非设为0）
fn remove_keys_from_marker(conn: &Connection, keys_to_remove: &[&str]) -> Result<(), String> {
    tracing::debug!(target: "cleanup::marker", "正在修正校验标记 (Marker)");

    let current_marker_json: Option<String> = conn
        .query_row(
            &format!(
                "SELECT value FROM ItemTable WHERE key = '{}'",
                database::TARGET_STORAGE_MARKER
            ),
            [],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| format!("读取 Marker 失败: {}", e))?;

    let mut marker_obj: serde_json::Map<String, Value> = match current_marker_json {
        Some(s) => serde_json::from_str(&s).unwrap_or_default(),
        None => return Ok(()), // 没有 Marker 就不需要处理
    };

    let mut changed = false;
    for key in keys_to_remove {
        // 关键修正：这里必须是 remove，完全从 JSON 中移除该字段，而不是设为 0
        if marker_obj.remove(*key).is_some() {
            changed = true;
        }
    }

    if changed {
        let new_marker_str =
            serde_json::to_string(&marker_obj).map_err(|e| format!("序列化失败: {}", e))?;

        conn.execute(
            &format!(
                "INSERT OR REPLACE INTO ItemTable (key, value) VALUES ('{}', ?)",
                database::TARGET_STORAGE_MARKER
            ),
            [new_marker_str],
        )
        .map_err(|e| format!("写入 Marker 失败: {}", e))?;

        tracing::info!(target: "cleanup::marker", "校验标记已清理（完全移除登录相关字段）");
    } else {
        tracing::debug!(target: "cleanup::marker", "校验标记无需变更");
    }
    Ok(())
}

fn clear_database(db_path: &Path, db_name: &str) -> Result<usize, String> {
    tracing::info!(target: "cleanup::database", db_name = %db_name, "开始清理数据库");
    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;

    let mut count = 0;
    // 1. 物理删除数据行
    for key in DELETE_KEYS {
        let rows = conn
            .execute("DELETE FROM ItemTable WHERE key = ?", [key])
            .unwrap_or(0);
        if rows > 0 {
            tracing::debug!(target: "cleanup::database", key = %key, "已删除字段");
            count += 1;
        }
    }

    // 2. 同步修改 Marker 清单
    if let Err(e) = remove_keys_from_marker(&conn, DELETE_KEYS) {
        tracing::warn!(target: "cleanup::marker", error = %e, "Marker 更新警告");
    }

    Ok(count)
}

pub async fn clear_all_antigravity_data() -> Result<String, String> {
    tracing::info!(target: "cleanup::main", "开始清除 Antigravity 用户认证数据（保留设备指纹）");

    let app_data = match platform::get_antigravity_db_path() {
        Some(p) => p,
        None => {
            let possible_paths = platform::get_all_antigravity_db_paths();
            if possible_paths.is_empty() {
                return Err("未找到 Antigravity 安装位置".to_string());
            }
            possible_paths[0].clone()
        }
    };

    if !app_data.exists() {
        return Err(format!(
            "Antigravity 状态数据库不存在: {}",
            app_data.display()
        ));
    }

    let mut msg = String::new();

    // 清理主库
    tracing::info!(target: "cleanup::main", "步骤1: 清除 state.vscdb 数据库");
    match clear_database(&app_data, "state.vscdb") {
        Ok(c) => {
            tracing::info!(target: "cleanup::main", cleaned_count = %c, "主数据库已清除");
            msg.push_str(&format!("主库清理 {} 项", c));
        }
        Err(e) => return Err(e),
    }

    // 清理备份库
    tracing::info!(target: "cleanup::main", "步骤2: 清除 state.vscdb.backup");
    let backup_db = app_data.with_extension("vscdb.backup");
    if backup_db.exists() {
        if let Ok(c) = clear_database(&backup_db, "state.vscdb.backup") {
            tracing::info!(target: "cleanup::main", cleaned_count = %c, "备份数据库已清除");
            msg.push_str(&format!("; 备份库清理 {} 项", c));
        }
    } else {
        tracing::debug!(target: "cleanup::main", "备份数据库不存在，跳过");
    }

    // 添加设备指纹保护说明
    tracing::info!(target: "cleanup::main", "设备指纹保护: google.antigravity 已保留，避免风控触发");
    msg.push_str(" (设备指纹已保留)");

    Ok(format!("✅ 登出成功: {}", msg))
}
