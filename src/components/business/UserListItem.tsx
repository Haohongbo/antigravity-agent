import React from "react";
import {AntigravityAccount} from "@/commands/types/account.types.ts";
import {BaseTooltip} from "@/components/base-ui/BaseTooltip.tsx";
import BusinessActionButton from "@/components/business/ActionButton.tsx";
import {BaseButton} from "@/components/base-ui/BaseButton.tsx";
import {Check, Trash2} from "lucide-react";
import {maskBackupFilename} from "@/utils/username-masking.ts";
import {cn} from "@/utils/utils.ts";

interface UserListItemProps {
  user: AntigravityAccount;
  isCurrent: boolean;
  onSelect: (user: AntigravityAccount) => void;
  onSwitch: (email: string) => void;
  onDelete: (email: string) => void;
}

export const UserListItem: React.FC<UserListItemProps> = ({
                                                            user,
                                                            isCurrent,
                                                            onSelect,
                                                            onSwitch,
                                                            onDelete,
                                                          }) => {
  const getAvatarUrl = (base64Url: string) => {
    try {
      if (base64Url.startsWith('http') || base64Url.startsWith('data:')) {
        return base64Url;
      }
      return atob(base64Url);
    } catch (error) {
      return '';
    }
  };

  const avatarUrl = getAvatarUrl(user.profile_url);

  return (
    <div
      className={cn(
        "relative cursor-pointer group flex items-center p-3 rounded-xl transition-all duration-300 border mb-2 last:mb-0",
        isCurrent
          ? "bg-blue-50/80 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 shadow-sm"
          : "bg-white dark:bg-gray-800/50 border-transparent hover:border-gray-200 dark:hover:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
      )}
      onClick={() => onSelect(user)}
    >

      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="relative">
          <img
            src={avatarUrl}
            alt={user.name}
            className={cn(
              "h-10 w-10 rounded-full object-cover border-2 transition-colors flex-shrink-0",
              isCurrent
                ? "border-blue-400 dark:border-blue-500"
                : "border-gray-200 dark:border-gray-700 group-hover:border-blue-300 dark:group-hover:border-blue-600"
            )}
          />
          {isCurrent && (
            <div
              className="absolute -bottom-0.5 -right-0.5 bg-blue-500 rounded-full p-0.5 border-2 border-white dark:border-gray-900">
              <Check className="h-2 w-2 text-white" strokeWidth={3}/>
            </div>
          )}
        </div>

        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2">
                        <span className={cn(
                          "font-medium truncate transition-colors text-sm",
                          isCurrent ? "text-blue-700 dark:text-blue-300" : "text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400"
                        )}>
                            {user.name || "Unknown User"}
                        </span>
            {isCurrent && (
              <span
                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                当前
                            </span>
            )}
          </div>
          <BaseTooltip content={user.email} side="bottom">
                        <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {maskBackupFilename(user.email)}
                        </span>
          </BaseTooltip>
        </div>
      </div>

      <div className="flex gap-2 flex-shrink-0 items-center ml-2">
        {!isCurrent && (
          <BaseTooltip content="切换到此用户" side="bottom">
            <div onClick={(e) => e.stopPropagation()}>
              <BusinessActionButton
                variant="secondary"
                size="sm"
                className="h-7 px-3 text-xs"
                onClick={() => onSwitch(user.email)}
                loadingText="..."
              >
                切换
              </BusinessActionButton>
            </div>
          </BaseTooltip>
        )}

        <div onClick={(e) => e.stopPropagation()}>
          {!isCurrent && <BaseButton
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
            onClick={() => onDelete(user.email)}
          >
            <Trash2 className="h-3.5 w-3.5"/>
          </BaseButton>
          }
        </div>
      </div>
    </div>
  );
};
