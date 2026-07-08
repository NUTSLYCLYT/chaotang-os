/**
 * DemoDataBanner — 标记"下方为演示/兜底数据"的橙色横条
 *
 * 两种用法：
 *
 * 1) 静态模式（向后兼容）：`<DemoDataBanner note="..." />`
 *    永远显示。用于已知是 mock 静态展示、但还没接 safeReal 运行时信号的页面
 *    （如 /scribe 的 12 卷案例）。
 *
 * 2) 运行时模式（DATA-TRUTH-01）：`<DemoDataBanner domain="forecast" />`
 *    接入 src/lib/api/client.ts 的 safeReal 降级登记表：
 *    - 该域真实后端正常 → 横条自动隐藏（不再误报"演示模式"）
 *    - 该域回退 mock     → 显示横条 + 真实失败原因
 *    这让"真假"从藏在 console 的 warn 变成用户可见的诚实提示。真就是真，假要标假。
 */
'use client';

import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { getMockFallbackState, isDomainOnMock, type MockFallbackRecord } from '@/lib/api/client';

/** 轮询间隔：与多数页面 SWR 刷新节奏一致，开销极小（只读内存 Map）。 */
const POLL_MS = 3000;

interface DemoDataBannerProps {
  /** 附加说明文字。 */
  note?: string;
  /**
   * 领域标识（tasks/agents/intel/health/forecast/reports/departments）。
   * 传入后切换为运行时模式：仅当该域正在吃 mock 兜底时才显示。
   * 不传则为静态模式，永远显示。
   */
  domain?: string;
}

export function DemoDataBanner({ note, domain }: DemoDataBannerProps) {
  // 运行时模式下追踪该域是否在降级；静态模式恒为 true。
  const [record, setRecord] = useState<MockFallbackRecord | null>(null);
  const [onMock, setOnMock] = useState<boolean>(domain === undefined);

  useEffect(() => {
    if (domain === undefined) return; // 静态模式不轮询
    const check = () => {
      const active = isDomainOnMock(domain);
      setOnMock(active);
      setRecord(active ? getMockFallbackState().find((r) => r.domain === domain) ?? null : null);
    };
    check();
    const t = setInterval(check, POLL_MS);
    return () => clearInterval(t);
  }, [domain]);

  // 运行时模式且该域走真实数据 → 不渲染（诚实地"消失"）。
  if (!onMock) return null;

  return (
    <div
      className="mx-auto mb-4 flex max-w-[1280px] items-start gap-3 rounded-lg border px-4 py-2.5"
      style={{
        borderColor: 'rgba(245,165,36,0.4)',
        background: 'rgba(245,165,36,0.08)',
        color: '#F5A524',
      }}
      role="status"
      aria-label="演示数据提示"
    >
      <Sparkles size={14} className="shrink-0 mt-0.5" />
      <div className="text-[12px] leading-6" style={{ color: '#F5A524' }}>
        <strong>{domain ? '兜底数据' : '演示模式'}</strong>
        <span className="ml-2" style={{ color: '#C8CDD8' }}>
          {domain
            ? `「${domain}」域真实后端暂不可用，下方为本地示例数据。后端恢复后自动切回真实数据。`
            : '下方部分数字为示例展示，便于直观感受界面。真实租户数据接入后会替换。'}
          {note ? ` ${note}` : ''}
        </span>
        {record ? (
          <span className="ml-2 opacity-70" style={{ color: '#8f835f' }}>
            （原因：{record.reason}）
          </span>
        ) : null}
      </div>
    </div>
  );
}
