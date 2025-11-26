import {create} from 'zustand';
import {AntigravityService} from '../services/antigravity-service';
import {logger} from '../utils/logger';
import toast from 'react-hot-toast';
import {invoke} from "@tauri-apps/api/core";
import {ProcessCommands} from "@/commands/ProcessCommands.ts";

// Store 状态接口
export interface AntigravityProcessState {
  processing: boolean;
}

// Store 操作接口
export interface AntigravityProcessActions {
  run: () => Promise<void>;
}

// 创建 Zustand Store
export const useAntigravityProcessStore = create<AntigravityProcessState & AntigravityProcessActions>()(
  (set, get) => ({
    // 初始状态
    processing: false,

    // 备份并重启 Antigravity（登录新账户）
    run: async () => {
      // 如果已经在执行中，则防止重复执行
      if (get().processing) {
        logger.warn('操作已在进行中，忽略重复调用', {
          module: 'AntigravityProcessStore',
          action: 'duplicate_call_prevented'
        });
        return;
      }

      logger.info('用户确认登录新账户操作', {
        module: 'AntigravityProcessStore',
        action: 'login_new_account_start'
      });

      try {
        set({ processing: true });
        toast.loading('正在备份当前用户并注销...');

        logger.info('开始执行备份并重启 Antigravity 流程', {
          module: 'AntigravityService',
          action: 'backup_and_restart_start'
        });
        toast('正在关闭 Antigravity 进程...');

        logger.info('调用后端 backup_and_restart_antigravity 命令', {
          module: 'AntigravityService',
          action: 'call_backend_command'
        });
        const result = await ProcessCommands.backupAndRestart();
        logger.info('后端命令执行成功', {
          module: 'AntigravityService',
          action: 'backend_command_success',
          result: result
        });

        toast.success(result);
      } catch (error) {
        logger.error('登录新账户操作失败', {
          module: 'AntigravityProcessStore',
          action: 'operation_failed',
          error: error instanceof Error ? error.message : String(error)
        });
        const errorMessage = error instanceof Error ? error.message : String(error);
        toast.error(errorMessage);
      } finally {
        set({ processing: false });
        logger.debug('操作流程结束，重置加载状态', {
          module: 'AntigravityProcessStore',
          action: 'reset_loading_state'
        });
      }
    },
  })
);

// Hook 接口定义（保持向后兼容）
interface UseAntigravityProcessResult {
  isProcessLoading: boolean;
  backupAndRestartAntigravity: () => Promise<void>;
}

/**
 * Antigravity 进程管理 Hook
 * 使用 Zustand 管理登录新账户（备份并重启）操作
 */
export function useAntigravityProcess(): UseAntigravityProcessResult {
  const { processing, run } = useAntigravityProcessStore();

  return {
    isProcessLoading: processing,
    backupAndRestartAntigravity: run
  };
}

// 默认导出
export default useAntigravityProcess;
