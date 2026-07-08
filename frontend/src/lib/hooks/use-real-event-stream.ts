/**
 * useRealEventStream —— Real 模式下订阅 V1 SSE 事件流
 *
 * 每收到一条事件就拉取该 task 的最新完整状态并灌入 store
 * 让 /overview 和 /command-center 能实时响应真实后端
 */

'use client';

import { useEffect, useRef } from 'react';
import { subscribeToEventStream } from '@/lib/api/sse';
import { API_MODE } from '@/lib/api/client';
import { chaotang } from '@/lib/api/chaotang';
import { useAppStore } from '@/lib/store/app-store';

export function useRealEventStream(enabled = true) {
  const refetchInFlight = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled) return;
    if (API_MODE === 'mock') return;

    const sub = subscribeToEventStream(
      async (event) => {
        // 防抖：同一 task 并发拉取合并
        if (refetchInFlight.current.has(event.taskId)) return;
        refetchInFlight.current.add(event.taskId);

        try {
          // chaotang.taskDetail → /api/court/chaotang/tasks/:id (BFF → jiqun_ai :8081)
          const detail = await chaotang.taskDetail(event.taskId);
          const store = useAppStore.getState();
          const taskId = (detail as { id?: string }).id ?? event.taskId;

          // 升级 store.tasks（适配 chaotang taskDetail 为 Record<string,unknown>）
          const existing = store.tasks.find((t) => t.id === taskId);
          if (existing) {
            store.updateTask(taskId, detail as unknown as Parameters<typeof store.updateTask>[1]);
          } else {
            store.addTask(detail as unknown as Parameters<typeof store.addTask>[0]);
          }

          // 如果当前没有选中任务，就选中这个
          if (!store.currentTaskId) {
            store.selectTask(taskId);
          }
        } catch (err) {
          // 静默失败，下一条事件会再次尝试
          console.warn('[sse] fetch task failed:', err);
        } finally {
          refetchInFlight.current.delete(event.taskId);
        }
      },
      {
        onOpen: () => console.log('[sse] connected to V1 event stream'),
        onError: (e) => console.warn('[sse] error (will auto-reconnect):', e),
      },
    );

    return () => sub.close();
  }, [enabled]);
}
