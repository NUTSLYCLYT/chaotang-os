'use client';

/**
 * MizhiPicker · 密旨派遣弹窗
 * 皇帝绕过三省，直接指定蜂群秘密执行一件事。
 */

const CRIMSON = '#C0392B';

const SWARM_LIST = [
  { id: 'intel',    label: '情报蜂群', desc: '信息收集 · 市场情报', icon: '🔍' },
  { id: 'legal',    label: '法律蜂群', desc: '合规 · 合同 · 风险',   icon: '⚖️' },
  { id: 'finance',  label: '财务蜂群', desc: '数据 · 测算 · 预测',   icon: '📊' },
  { id: 'market',   label: '市场蜂群', desc: '竞品 · 策略 · 文案',   icon: '📣' },
  { id: 'research', label: '研究蜂群', desc: '深度调研 · 知识沉淀',  icon: '🔬' },
  { id: 'exec',     label: '执行蜂群', desc: '任务拆解 · 流程执行',  icon: '⚡' },
] as const;

export interface MizhiPickerProps {
  open: boolean;
  onClose: () => void;
  command: string;
  onDispatch: (groupId: string, label: string) => void;
}

export function MizhiPicker({ open, onClose, command, onDispatch }: MizhiPickerProps) {
  if (!open) return null;

  function handleDispatch(id: string, label: string) {
    onDispatch(id, label);
    onClose();
  }

  return (
    /* 遮罩层 */
    <div
      role="dialog"
      aria-modal="true"
      aria-label="密旨 · 指定蜂群"
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ backdropFilter: 'blur(4px)', background: 'rgba(4,6,14,0.72)' }}
      onClick={onClose}
    >
      {/* 弹窗主体 */}
      <div
        className="relative w-[340px] max-w-[calc(100vw-32px)] rounded-2xl p-5"
        style={{
          background: 'rgba(4,6,14,0.96)',
          border: `1px solid rgba(192,57,43,0.4)`,
          boxShadow: '0 0 40px rgba(192,57,43,0.15), 0 8px 32px rgba(0,0,0,0.6)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 朱红顶线 */}
        <div
          className="absolute left-0 right-0 top-0 h-[2px] rounded-t-2xl"
          style={{ background: `linear-gradient(90deg, transparent, ${CRIMSON}80, transparent)` }}
          aria-hidden
        />

        {/* 标题区 */}
        <div className="mb-4">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-[9px] tracking-[0.28em]" style={{ color: `${CRIMSON}cc` }}>
              ◆ 密旨
            </span>
            <div className="h-px flex-1" style={{ background: `linear-gradient(90deg, ${CRIMSON}50, transparent)` }} aria-hidden />
          </div>
          <h2
            className="text-[15px] font-semibold"
            style={{ color: CRIMSON, fontFamily: 'var(--font-serif)' }}
          >
            密旨 · 指定蜂群
          </h2>
          {command && (
            <p
              className="mt-1.5 line-clamp-2 text-[11px] leading-relaxed"
              style={{ color: '#8F835F', fontFamily: 'var(--font-serif)' }}
            >
              {command.slice(0, 40)}{command.length > 40 ? '…' : ''}
            </p>
          )}
        </div>

        {/* 蜂群列表 */}
        <div className="space-y-1.5">
          {SWARM_LIST.map((sw) => (
            <button
              key={sw.id}
              type="button"
              onClick={() => handleDispatch(sw.id, sw.label)}
              className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all"
              style={{
                border: `1px solid rgba(192,57,43,0.2)`,
                background: 'rgba(192,57,43,0.04)',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.border = `1px solid rgba(192,57,43,0.5)`;
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(192,57,43,0.1)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.border = `1px solid rgba(192,57,43,0.2)`;
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(192,57,43,0.04)';
              }}
            >
              <span
                className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-lg text-[15px]"
                style={{ background: 'rgba(192,57,43,0.12)', border: '1px solid rgba(192,57,43,0.25)' }}
                aria-hidden
              >
                {sw.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className="block text-[12.5px]"
                  style={{ color: '#F5E9C9', fontFamily: 'var(--font-serif)' }}
                >
                  {sw.label}
                </span>
                <span className="block text-[10px]" style={{ color: '#8F835F' }}>
                  {sw.desc}
                </span>
              </span>
              <span className="text-[11px]" style={{ color: `${CRIMSON}99` }} aria-hidden>
                ›
              </span>
            </button>
          ))}
        </div>

        {/* 取消 */}
        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-xl py-2 text-[11px] tracking-[0.18em] transition-all"
          style={{
            color: '#5a5340',
            border: '1px solid rgba(90,83,64,0.25)',
            background: 'transparent',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = '#8F835F';
            (e.currentTarget as HTMLButtonElement).style.border = '1px solid rgba(90,83,64,0.5)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = '#5a5340';
            (e.currentTarget as HTMLButtonElement).style.border = '1px solid rgba(90,83,64,0.25)';
          }}
        >
          取消
        </button>
      </div>
    </div>
  );
}
