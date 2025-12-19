use crate::directories;
/// 配置管理器
/// 统一管理所有配置目录和文件路径
use std::path::PathBuf;

/// 配置管理器结构
pub struct ConfigManager;

impl ConfigManager {
    /// 创建新的配置管理器
    pub fn new() -> Result<Self, String> {
        // 目录创建已经在 directories 模块中处理
        Ok(Self)
    }

    /// 获取窗口状态文件路径
    pub fn window_state_file(&self) -> PathBuf {
        directories::get_window_state_file()
    }
}
