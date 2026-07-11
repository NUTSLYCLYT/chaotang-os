const ROLE_SCENARIOS = [
  {
    role: '运营',
    prompt: '复盘本周阻塞任务，找出先补流程还是先补资源',
    outcome: '任务状态 · 阻塞原因 · 验收下一步',
  },
  {
    role: '销售',
    prompt: '让销售庄园和外交部院分析大客户采购特征，筛出本周最该跟进的商机任务',
    outcome: '客户线索 · 商机优先级 · 销售任务',
  },
  {
    role: '内容',
    prompt: '把本周客户案例和资料整理成可发布内容素材，并送史馆标注风险边界',
    outcome: '资料素材 · 史馆归档 · 发布口径',
  },
];

export function RoleScenarioStrip({ onSelect }: { onSelect: (prompt: string) => void }) {
  return (
    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3" aria-label="上书房角色场景">
      {ROLE_SCENARIOS.map((item) => (
        <button
          key={item.role}
          type="button"
          onClick={() => onSelect(item.prompt)}
          className="group rounded-lg border border-white/10 bg-white/[0.035] px-2.5 py-2 text-left transition hover:border-[#F0C66A]/35 hover:bg-[#F0C66A]/[0.06]"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] tracking-[0.16em] text-[#D9C79A]">{item.role}</span>
            <span className="text-[9px] text-[#6A7299] group-hover:text-[#B9F6D2]">真案示例</span>
          </div>
          <div className="mt-1 line-clamp-2 text-[11px] leading-4 text-[#EAEEFB]">
            {item.prompt}
          </div>
          <div className="mt-1 line-clamp-1 text-[10px] text-[#8F98B8]">
            {item.outcome}
          </div>
        </button>
      ))}
    </div>
  );
}
