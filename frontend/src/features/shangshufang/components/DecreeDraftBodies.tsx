import { Loader2 } from 'lucide-react';
import type { SourceLabel } from '@/core/courtos/types';
import type { ExecutableDecreeMode } from '../ShangshufangPage';

export function DecreeSubmittingBody({ mode, command }: { mode: ExecutableDecreeMode; command: string }) {
  const isSecret = mode === 'secret';
  const accent = isSecret ? '#7A2F2A' : '#8A5A18';
  const faintAccent = isSecret ? 'rgba(122,47,42,0.14)' : 'rgba(138,90,24,0.12)';

  return (
    <div data-testid="decree-submitting-body" className="mx-auto flex min-h-full w-full max-w-[1180px] flex-col justify-center gap-3 px-1">
      <div
        className="rounded-xl border px-4 py-4 md:px-5"
        style={{
          borderColor: 'rgba(107,74,29,0.28)',
          background: `linear-gradient(135deg, ${faintAccent}, rgba(255,248,224,0.14) 58%, rgba(255,248,224,0.06))`,
          boxShadow: 'inset 0 1px 0 rgba(255,248,224,0.38), 0 12px 28px rgba(86,50,16,0.10)',
        }}
      >
        <div className="flex items-center gap-3">
          <span
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border"
            style={{ borderColor: 'rgba(138,90,24,0.28)', background: 'rgba(255,248,224,0.18)', color: accent }}
          >
            <Loader2 size={20} className="animate-spin" />
          </span>
          <div className="min-w-0">
            <div className="text-[12px] font-bold tracking-[0.22em]" style={{ color: accent, fontFamily: 'var(--font-serif)' }}>
              下旨中
            </div>
            <p className="mt-1 text-[14px] leading-[1.7]" style={{ color: '#3F2C12', fontFamily: 'var(--font-serif)' }}>
              {isSecret ? '密旨已发，正在等待蜂群直奏回写。' : '圣旨已发，正在等待丞相拟旨、后端确认与回奏写回。'}
            </p>
          </div>
        </div>
      </div>

      <section
        className="rounded-xl border px-4 py-3 md:px-5"
        style={{
          borderColor: 'rgba(107,74,29,0.24)',
          background: 'linear-gradient(180deg, rgba(255,248,224,0.18), rgba(255,248,224,0.07))',
          boxShadow: 'inset 0 1px 0 rgba(255,248,224,0.34)',
        }}
      >
        <div className="border-b pb-2 text-[12px] font-semibold tracking-[0.18em]" style={{ color: accent, borderColor: 'rgba(107,74,29,0.20)', fontFamily: 'var(--font-serif)' }}>
          正在递送的旨意
        </div>
        <p className="mt-2 max-h-[220px] overflow-y-auto whitespace-pre-wrap text-[15px] leading-8 text-[#3A260B] md:text-[16px]" style={{ fontFamily: 'var(--font-serif)' }}>
          {command.trim() || '旨意正在递送。'}
        </p>
      </section>
    </div>
  );
}

export function DecreeDraftBody({
  mode,
  original,
  polished,
  busy,
  sourceLabel,
  fallbackUsed,
  readOnlyReason,
}: {
  mode: ExecutableDecreeMode;
  original: string;
  polished: string | null;
  busy: boolean;
  sourceLabel?: SourceLabel;
  fallbackUsed?: boolean;
  readOnlyReason?: string;
  onConfirm: () => void;
}) {
  const trimmedOriginal = original.trim();
  const trimmedPolished = polished?.trim() ?? '';
  const draftBodyText = trimmedPolished || trimmedOriginal;
  const readOnly = Boolean(readOnlyReason);
  const canConfirm = trimmedPolished.length > 0 && !busy && !readOnly;
  const accent = mode === 'secret' ? '#7A2F2A' : '#8A5A18';
  const faintAccent = mode === 'secret' ? 'rgba(122,47,42,0.14)' : 'rgba(138,90,24,0.12)';
  const hasPolished = trimmedPolished.length > 0;
  const hasDraftBodyText = draftBodyText.length > 0;
  const sourceText = sourceLabel ? `来源 ${sourceLabel}${fallbackUsed ? ' · 需人工复核' : ''}` : '润色后会在此标注来源';

  return (
    <div data-testid="decree-draft-body" className="mx-auto flex min-h-full w-full max-w-[1180px] flex-col gap-2.5">
      <div
        className="rounded-xl border px-3 py-2.5 md:px-4"
        style={{
          borderColor: 'rgba(107,74,29,0.28)',
          background: `linear-gradient(135deg, ${faintAccent}, rgba(255,248,224,0.13) 58%, rgba(255,248,224,0.05))`,
          boxShadow: 'inset 0 1px 0 rgba(255,248,224,0.34)',
        }}
      >
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="text-[10px] font-bold tracking-[0.22em]" style={{ color: accent, fontFamily: 'var(--font-serif)' }}>
              御前润色回执
            </div>
            <p className="mt-1 text-[13px] leading-[1.65]" style={{ color: '#3F2C12', fontFamily: 'var(--font-serif)' }}>
              {readOnlyReason ?? '润色后只展示文字预览，不会在卷轴内直接启动蜂群。'}
            </p>
          </div>
          {(readOnly || hasPolished) && (
            <span
              className="shrink-0 rounded-full border px-2.5 py-1 text-[10.5px] font-bold"
              style={{
                borderColor: readOnly ? 'rgba(107,74,29,0.30)' : 'rgba(23,107,69,0.34)',
                background: readOnly ? 'rgba(107,74,29,0.08)' : 'rgba(23,107,69,0.08)',
                color: readOnly ? '#5B4A30' : '#176B45',
              }}
            >
              {readOnly ? '只读 · 已生成' : '润色完成 · 待确认文字'}
            </span>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2.5">
        <section
          className="flex min-h-[min(46vh,380px)] flex-1 flex-col rounded-xl border px-4 py-3 md:px-5"
          style={{
            borderColor: 'rgba(107,74,29,0.26)',
            background: hasDraftBodyText
              ? 'linear-gradient(180deg, rgba(255,248,224,0.20), rgba(255,248,224,0.075))'
              : 'rgba(255,248,224,0.09)',
            boxShadow: hasDraftBodyText
              ? 'inset 0 1px 0 rgba(255,248,224,0.42), 0 10px 26px rgba(86,50,16,0.08)'
              : 'inset 0 1px 0 rgba(255,248,224,0.24)',
          }}
        >
          <div className="flex items-center justify-between gap-3 border-b pb-2 text-[12px] font-semibold tracking-[0.18em]" style={{ color: accent, fontFamily: 'var(--font-serif)' }}>
            <span>润色结果</span>
            <span className="text-[10px] font-normal tracking-[0.08em]" style={{ color: '#7D6B48' }}>{sourceText}</span>
          </div>
          <p
            data-testid="decree-draft-polished"
            className={`mt-2 flex-1 overflow-y-auto overscroll-contain whitespace-pre-wrap text-[15px] leading-8 md:text-[16px] ${
              hasDraftBodyText ? 'text-[#3A260B]' : 'text-[#7D6B48]/70'
            }`}
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            {draftBodyText || (readOnly ? '已生成奏折正文只读，不再改写拟旨。' : '点击“润色”后，这里展示整理后的文字。')}
          </p>
          <div
            className="mt-auto grid gap-2 border-t pt-3 md:items-center"
            style={{
              borderColor: 'rgba(107,74,29,0.20)',
            }}
          >
            <div
              className="min-w-0 rounded-lg border px-2.5 py-1.5 text-[11px] leading-[1.7]"
              style={{
                color: canConfirm ? '#31523C' : '#6E5A38',
                borderColor: canConfirm ? 'rgba(23,107,69,0.22)' : 'rgba(138,106,42,0.22)',
                background: canConfirm ? 'rgba(23,107,69,0.06)' : 'rgba(138,106,42,0.055)',
                fontFamily: 'var(--font-serif)',
              }}
            >
              {readOnly
                ? '这份正文来自已生成奏折，只可查看；如需改写，请退回再审或重新下旨。'
                : canConfirm
                ? mode === 'secret'
                  ? '密旨文字已润色；请回到底部输入区继续调整或另行发起。'
                  : '旨意文字已润色；请回到底部输入区继续调整或点击下旨按钮。'
                : '等待润色；润色只返回文字，不会启动蜂群。'}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
