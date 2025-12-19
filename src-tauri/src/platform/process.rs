/// 关闭Antigravity进程 - 使用sysinfo库实现跨平台统一处理
pub fn kill_antigravity_processes() -> Result<String, String> {
    tracing::info!("🔍 开始搜索并关闭 Antigravity 进程");

    // 使用sysinfo库获取所有进程
    let mut system = sysinfo::System::new_all();
    system.refresh_all();

    let mut killed_processes = Vec::new();

    // 定义需要关闭的进程模式（按优先级排序）
    let process_patterns = get_antigravity_process_patterns();

    for (pid, process) in system.processes() {
        let process_name = process.name();
        let process_cmd = process.cmd().join(" ");

        // 检查进程名或命令行是否匹配任何模式
        if matches_antigravity_process(process_name, &process_cmd, &process_patterns) {
            tracing::info!("🎯 找到目标进程: {} (PID: {})", process_name, pid);
            tracing::info!("📝 命令行: {}", process_cmd);

            // 尝试终止进程
            if process.kill() {
                killed_processes.push(format!("{} (PID: {})", process_name, pid));
                tracing::info!("✅ 成功终止进程: {} (PID: {})", process_name, pid);
            } else {
                tracing::warn!("⚠️ 终止进程失败: {} (PID: {})", process_name, pid);

                // 尝试多次终止（如果第一次失败）
                if process.kill() {
                    killed_processes.push(format!("{} (PID: {} - 强制)", process_name, pid));
                    tracing::info!("✅ 强制终止进程: {} (PID: {})", process_name, pid);
                } else {
                    tracing::error!("❌ 强制终止也失败: {} (PID: {})", process_name, pid);
                }
            }
        }
    }

    if killed_processes.is_empty() {
        tracing::info!("ℹ️ 未找到匹配的 Antigravity 进程");
        tracing::info!("🔍 搜索的进程模式: {:?}", process_patterns);
        Err("未找到Antigravity进程".to_string())
    } else {
        let success_msg = format!("已成功关闭Antigravity进程: {}", killed_processes.join(", "));
        tracing::info!("🎉 {}", success_msg);
        Ok(success_msg)
    }
}

/// 检查 Antigravity 进程是否正在运行（使用 sysinfo）
pub fn is_antigravity_running() -> bool {
    tracing::debug!("🔍 检查 Antigravity 进程是否运行");

    let mut system = sysinfo::System::new_all();
    system.refresh_all();

    let process_patterns = get_antigravity_process_patterns();

    for (pid, process) in system.processes() {
        let process_name = process.name();
        let process_cmd = process.cmd().join(" ");

        if matches_antigravity_process(process_name, &process_cmd, &process_patterns) {
            tracing::debug!(
                "✅ 发现运行中的 Antigravity 进程: {} (PID: {})",
                process_name,
                pid
            );
            return true;
        }
    }

    tracing::debug!("ℹ️ 未发现运行中的 Antigravity 进程");
    false
}

/// 获取 Antigravity 进程匹配模式
fn get_antigravity_process_patterns() -> Vec<ProcessPattern> {
    match std::env::consts::OS {
        "macos" => {
            vec![
                // 主进程：Electron（Antigravity的包装进程），必须通过路径验证
                ProcessPattern::CmdContains(
                    "/Applications/Antigravity.app/Contents/MacOS/Electron",
                ),
                // Helper 进程：Antigravity Helper系列（GPU、Renderer、Plugin等）
                ProcessPattern::CmdContains(
                    "Antigravity.app/Contents/Frameworks/Antigravity Helper",
                ),
            ]
        }
        "windows" => {
            vec![
                ProcessPattern::ExactName("Antigravity.exe"),
                // 兜底，目前未使用
                ProcessPattern::ExactName("Antigravity"),
            ]
        }
        "linux" => {
            vec![
                ProcessPattern::ExactName("antigravity"),
                ProcessPattern::CmdContains("Antigravity.AppImage"),
            ]
        }
        _ => {
            vec![ProcessPattern::ExactName("Antigravity")]
        }
    }
}

/// 检查进程是否匹配 Antigravity 模式
fn matches_antigravity_process(
    process_name: &str,
    process_cmd: &str,
    patterns: &[ProcessPattern],
) -> bool {
    let mut matched = false;
    for pattern in patterns {
        match pattern {
            ProcessPattern::ExactName(name) => {
                if process_name == *name {
                    tracing::debug!("✅ 精确匹配进程名: {}", name);
                    tracing::info!("🎯 匹配模式: ProcessPattern::ExactName(\"{}\")", name);
                    matched = true;
                }
            }
            ProcessPattern::CmdContains(text) => {
                if process_cmd.contains(text) {
                    tracing::debug!("✅ 命令行包含匹配: {}", text);
                    tracing::info!("🎯 匹配模式: ProcessPattern::CmdContains(\"{}\")", text);
                    matched = true;
                }
            }
        }
    }
    matched
}

/// 进程匹配模式
#[derive(Debug, Clone)]
pub enum ProcessPattern {
    ExactName(&'static str),   // 精确匹配进程名
    CmdContains(&'static str), // 命令行包含指定文本
}
