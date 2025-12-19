// 窗口事件处理模块
// 负责在应用启动时恢复窗口状态

use super::state_manager::{load_window_state, save_window_state, WindowState};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::Manager;

/// 初始化窗口事件处理器
pub fn init_window_event_handler(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    // 获取主窗口
    let main_window = app.get_webview_window("main").ok_or("无法获取主窗口")?;

    // 创建保存状态的共享状态，用于防抖和恢复标志
    let is_restoring = Arc::new(Mutex::new(true)); // 恢复标志，防止保存状态
    let debounce_timer = Arc::new(Mutex::new(None::<tauri::async_runtime::JoinHandle<()>>)); // 防抖定时器句柄
    const DEBOUNCE_DURATION: Duration = Duration::from_secs(2); // 防抖延迟时间

    // 应用启动时，尝试恢复上次保存的窗口状态
    let window_clone = main_window.clone();
    let is_restoring_clone = is_restoring.clone();
    tauri::async_runtime::spawn(async move {
        match load_window_state().await {
            Ok(saved_state) => {
                tracing::debug!(
                    target: "window::restore",
                    x = %saved_state.x,
                    y = %saved_state.y,
                    width = %saved_state.width,
                    height = %saved_state.height,
                    maximized = %saved_state.maximized,
                    "恢复窗口状态"
                );

                // 设置窗口位置
                if let Err(e) =
                    window_clone.set_position(tauri::Position::Physical(tauri::PhysicalPosition {
                        x: saved_state.x as i32,
                        y: saved_state.y as i32,
                    }))
                {
                    tracing::warn!(target: "window::restore", error = %e, "恢复窗口位置失败，使用默认位置");
                }

                // 设置窗口大小
                if let Err(e) = window_clone.set_size(tauri::Size::Physical(tauri::PhysicalSize {
                    width: saved_state.width as u32,
                    height: saved_state.height as u32,
                })) {
                    tracing::warn!(target: "window::restore", error = %e, "恢复窗口大小失败，使用默认大小");
                }

                // 如果之前是最大化状态，则恢复最大化
                if saved_state.maximized {
                    if let Err(e) = window_clone.maximize() {
                        eprintln!("⚠️ 恢复窗口最大化状态失败: {}", e);
                    } else {
                        println!("✅ 窗口状态恢复完成（包含最大化）");
                    }
                } else {
                    println!("✅ 窗口状态恢复完成");
                }
            }
            Err(e) => {
                eprintln!("⚠️ 加载窗口状态失败: {}，将使用默认状态", e);
                println!("✅ 使用默认窗口状态");
            }
        }

        // 恢复完成后，等待一小段时间确保所有窗口事件都处理完毕，然后清除恢复标志
        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
        // 安全的锁获取，避免毒化锁 panic
        match is_restoring_clone.lock() {
            Ok(mut flag) => {
                *flag = false;
                println!("✅ 窗口状态恢复标志已清除，开始响应窗口变化事件");
            }
            Err(_) => {
                eprintln!("⚠️ 恢复标志锁中毒，无法清除标志");
            }
        }
    });

    // 防抖保存函数 - 更简单的实现，避免复杂的借用
    let window_for_save = main_window.clone();
    let is_restoring_for_save = is_restoring.clone();
    let timer_for_save = debounce_timer.clone();

    let schedule_save = move || {
        // 取消之前的定时器
        let timer = timer_for_save.clone();
        {
            if let Ok(mut timer_guard) = timer.try_lock() {
                if let Some(handle) = timer_guard.take() {
                    handle.abort();
                }
            }
        } // 锁在这里自动释放

        // 克隆异步任务需要的变量
        let window = window_for_save.clone();
        let restoring = is_restoring_for_save.clone();
        let timer_clone = timer_for_save.clone();

        // 启动新的延迟保存任务
        let handle = tauri::async_runtime::spawn(async move {
            tokio::time::sleep(DEBOUNCE_DURATION).await;

            // 检查是否正在恢复状态
            let should_save = match restoring.try_lock() {
                Ok(is_restoring_flag) => !*is_restoring_flag,
                Err(_) => {
                    tracing::warn!(target: "window::event", "恢复标志锁被占用，跳过保存");
                    false
                }
            };

            if should_save {
                save_current_window_state(&window).await;
                tracing::debug!(target: "window::event", "窗口状态已保存（防抖延迟后）");
            }

            // 清除定时器
            if let Ok(mut timer_guard) = timer_clone.try_lock() {
                *timer_guard = None;
            }
        });

        // 保存定时器句柄
        if let Ok(mut timer_guard) = timer_for_save.try_lock() {
            *timer_guard = Some(handle);
        }
    };

    // 监听窗口事件，包括大小变化、移动和关闭
    let window_for_events = main_window.clone();
    let schedule_save_clone = schedule_save.clone();

    window_for_events.clone().on_window_event(move |event| {
        match event {
            // 窗口大小变化或移动时，使用防抖机制延迟保存
            tauri::WindowEvent::Resized { .. } | tauri::WindowEvent::Moved { .. } => {
                tracing::debug!(target: "window::event", "检测到窗口变化，启动防抖保存");
                schedule_save_clone();
            }
            // 注意：Tauri 2.x 中没有 Maximized/Unmaximized 事件
            // 最大化/还原状态会在 Resized 事件中捕获和处理
            // 窗口关闭时处理系统托盘逻辑
            tauri::WindowEvent::CloseRequested { api, .. } => {
                tracing::info!(target: "window::event", "收到窗口关闭请求事件");

                // 检查系统托盘是否启用
                let app_handle = window_for_events.app_handle();
                let system_tray = app_handle.state::<crate::system_tray::SystemTrayManager>();
                let tray_enabled = system_tray.is_enabled_setting(app_handle);

                if tray_enabled {
                    tracing::info!(target: "window::event", "系统托盘已启用，阻止关闭并最小化到托盘");
                    // 阻止窗口关闭
                    api.prevent_close();

                    // 在异步运行时中执行最小化操作
                    let app_handle = window_for_events.app_handle().clone();
                    tauri::async_runtime::spawn(async move {
                        let system_tray =
                            app_handle.state::<crate::system_tray::SystemTrayManager>();
                        if let Err(e) = system_tray.minimize_to_tray(&app_handle) {
                            tracing::error!(target: "window::event", error = %e, "最小化到托盘失败");
                        }
                    });
                    return;
                }

                tracing::info!(target: "window::event", "系统托盘未启用，立即保存状态并允许关闭");

                // 如果系统托盘未启用，立即保存状态并允许关闭（不需要防抖）
                let window = window_for_events.clone();
                tauri::async_runtime::spawn(async move {
                    save_current_window_state(&window).await;
                    tracing::debug!(target: "window::event", "窗口关闭前状态已保存");
                });
            }
            _ => {}
        }
    });

    Ok(())
}

/// 保存当前窗口状态的辅助函数
async fn save_current_window_state(window: &tauri::WebviewWindow) {
    if let (Ok(outer_position), Ok(outer_size), Ok(is_maximized)) = (
        window.outer_position(),
        window.outer_size(),
        window.is_maximized(),
    ) {
        let current_state = WindowState {
            x: outer_position.x as f64,
            y: outer_position.y as f64,
            width: outer_size.width as f64,
            height: outer_size.height as f64,
            maximized: is_maximized,
        };

        if let Err(e) = save_window_state(current_state).await {
            eprintln!("保存窗口状态失败: {}", e);
        }
    }
}
