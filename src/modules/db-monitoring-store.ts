/**
 * 数据库监控设置 Store
 * 合并了数据库监控设置和数据库监听状态管理
 */

import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import {listen, UnlistenFn} from '@tauri-apps/api/event';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

// 数据库变化事件数据接口
export interface DatabaseChangeEvent {
    timestamp: number;
    old_data?: any;
    new_data?: any;
}

// 导出事件相关类型
export type { DatabaseEventMap, DatabaseEventListener };

// 全局数据库事件发射器
const databaseEventEmitter = new EventEmitter();

// 全局 unlistenFn 变量
let globalUnlistenFn: UnlistenFn | null = null;

// 数据库事件类型
export const DATABASE_EVENTS = {
  DATA_CHANGED: 'database:data-changed',
} as const;

// 事件类型映射
type DatabaseEventMap = {
  [DATABASE_EVENTS.DATA_CHANGED]: DatabaseChangeEvent;
};

// 事件监听器类型
type DatabaseEventListener<T extends keyof DatabaseEventMap> = (data: DatabaseEventMap[T]) => void;

// 状态接口
interface DbMonitoringState {
  // 数据库监控设置
  dbMonitoringEnabled: boolean;
}

// 操作接口
interface DbMonitoringActions {
  // 数据库监控操作
  loadSettings: () => Promise<boolean>;
  setDbMonitoringEnabled: (enabled: boolean) => Promise<void>;
  toggleDbMonitoring: () => Promise<void>;

  // 数据库监听操作
  startListening: () => Promise<void>;
  stopListening: () => Promise<void>;
  cleanup: () => Promise<void>;

  addListener: <T extends keyof DatabaseEventMap>(
    event: T,
    listener: DatabaseEventListener<T>
  ) => (() => void);
}

// 创建 Store
export const useDbMonitoringStore = create<DbMonitoringState & DbMonitoringActions>()(
  (set, get) => ({
      // 初始状态
      // 数据库监控设置
      dbMonitoringEnabled: true, // 默认启用

      // 加载数据库监控设置
      loadSettings: async (): Promise<boolean> => {
        logger.info('加载数据库监控设置', { module: 'DbMonitoringStore' });

        try {
          // 加载数据库监控设置
          const dbMonitoringEnabled = await invoke<boolean>('is_db_monitoring_enabled');

          set({ dbMonitoringEnabled });

          if (dbMonitoringEnabled) {
            get().startListening()
          }

          logger.info('数据库监控设置已同步', {
            module: 'DbMonitoringStore',
            enabled: dbMonitoringEnabled,
            autoStarted: dbMonitoringEnabled
          });
          return dbMonitoringEnabled
        } catch (error) {
          logger.error('加载监控设置失败', {
            module: 'DbMonitoringStore',
            error: error instanceof Error ? error.message : String(error)
          });
          // 使用默认值
          set({ dbMonitoringEnabled: true });
        }
      },

      // 设置数据库监控启用状态
      setDbMonitoringEnabled: async (enabled: boolean): Promise<void> => {
        logger.info('设置数据库监控状态', { module: 'DbMonitoringStore', enabled });

        try {
          // 调用后端设置
          await invoke('set_db_monitoring_enabled', { enabled });
          if (!enabled) {
            get().stopListening()
          }
          set({ dbMonitoringEnabled: enabled });

          logger.info('数据库监控设置已更新', {
            module: 'DbMonitoringStore',
            enabled,
            previousState: !enabled
          });
        } catch (error) {
          logger.error('设置监控状态失败', {
            module: 'DbMonitoringStore',
            enabled,
            error: error instanceof Error ? error.message : String(error)
          });
          throw error;
        }
      },

      // 切换数据库监控状态
      toggleDbMonitoring: async (): Promise<void> => {
        const currentEnabled = get().dbMonitoringEnabled;
        logger.info('手动切换数据库监控', {
          module: 'DbMonitoringStore',
          from: currentEnabled,
          to: !currentEnabled
        });
        await get().setDbMonitoringEnabled(!currentEnabled);
      },

      // 数据库监听操作
      startListening: async (): Promise<void> => {
        try {
          logger.info('启动数据库监听', {
            module: 'DbMonitoringStore'
          });

          // 清理之前的监听器
          await get().cleanup();

          // 处理数据库变化事件
          const handleDatabaseChange = async (event: any) => {
            logger.info('接收到数据库变化事件', {
              module: 'DbMonitoringStore',
              eventId: event.id || 'unknown'
            });

            // 解析事件数据：newData, oldData, diff
            const { newData, oldData, diff } = event.payload;

            if (diff) {
              logger.info('数据库变化摘要', {
                module: 'DbMonitoringStore',
                hasChanges: diff.hasChanges,
                changedFieldsCount: diff.changedFields?.length || 0,
                summary: diff.summary
              });
            }

            // 触发界面更新（不管有没有变化）
            logger.info('触发界面更新', {
              module: 'DbMonitoringStore'
            });

            // 发射内部数据库变化事件
            databaseEventEmitter.emit(DATABASE_EVENTS.DATA_CHANGED, {
              timestamp: Date.now(),
              newData,
              oldData,
              diff,
              originalEvent: event
            });

            logger.info('数据库变化事件已发射', {
              module: 'DbMonitoringStore'
            });
          };

          // 监听后端推送的数据库变化事件
          globalUnlistenFn = await listen('database-changed', handleDatabaseChange);

          invoke('start_database_monitoring');
          logger.info('数据库监听已启动', {
            module: 'DbMonitoringStore'
          });
        } catch (error) {
          logger.error('启动数据库监听失败', {
            module: 'DbMonitoringStore',
            error: error instanceof Error ? error.message : String(error)
          });
        }
      },

      stopListening: async (): Promise<void> => {
        try {
          logger.info('停止数据库监听', {
            module: 'DbMonitoringStore'
          });

          await get().cleanup();

          logger.info('数据库监听已停止', {
            module: 'DbMonitoringStore'
          });
        } catch (error) {
          logger.error('停止数据库监听失败', {
            module: 'DbMonitoringStore',
            error: error instanceof Error ? error.message : String(error)
          });
        }
      },

      // 清理资源
      cleanup: async (): Promise<void> => {
        if (globalUnlistenFn) {
          try {
            await globalUnlistenFn();
            globalUnlistenFn = null;
            logger.info('数据库监听器已清理', {
              module: 'DbMonitoringStore'
            });
          } catch (error) {
            logger.warn('清理数据库监听器失败', {
              module: 'DbMonitoringStore',
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }
      },

      addListener: <T extends keyof DatabaseEventMap>(
        event: T,
        listener: DatabaseEventListener<T>
      ): (() => void) => {
        databaseEventEmitter.on(event, listener);

        // 返回取消订阅函数
        return () => {
          databaseEventEmitter.off(event, listener);
        };
      },
    }),
);
