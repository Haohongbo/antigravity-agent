import {invoke} from '@tauri-apps/api/core';

/**
 * 进程管理命令
 */
export class ProcessCommands {
  /**
   * 检查 Antigravity 进程是否正在运行
   * @returns 是否正在运行
   */
  static async isRunning(): Promise<boolean> {
    return invoke('is_antigravity_running');
  }
}
