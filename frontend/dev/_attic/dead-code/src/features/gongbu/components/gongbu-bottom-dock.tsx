'use client';

/**
 * 工部 · 底部 BottomDock
 *
 * 继承 BottomDock 基础组件，onSend → POST /api/court/gongbu/ask（SSE 流式）。
 * 提供研发/交付/架构相关快选问题。
 */

import { BottomDock } from '@/features/shared/components/bottom-dock';
import { useAgentChat } from '@/features/swarm/lib/use-agent-chat';

const GONGBU_ACCENT = '#7fc9a8';

const QUICK_PROMPTS = [
  '新能源报价MVP技术方案给出12周排期，标出必须裁断的依赖。',
  '当前阻塞依赖有哪些？谁该裁断？',
  'PRD完备度84%，差在哪几项？怎么补？',
  '供应商API SLA不足，降级通道方案是什么？',
  '测试环境容量偏低，扩容方案和预算预估？',
  '旧系统迁移双写14天回滚预案审一下。',
];

/** 工部神将 SVG 头像（简版·戚继光） */
function GongbuAvatar() {
  return (
    <svg viewBox="0 0 36 36" width={28} height={28} fill="none" aria-hidden>
      <circle cx={18} cy={12} r={7} fill="#7fc9a8" opacity={0.85} />
      <path d="M6 34c0-7 5-11 12-11s12 4 12 11" stroke="#7fc9a8" strokeWidth={2} strokeLinecap="round" fill="none" opacity={0.7} />
      <path d="M12 7 C12 2, 24 2, 24 7" stroke="#5ab89a" strokeWidth={1.5} fill="none" opacity={0.6} />
      <rect x={14} y={18} width={8} height={2} rx={1} fill="#7fc9a8" opacity={0.5} />
    </svg>
  );
}

export function GongbuBottomDock() {
  const { messages, handleSend } = useAgentChat({
    endpoint: '/api/court/dept/works/ask', // 工部=works(已注册单 agent)；原 /gongbu/ask 不存在→404 装死，已修
    greeting:
      '臣工部尚书恭请陛下示下。研发排期/架构评审/接口契约/交付门禁已就绪——请下旨，臣即出方案并标出必须裁断的依赖。',
    accent: GONGBU_ACCENT,
  });

  return (
    <BottomDock
      title="Ministry of Works · 工部"
      name="工部 · 戚继光"
      accent={GONGBU_ACCENT}
      avatar={<GongbuAvatar />}
      quickPrompts={QUICK_PROMPTS}
      messages={messages}
      placeholder="请陛下下旨，臣即刻开工..."
      sendLabel="下旨"
      onSend={handleSend}
    />
  );
}
