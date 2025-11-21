import React from 'react';
import { Download, RotateCw, Sparkles } from 'lucide-react';
import { UpdateState, DownloadProgress } from '../services/updateService';

interface UpdateBadgeProps {
    state: UpdateState;
    progress?: DownloadProgress | null;
    onClick?: () => void;
    className?: string;
}

const UpdateBadge: React.FC<UpdateBadgeProps> = ({
    state,
    progress,
    onClick,
    className = ''
}) => {
    if (state === 'no-update') {
        return null;
    }

    const renderBadgeContent = () => {
        switch (state) {
            case 'update-available':
                return (
                    <div
                        className="relative group cursor-pointer"
                        onClick={onClick}
                        title="有可用更新"
                    >
                        {/* 脉冲动画的外圈 */}
                        <span className="absolute inset-0 rounded-full bg-blue-500 animate-ping opacity-75"></span>

                        {/* 主图标 */}
                        <div className="relative flex items-center justify-center w-6 h-6 bg-blue-500 rounded-full group-hover:bg-blue-600 transition-colors">
                            <Sparkles className="w-3.5 h-3.5 text-white" />
                        </div>
                    </div>
                );

            case 'downloading':
                const percentage = progress?.percentage || 0;
                return (
                    <div
                        className="relative cursor-pointer"
                        onClick={onClick}
                        title={`下载中: ${percentage}%`}
                    >
                        {/* 外圈进度环 */}
                        <svg className="w-6 h-6 transform -rotate-90">
                            {/* 背景圆 */}
                            <circle
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="2"
                                fill="none"
                                className="text-gray-300 dark:text-gray-600"
                            />
                            {/* 进度圆 */}
                            <circle
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="2"
                                fill="none"
                                strokeDasharray={`${2 * Math.PI * 10}`}
                                strokeDashoffset={`${2 * Math.PI * 10 * (1 - percentage / 100)}`}
                                className="text-blue-500 transition-all duration-300"
                                strokeLinecap="round"
                            />
                        </svg>

                        {/* 中心图标 */}
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Download className="w-3 h-3 text-blue-500" />
                        </div>

                        {/* 百分比文本（可选） */}
                        <div className="absolute -bottom-5 left-1/2 transform -translate-x-1/2 text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
                            {percentage}%
                        </div>
                    </div>
                );

            case 'ready-to-install':
                return (
                    <div
                        className="relative group cursor-pointer"
                        onClick={onClick}
                        title="点击重启并更新"
                    >
                        {/* 动画效果 */}
                        <div className="absolute inset-0 rounded-full bg-green-500 opacity-50 animate-pulse"></div>

                        {/* 主图标 */}
                        <div className="relative flex items-center justify-center w-6 h-6 bg-green-500 rounded-full group-hover:bg-green-600 transition-colors">
                            <RotateCw className="w-3.5 h-3.5 text-white animate-spin-slow" />
                        </div>
                    </div>
                );

            case 'error':
                return (
                    <div
                        className="relative group cursor-pointer"
                        onClick={onClick}
                        title="更新失败，点击重试"
                    >
                        <div className="flex items-center justify-center w-6 h-6 bg-red-500 rounded-full group-hover:bg-red-600 transition-colors">
                            <span className="text-white text-xs font-bold">!</span>
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <div className={`absolute -top-1 -right-8 ${className}`}>
            {renderBadgeContent()}
        </div>
    );
};

export default UpdateBadge;
