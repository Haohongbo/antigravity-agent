/**
 * 配置管理 Store (完全集成版)
 * 直接使用 Zustand，集成所有配置管理逻辑，提供完整接口
 */

import {create} from 'zustand';
import {open, save} from '@tauri-apps/plugin-dialog';
import {readFile} from '@tauri-apps/plugin-fs';
import {invoke} from '@tauri-apps/api/core';
import {logger} from '@/utils/logger.ts';
import toast from 'react-hot-toast';
import {BackupCommands} from "@/commands/BackupCommands.ts";
import {BackupData} from "@/commands/types/backup.types.ts";
import {LoggingCommands} from "@/commands/LoggingCommands.ts";

interface EncryptedConfigData {
  version: string;
  backupCount: number;
  backups: BackupData[];
}

export interface PasswordDialogConfig {
  title: string;
  description?: string;
  requireConfirmation?: boolean;
  onSubmit: (password: string) => void;
  validatePassword?: (password: string) => { isValid: boolean; message?: string };
}

// Store 状态
interface ConfigState {
  isImporting: boolean;
  isExporting: boolean;
  // hasUserData 移除了，现在由 user-management store 管理
  isCheckingData: boolean;
}

// Store 操作
interface ConfigActions {
  setImporting: (isImporting: boolean) => void;
  setExporting: (isExporting: boolean) => void;
  // setHasUserData 和 checkUserData 移除了，现在由 user-management store 管理
  setCheckingData: (isCheckingData: boolean) => void;
  importConfig: (
    showPasswordDialog: (config: PasswordDialogConfig) => void,
    closePasswordDialog: () => void
  ) => Promise<void>;
  exportConfig: (
    showPasswordDialog: (config: PasswordDialogConfig) => void,
    closePasswordDialog: () => void
  ) => Promise<void>;
}

// 创建 Zustand Store
export const useImportExportAccount = create<ConfigState & ConfigActions>()(
  (set, get) => ({
    // 初始状态
    isImporting: false,
    isExporting: false,
    // hasUserData 移除了，现在由 user-management store 管理
    isCheckingData: false,

    // 状态设置方法
    setImporting: (isImporting: boolean) => set({ isImporting }),
    setExporting: (isExporting: boolean) => set({ isExporting }),
    setCheckingData: (isCheckingData: boolean) => set({ isCheckingData }),

    // setHasUserData 和 checkUserData 移除了，现在由 user-management store 管理

    // ============ 导入配置 ============
    importConfig: async (
      showPasswordDialog: (config: PasswordDialogConfig) => void,
      closePasswordDialog: () => void
    ): Promise<void> => {
      logger.info('开始导入配置文件', { module: 'useImportExportAccount' });

      try {
        // 选择文件
        const selected = await open({
          title: '选择配置文件',
          filters: [
            {
              name: '加密配置文件',
              extensions: ['enc']
            },
            {
              name: '所有文件',
              extensions: ['*']
            }
          ],
          multiple: false
        });

        if (!selected || typeof selected !== 'string') {
          logger.warn('未选择文件', {
            module: 'useImportExportAccount'
          });
          toast.error('未选择文件');
          return;
        }

        logger.info('已选择文件', {
          module: 'useImportExportAccount',
          filePath: selected
        });

        // 读取文件内容
        const fileContentUint8Array = await readFile(selected);
        const fileContent = new TextDecoder().decode(fileContentUint8Array);

        if (fileContent.length === 0) {
          logger.warn('文件内容为空', {
            module: 'useImportExportAccount'
          });
          toast.error('文件内容为空');
          return;
        }

        // 使用密码对话框获取密码
        showPasswordDialog({
          title: '导入配置文件',
          description: '请输入配置文件的解密密码',
          requireConfirmation: false,
          validatePassword: (password: string) => {
            if (password.length < 4) return { isValid: false, message: '密码长度至少为4位' };
            if (password.length > 50) return { isValid: false, message: '密码长度不能超过50位' };
            return { isValid: true };
          },
          onSubmit: async (password) => {
            try {
              closePasswordDialog();
              set({ isImporting: true });
              toast.loading('正在解密配置文件...', {duration: 1});

              // 解密配置数据 - 使用后端解密
              const decryptedJson: string = await invoke('decrypt_config_data', {
                encryptedData: fileContent,
                password
              });
              const configData: EncryptedConfigData = JSON.parse(decryptedJson);

              // 验证配置数据格式
              if (!configData.version || !configData.backups || !Array.isArray(configData.backups)) {
                throw new Error('配置文件格式无效');
              }

              logger.info('开始恢复备份数据', {
                module: 'useImportExportAccount',
                backupCount: configData.backups.length
              });
              toast.loading('正在恢复账户数据...', {duration: 1});

              const result = await BackupCommands.restoreFiles(configData.backups);

              if (result.failed.length > 0) {
                logger.warn('部分文件恢复失败', {
                  module: 'useImportExportAccount',
                  restoredCount: result.restoredCount,
                  failedCount: result.failed.length,
                  failedFiles: result.failed
                });
                toast.success(`配置文件导入成功，已恢复 ${result.restoredCount} 个账户，${result.failed.length} 个失败`);
              } else {
                logger.info('所有文件恢复成功', {
                  module: 'useImportExportAccount',
                  restoredCount: result.restoredCount
                });
                toast.success(`配置文件导入成功，已恢复 ${result.restoredCount} 个账户`);
              }
debugger
            } catch (error) {
              logger.error('解密失败', {
                module: 'useImportExportAccount',
                stage: 'import_password_validation',
                error: error instanceof Error ? error.message : String(error)
              });
              toast.error(`配置文件解密失败: ${error instanceof Error ? error.message : String(error)}`);
            } finally {
              set({ isImporting: false });
            }
          }
        });

      } catch (error) {
        logger.error('文件操作失败', {
          module: 'useImportExportAccount',
          stage: 'file_operation',
          error: error instanceof Error ? error.message : String(error)
        });
        toast.error(`文件操作失败: ${error instanceof Error ? error.message : String(error)}`);
      }
    },

    // ============ 导出配置 ============
    exportConfig: async (
      showPasswordDialog: (config: PasswordDialogConfig) => void,
      closePasswordDialog: () => void
    ): Promise<void> => {
      logger.info('开始导出配置', { module: 'useImportExportAccount' });

      try {
        toast.loading('正在收集账户数据...');

        // ✅ 获取包含完整内容的备份数据
        const backupsWithContent = await invoke<BackupData[]>('collect_backup_contents');

        if (backupsWithContent.length === 0) {
          logger.warn('没有找到用户信息', {
            module: 'useImportExportAccount'
          });
          toast.error('没有找到任何用户信息，无法导出配置文件');
          return;
        }

        logger.info('找到备份数据', {
          module: 'useImportExportAccount',
          backupCount: backupsWithContent.length
        });

        // 使用密码对话框获取密码
        showPasswordDialog({
          title: '导出配置文件',
          description: '请设置导出密码，用于保护您的配置文件',
          requireConfirmation: true,
          validatePassword: (password: string) => {
            if (password.length < 4) return { isValid: false, message: '密码长度至少为4位' };
            if (password.length > 50) return { isValid: false, message: '密码长度不能超过50位' };
            return { isValid: true };
          },
          onSubmit: async (password) => {
            try {
              closePasswordDialog();
              set({ isExporting: true });
              toast.loading('正在生成加密配置文件...');

              // ✅ 构建配置数据（包含完整内容）
              const configData: EncryptedConfigData = {
                version: '1.1.0',
                backupCount: backupsWithContent.length,
                backups: backupsWithContent
              };

              // ✅ 调用后端加密命令（包含 JSON 序列化 + XOR 加密 + Base64 编码）
              const configJson = JSON.stringify(configData, null, 2);
              const configSize = new Blob([configJson]).size;

              logger.info('配置数据已生成', {
                module: 'useImportExportAccount',
                backupCount: backupsWithContent.length,
                configSize
              });

              const encryptedData = await invoke<string>('encrypt_config_data', {
                jsonData: configJson,
                password
              });

              // 选择保存位置
              const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
              const defaultFileName = `antigravity_encrypted_config_${timestamp}.enc`;

              const savePath = await save({
                title: '保存配置文件',
                defaultPath: defaultFileName,
                filters: [
                  {
                    name: 'Antigravity 加密配置文件',
                    extensions: ['enc']
                  }
                ]
              });

              if (!savePath || typeof savePath !== 'string') {
                logger.warn('未选择保存位置', {
                  module: 'useImportExportAccount'
                });
                toast.error('未选择保存位置');
                return;
              }

              // 保存加密文件
              await LoggingCommands.writeTextFile(savePath, encryptedData);

              toast.success(`配置文件已保存: ${savePath}`);
              logger.info('导出配置成功', {
                module: 'useImportExportAccount',
                savePath,
                backupCount: backupsWithContent.length,
                configSize
              });

            } catch (error) {
              logger.error('导出失败', {
                module: 'useImportExportAccount',
                stage: 'password_validation',
                error: error instanceof Error ? error.message : String(error)
              });
              toast.error(`导出配置文件失败: ${error instanceof Error ? error.message : String(error)}`);
            } finally {
              set({ isExporting: false });
            }
          }
        });

      } catch (error) {
        logger.error('检查数据失败', {
          module: 'useImportExportAccount',
          stage: 'data_collection',
          error: error instanceof Error ? error.message : String(error)
        });
        toast.error(`检查数据失败: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  })
);
