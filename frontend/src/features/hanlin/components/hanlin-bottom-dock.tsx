/**
 * 朝堂 OS · 翰林院 · HanlinBottomDock
 *
 * 翰林院专属 BottomDock，接 /api/orchestration/run SSE 流水线。
 * 用户发令 → POST body.command → SSE 推流 → 解析各阶段事件 → 展示最终回应（含 citations）。
 *
 * 状态机：idle → streaming → done/error
 * citations 从 zhongshu_done 事件提取，展示在消息气泡下方。
 */

'use client';

import { useState, useCallback } from 'react';
import { BottomDock, DOCK_BOTTOM_PADDING } from '@/features/shared/components/bottom-dock';
import type { DockMessage } from '@/features/shared/components/bottom-dock';
import type { HanlinOrchestrationEvent } from '@/lib/contracts/hanlin';

// 翰林院主色：帝金
const HANLIN_ACCENT = '#F0C66A';

// 纪晓岚 Avatar
const TaiziAvatar = (
  <span style={{ fontSize: 20, lineHeight: 1 }}>👑</span>
);

const QUICK_PROMPTS = [
  '本期贡献榜摘要',
  '升级候选评估',
  '哪些模块可以出海',
  '最新贡献入馆分析',
  '开榜建议',
];

function formatTime(date: Date): string {
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

interface HanlinBottomDockProps {
  /** 跳过显示 BottomDock 的底部填充（由父级负责）*/
  noPadding?: boolean;
}

export function HanlinBottomDock({ noPadding }: HanlinBottomDockProps) {
  const [messages, setMessages] = useState<DockMessage[]>([
    {
      role: 'agent',
      text: '纪晓岚在此。请陛下问翰林院相关事宜：贡献金库、升级候选、修典进度或出海商品。',
      time: formatTime(new Date()),
    },
  ]);
  const [streaming, setStreaming] = useState(false);
  const [focusContent, setFocusContent] = useState<string>('');

  const handleSend = useCallback(async (text: string) => {
    if (streaming) return;

    // 1. 立刻显示用户消息
    const userMsg: DockMessage = { role: 'user', text, time: formatTime(new Date()) };
    setMessages((prev) => [...prev, userMsg]);
    setStreaming(true);
    setFocusContent('纪晓岚正在审议...');

    // 2. 构建翰林院上下文前缀
    const command = `[翰林院] ${text}`;

    // 3. 调 /api/orchestration/run SSE
    try {
      const response = await fetch('/api/orchestration/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`orchestration_failed: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let agentReply = '';
      let citations: Array<{ title: string; url?: string; snippet: string }> = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const rawData = line.slice(6).trim();
            if (!rawData) continue;
            try {
              const event = JSON.parse(rawData) as HanlinOrchestrationEvent;
              handleEvent(event);
            } catch {
              // ignore malformed lines
            }
          }
        }
      }

      function handleEvent(event: HanlinOrchestrationEvent) {
        switch (event.type) {
          case 'stage_start':
            setFocusContent(`阶段 ${event.stage} 正在进行...`);
            break;

          case 'retrieve_done':
            setFocusContent(
              `检索完成 · Tavily ${event.tavilyCitations} 条情报 · 史馆旧案 ${event.precedents} 条`,
            );
            break;

          case 'zhongshu_done': {
            agentReply = event.draft.draft;
            citations = (event.draft.citations ?? []) as typeof citations;
            setFocusContent(`中书省起草完成（第 ${event.rounds} 轮）`);
            break;
          }

          case 'menxia_done':
            setFocusContent(
              `门下省审议：${event.review.verdict === '准' ? '准奏' : event.review.verdict === '驳' ? '驳议' : '再议'}`,
            );
            break;

          case 'eof': {
            // 流结束：添加 agent 消息
            const citationSuffix =
              citations.length > 0
                ? `\n\n**引用来源**：${citations
                    .slice(0, 3)
                    .map((c, i) => `[${i + 1}] ${c.title}${c.url ? ` (${c.url})` : ''}`)
                    .join('；')}`
                : '';

            const replyText = agentReply
              ? `${agentReply}${citationSuffix}`
              : '三省审议完成，当前命令已入史馆。';

            setMessages((prev) => [
              ...prev,
              {
                role: 'agent',
                text: replyText,
                time: formatTime(new Date()),
              },
            ]);
            setFocusContent(
              citations.length > 0
                ? `审议完成 · ${citations.length} 条引用来源`
                : '审议完成',
            );
            setStreaming(false);
            break;
          }

          case 'error':
            setMessages((prev) => [
              ...prev,
              {
                role: 'agent',
                text: `审议出现异常：${event.message}`,
                time: formatTime(new Date()),
              },
            ]);
            setFocusContent('审议异常，请稍后重试');
            setStreaming(false);
            break;
        }
      }
    } catch (err) {
      const errText = err instanceof Error ? err.message : '未知错误';
      setMessages((prev) => [
        ...prev,
        {
          role: 'agent',
          text: `连接失败：${errText}。请检查网络后重试。`,
          time: formatTime(new Date()),
        },
      ]);
      setFocusContent('连接失败');
      setStreaming(false);
    }
  }, [streaming]);

  const focusPanel = (
    <div className="space-y-2 p-2">
      <div className="text-[11px] uppercase tracking-[0.16em] text-[#8F835F]">三省审议台 · 焦点</div>
      <div className="text-[12px] leading-6 text-[#D7CCA9]">{focusContent || '等待发令...'}</div>
      {streaming ? (
        <div className="mt-2 flex items-center gap-2">
          <div
            className="h-2 w-2 rounded-full animate-pulse"
            style={{ background: HANLIN_ACCENT }}
          />
          <span className="text-[11px] text-[#8F835F]">三省审议中...</span>
        </div>
      ) : null}
    </div>
  );

  return (
    <>
      {!noPadding && <div className={DOCK_BOTTOM_PADDING} />}
      <BottomDock
        title="Hanlin Academy · 翰林院"
        name="纪晓岚"
        accent={HANLIN_ACCENT}
        avatar={TaiziAvatar}
        quickPrompts={QUICK_PROMPTS}
        messages={messages}
        focusPanel={focusPanel}
        placeholder="请陛下问翰林院相关事宜..."
        sendLabel={streaming ? '审议中' : '发令'}
        collapsedTeaser={streaming ? '三省审议中，请稍候...' : undefined}
        onSend={(text) => void handleSend(text)}
      />
    </>
  );
}
