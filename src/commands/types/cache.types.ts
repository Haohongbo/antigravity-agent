/**
 * 缓存系统相关的类型定义
 */

export interface CacheInitResult {
  /** 是否成功 */
  success: boolean;
  /** 详细消息 */
  message: string;
  /** CSRF Token 是否已加载 */
  csrf_token_loaded: boolean;
  /** 端口信息是否已加载 */
  ports_info_loaded: boolean;
  /** 初始化耗时（毫秒） */
  init_duration_ms: number;
}

export interface CacheStats {
  /** CSRF Token 缓存条目数 */
  csrf_cache_size: number;
  /** 端口信息缓存条目数 */
  ports_cache_size: number;
}