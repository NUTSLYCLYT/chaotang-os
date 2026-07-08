/**
 * 朝堂 OS V2 · 史馆 · 共享区块标签
 *
 * 解决 F4：之前各文件用 div 伪装区块标题，破坏屏幕阅读器导航。
 * 此组件支持 `as` prop，默认 h3，子区可降级为 h4，
 * 视觉样式（小号、大写、灰色）保持不变。
 *
 * 同时承担"区块标题视觉锚点"的单一事实源——以后改区块标签字体/颜色
 * 只需改这一处。
 */

import type { ReactNode, HTMLAttributes } from 'react';

type HeadingTag = 'h2' | 'h3' | 'h4';

export interface SectionLabelProps {
  /** 语义层级，默认 h3（区块标题）；子区块用 h4 */
  as?: HeadingTag;
  /** 左侧 icon（lucide 等） */
  icon?: ReactNode;
  /** 标签内容（中英混排或纯英文） */
  children: ReactNode;
  /** 右侧附加内容（如计数、状态徽章） */
  trailing?: ReactNode;
  /** 容器附加 className */
  className?: string;
}

export function SectionLabel({
  as = 'h3',
  icon,
  children,
  trailing,
  className = '',
}: SectionLabelProps) {
  const Tag = as as keyof Pick<HTMLElementTagNameMap, HeadingTag>;
  // 视觉样式与原 div 完全一致，只是用真正的 heading 标签承载语义
  const headingProps: HTMLAttributes<HTMLHeadingElement> = {
    className: 'text-[11px] uppercase tracking-wider text-[#6A7299] font-normal m-0',
  };
  return (
    <div className={`mb-3 flex items-center gap-2 ${className}`.trim()}>
      {icon}
      <Tag {...headingProps}>{children}</Tag>
      {trailing && <div className="ml-auto">{trailing}</div>}
    </div>
  );
}
