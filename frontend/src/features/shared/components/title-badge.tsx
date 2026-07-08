/**
 * 朝堂 OS · 浏览器 title 徽章
 *
 * 把"陛下待御批"数量推到 document.title 前缀。
 * 用户切 tab 做别的事时，标签页徽章会把他拉回来 —— Slack 30% 再打开率的密码。
 *
 * 设计约束：
 *   - 不缓存原 title · 每次从 document.title 读现值、剥前缀、再叠加
 *   - 这样 Next.js 按路由改 title 时，徽章不会残留旧路由的标题
 */

'use client';

import { useEffect } from 'react';
import { useAppStore } from '@/lib/store/app-store';

/** 任何形如 "(3) " 或 "● (3) " 的徽章前缀 */
const BADGE_PREFIX = /^(?:● )?(?:\(\d+\) )?/;

function applyBadge(count: number, hidden: boolean) {
  if (typeof document === 'undefined') return;
  const clean = document.title.replace(BADGE_PREFIX, '');
  if (count <= 0) {
    document.title = clean;
    return;
  }
  const prefix = hidden ? `● (${count}) ` : `(${count}) `;
  document.title = prefix + clean;
}

export function TitleBadge() {
  const tasks = useAppStore((s) => s.tasks);
  const pendingCount = tasks.filter((t) => t.status === 'report_ready').length;

  useEffect(() => {
    if (typeof document === 'undefined') return;
    applyBadge(pendingCount, document.hidden);

    const onVis = () => applyBadge(pendingCount, document.hidden);
    document.addEventListener('visibilitychange', onVis);

    // 监听 title 变化（Next.js 切路由会改）· 重新贴徽章
    const observer = new MutationObserver(() => {
      // 避免自己改 title 又触发自己：只在当前 title 不含徽章前缀时才重新应用
      if (!BADGE_PREFIX.test(document.title) && pendingCount > 0) {
        applyBadge(pendingCount, document.hidden);
      }
    });
    const titleEl = document.querySelector('title');
    if (titleEl) observer.observe(titleEl, { childList: true });

    return () => {
      document.removeEventListener('visibilitychange', onVis);
      observer.disconnect();
      // 清除徽章前缀让下一页保持干净
      document.title = document.title.replace(BADGE_PREFIX, '');
    };
  }, [pendingCount]);

  return null;
}
