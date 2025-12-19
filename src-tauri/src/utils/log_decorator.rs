//! 日志装饰器工具
//! 使用 tracing 提供命令执行的自动日志记录功能，包含智能脱敏

/// 替代原来的 log_async_command! 宏（带脱敏）
/// 使用简洁的实现来避免类型推断问题
#[macro_export]
macro_rules! log_async_command {
    ($command_name:expr, $future:expr) => {{
        let start_time = std::time::Instant::now();
        tracing::info!(
            target: "command::start",
            command = $command_name,
            "🔧 开始执行命令"
        );

        // 直接处理future，避免类型推断问题
        let (result, duration) = match $future.await {
            Ok(r) => (Ok(r), start_time.elapsed()),
            Err(e) => {
                let duration = start_time.elapsed();
                // 简化错误处理，避免字符串操作的类型推断
                let error_msg = format!("命令执行失败");
                tracing::error!(
                    target: "command::error",
                    command = $command_name,
                    duration_ms = duration.as_millis(),
                    error = %e,
                    "❌ 命令失败: {}", error_msg
                );
                (Err(e), duration)
            }
        };

        if result.is_ok() {
            tracing::info!(
                target: "command::success",
                command = $command_name,
                duration_ms = duration.as_millis(),
                "✅ 命令完成"
            );
        }

        result
    }};
}

/// 带用户上下文的日志记录（带脱敏）
#[macro_export]
macro_rules! log_user_command {
    ($command_name:expr, $user_email:expr, $future:expr) => {{
        let start_time = std::time::Instant::now();
        let sanitizer = $crate::utils::log_sanitizer::LogSanitizer::new();
        let masked_email = sanitizer.sanitize_email($user_email);
        tracing::info!(
            target: "user_command::start",
            command = $command_name,
            user_email = %masked_email,
            "🔧 用户操作开始"
        );

        match $future.await {
            Ok(result) => {
                let duration = start_time.elapsed();
                tracing::info!(
                    target: "user_command::success",
                    command = $command_name,
                    duration_ms = duration.as_millis(),
                    "✅ 用户操作完成"
                );
                Ok(result)
            }
            Err(e) => {
                let duration = start_time.elapsed();
                let error_msg = format!("用户操作失败");
                tracing::error!(
                    target: "user_command::error",
                    command = $command_name,
                    duration_ms = duration.as_millis(),
                    error = %e,
                    "❌ 用户操作失败: {}", error_msg
                );
                Err(e)
            }
        }
    }};
}
