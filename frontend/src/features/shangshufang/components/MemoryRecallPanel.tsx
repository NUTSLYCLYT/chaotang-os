import { assessBuildLedgerEntry, type BuildLedgerEntry } from '@/features/operating-loop/lib/build-ledger';
import type { KnowledgeCase } from '@/features/operating-loop/lib/knowledge-kernel';
import type { MemoryRecallItem } from '../ShangshufangPage';

export function buildMemoryRecallItems(
  buildLedger: BuildLedgerEntry[],
  knowledgeCases: KnowledgeCase[],
): MemoryRecallItem[] {
  const ledgerItems: MemoryRecallItem[] = buildLedger.slice(0, 2).map((entry) => {
    const assessment = assessBuildLedgerEntry(entry);
    return {
      id: `ledger-${entry.id}`,
      kind: 'ledger',
      title: entry.title,
      source: entry.source ? `Build Ledger · ${entry.source}` : 'Build Ledger',
      capturedAt: entry.updatedAt ?? entry.createdAt,
      matchReason: `同属朝堂建设闭环 · ${assessment.grade} · ${assessment.riskLevel === 'low' ? '证据较完整' : '需补证据'}`,
      confidence: Math.min(0.96, assessment.score / 100),
      summary: assessment.nextSuggestion,
      applyText: `参考史馆建设台账《${entry.title}》：${assessment.nextSuggestion}`,
    };
  });

  const knowledgeItems: MemoryRecallItem[] = knowledgeCases.map((item) => {
    const gene = item.reusableGenes[0];
    const evidence = item.evidence[0];
    return {
      id: `knowledge-${item.id}`,
      kind: 'knowledge',
      title: item.title,
      source: `经营记忆内核 · ${item.source}`,
      capturedAt: item.updatedAt,
      matchReason: item.targetDept ? `可复用到 ${item.targetDept}` : '跨部门可复用案卷',
      confidence: Math.max(0.72, gene?.confidence ?? evidence?.confidence ?? 0.72),
      summary: gene?.rule ?? item.nextSuggestion,
      applyText: `参考经营记忆《${item.title}》：${gene?.rule ?? item.nextSuggestion}`,
    };
  });

  const seenTitles = new Set<string>();
  return [...ledgerItems, ...knowledgeItems].filter((item) => {
    const titleKey = item.title.trim();
    if (seenTitles.has(titleKey)) return false;
    seenTitles.add(titleKey);
    return true;
  }).slice(0, 3);
}

export function MemoryRecallPanel({
  items,
  onApply,
}: {
  items: MemoryRecallItem[];
  onApply: (item: MemoryRecallItem) => void;
}) {
  if (items.length === 0) return null;

  return (
    <div
      className="mt-2 rounded-xl border border-[#F0C66A]/18 bg-[#F0C66A]/[0.045] px-3 py-2"
      aria-label="历史可复用依据"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] tracking-[0.18em] text-[#D9C79A]">史馆召回</div>
          <div className="mt-0.5 text-[12px] font-semibold text-[#F5E9C9]">
            历史可复用依据
          </div>
        </div>
        <span className="shrink-0 rounded border border-[#3DD68C]/20 bg-[#3DD68C]/[0.06] px-2 py-0.5 text-[10px] text-[#B9F6D2]">
          {items.length} 条
        </span>
      </div>
      <div className="mt-2 grid gap-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="rounded-lg border border-white/10 bg-black/15 px-2.5 py-2"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="line-clamp-1 text-[11.5px] font-semibold text-[#EAEEFB]">
                  {item.title}
                </div>
                <div className="mt-0.5 text-[9.5px] text-[#8F98B8]">
                  {item.source} · {new Date(item.capturedAt).toLocaleDateString('zh-CN')}
                </div>
              </div>
              <span className="shrink-0 text-[10px] text-[#F0C66A]">
                {Math.round(item.confidence * 100)}%
              </span>
            </div>
            <div className="mt-1 line-clamp-2 text-[10.5px] leading-4 text-[#C6BB9D]">
              {item.summary}
            </div>
            <div className="mt-1 text-[10px] text-[#7D88A4]">
              匹配原因：{item.matchReason}
            </div>
            <button
              type="button"
              onClick={() => onApply(item)}
              className="mt-2 rounded border border-[#F0C66A]/24 bg-[#F0C66A]/[0.06] px-2 py-1 text-[10px] text-[#F0C66A] transition hover:bg-[#F0C66A]/[0.12]"
            >
              带入下旨
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
