/**
 * 缓存系统相关的前端命令封装
 */

import { invoke } from '@tauri-apps/api/core';
import type { CacheInitResult, CacheStats } from './types/cache.types';

export class CacheCommands {
  /**
   * 初始化语言服务器缓存（预热缓存）
   * @returns 初始化结果
   */
  static async initializeLanguageServerCache(): Promise<CacheInitResult> {
    return await invoke<CacheInitResult>('initialize_language_server_cache');
  }

  
  /**
   * 清空所有缓存
   */
  static async clearAllCache(): Promise<void> {
    return await invoke('clear_all_cache_command');
  }

  /**
   * 获取缓存统计信息
   * @returns 缓存统计信息
   */
  static async getCacheStats(): Promise<CacheStats> {
    return await invoke<CacheStats>('get_cache_stats_command');
  }
}