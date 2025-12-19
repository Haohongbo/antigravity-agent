"use client";
import React, { useState } from "react";
import {
  motion,
  useTransform,
  AnimatePresence,
  useMotionValue,
  useSpring,
} from "motion/react";

interface AnimatedTooltipProps {
  children: React.ReactNode;
  text: string; // 简化为只传一个文本
  className?: string; // 允许外部微调 Trigger 的样式
}

export const AnimatedTooltip = ({
                                  children,
                                  text,
                                  className,
                                }: AnimatedTooltipProps) => {
  const [isHovered, setIsHovered] = useState(false);

  // ==============================
  // 核心动效配置 (全部默认封装)
  // ==============================
  const springConfig = { stiffness: 100, damping: 5 };
  const x = useMotionValue(0);

  // 旋转：鼠标偏左向左歪，偏右向右歪
  const rotate = useSpring(
    useTransform(x, [-100, 100], [-45, 45]),
    springConfig
  );

  // 位移：跟随鼠标有轻微的视差移动
  const translateX = useSpring(
    useTransform(x, [-100, 100], [-50, 50]),
    springConfig
  );

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const halfWidth = event.currentTarget.offsetWidth / 2;
    // 计算鼠标相对于元素中心的偏移量
    x.set(event.nativeEvent.offsetX - halfWidth);
  };

  return (
    <div
      className={`relative inline-block group ${className}`} // inline-block 保证包裹大小由 children 决定
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseMove={handleMouseMove}
    >
      <AnimatePresence mode="popLayout">
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.6 }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
              transition: {
                type: "spring",
                stiffness: 260,
                damping: 10,
              },
            }}
            exit={{ opacity: 0, y: 20, scale: 0.6 }}
            style={{
              translateX: translateX,
              rotate: rotate,
              whiteSpace: "nowrap",
            }}
            // Tooltip 样式：绝对定位在顶部
            className="absolute -top-16 left-1/2 -translate-x-1/2 flex text-xs flex-col items-center justify-center rounded-md bg-black/90 backdrop-blur-sm z-50 shadow-xl px-4 py-2"
          >
            {/* 装饰线条：增加 Antigravity 科技感 */}
            <div className="absolute inset-x-10 z-30 w-[20%] -bottom-px bg-gradient-to-r from-transparent via-emerald-500 to-transparent h-px " />
            <div className="absolute left-10 w-[40%] z-30 -bottom-px bg-gradient-to-r from-transparent via-sky-500 to-transparent h-px " />

            <div className="font-bold text-white relative z-30 text-sm">
              {text}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 触发体 */}
      {children}
    </div>
  );
};
