'use client';

/**
 * 部门一句话摘要顶条(张小龙:把 N 司结论压成老板 5 秒读完的一行 · 2026-07-01)
 *
 * 通用·任意部可拖:传部门名 + 司花名册(name/role/engine)+ 主题色。
 * 诚实(铁律5/9):只显"真司能算什么 + 几个待通电",不编"本月X件"这类无数据源的假摘要;
 * 有真决策会话数时可传 sessionCount 让它自增。老板一眼看清"本部现在能替我算哪些账"。
 */

export interface DigestOffice {
  name: string;
  role: string;
  /** 是否已接真引擎(骨架=待通电,诚实标)。 */
  engine: boolean;
  /** 排除统筹/总负责(不进"能算"清单)。 */
  isChief?: boolean;
}

export function DeptDigestBar({
  deptName,
  offices,
  accent,
  sessionCount,
  perOfficeSavingWan,
}: {
  deptName: string;
  offices: DigestOffice[];
  accent: string;
  /** 本次会话已审查件数(可选·有真会话数据才传,否则不显)。 */
  sessionCount?: number;
  /** 每个真司年替代人力估值(万元/司/年)。传了才显"每年约省",且明标"估"+假设,不当既成事实。 */
  perOfficeSavingWan?: number;
}) {
  const real = offices.filter((o) => o.engine && !o.isChief);
  const skeleton = offices.filter((o) => !o.engine && !o.isChief);
  const savingWan = perOfficeSavingWan != null ? Math.round(real.length * perOfficeSavingWan) : null;

  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[14px] border px-3.5 py-2 text-[12px]"
      style={{ borderColor: `${accent}26`, background: `linear-gradient(180deg, ${accent}0e 0%, rgba(6,8,14,0.6) 100%)` }}
    >
      <span className="font-semibold" style={{ color: '#F5E9C9' }}>{deptName}</span>
      <span style={{ color: accent }}>{real.length} 真司可算</span>
      <span className="truncate" style={{ color: '#a7b3ac' }}>
        {real.map((o) => o.name.replace(/司$/, '')).join(' · ')}
      </span>
      {skeleton.length > 0 && (
        <span style={{ color: '#6a7080' }}>· {skeleton.length} 待通电({skeleton.map((o) => o.name.replace(/司$/, '')).join('/')})</span>
      )}
      <span
        className="rounded-full px-2 py-0.5 text-[10px] font-medium"
        style={{ border: `1px solid ${accent}40`, background: `${accent}12`, color: accent }}
        title={savingWan != null ? `估算:${real.length} 个智能体司 × 每司≈¥${perOfficeSavingWan}w/年替代分析工时;仅估算,非承诺` : undefined}
      >
        🤖 {real.length} 智能体员工{savingWan != null ? ` · 每年约省 ¥${savingWan}w(估)` : ''}
      </span>
      {typeof sessionCount === 'number' && sessionCount > 0 && (
        <span className="rounded-full px-2 py-0.5 text-[10px]" style={{ border: `1px solid ${accent}40`, color: accent }}>
          本次已审 {sessionCount} 件
        </span>
      )}
      <span className="ml-auto text-[10px]" style={{ color: '#4a5060' }}>LOCAL · 决策前替你算账 · 数据不出浏览器</span>
    </div>
  );
}
