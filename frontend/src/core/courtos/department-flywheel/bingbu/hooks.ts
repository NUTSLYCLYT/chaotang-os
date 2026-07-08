// src/core/courtos/department-flywheel/bingbu/hooks.ts
import {
  classifyBingbuSalesRevenueQuestion,
  selectBingbuSubOffices,
  runBingbuCROSalesOfficeReview,
  evaluateBingbuQualityGate,
} from '@/core/courtos/bingbu/bingbu-cro-sales-office';
import { extractSalesFacts } from '@/features/bingbu/lib/sales-extract';
import { normalizeRealityState } from '@/lib/reality/reality-state';
import { fromRealityState } from '../../source-label-bridge';
import type { DeptHooks, RaiseDraft } from '../types';
import { selectCandidates, passesThreshold } from './hooks-pure.ts';

export const bingbuHooks: DeptHooks = {
  dept: 'bingbu',
  selectCandidates,
  passesThreshold,
  derive: (task): RaiseDraft | null => {
    const text = `${task.title} ${task.command}`.trim();
    const questionType = classifyBingbuSalesRevenueQuestion(text);
    const subOffices = selectBingbuSubOffices(questionType, text);
    // MED-2 去漂白(管道就绪·当前休眠，勿当已彻底关闭)：不再硬编码 'LIVE'/'real'，
    // 改按源任务自带来源标(task.sourceLabel)标真源(铁律2)。
    // ⚠️ 现无上游生产者在 submitted 行写 result.sourceLabel → task.sourceLabel 恒 undefined
    //    → sourceReality 恒 'real'，实际行为暂等同旧硬编码；待生产者接线后兵部质门
    //    (fallback_cannot_be_final_sales_basis)方真正生效。残留缺口见 dev/notes 执行清单。
    // 缺省(未标记)=real —— 真实用户输入 + 本地确定性启发式，与 hubu 一致；
    // 源若为 fallback/mock/degraded 则原样降级传下去，禁漂白。
    const sourceReality = task.sourceLabel ? normalizeRealityState(task.sourceLabel) : 'real';
    const opinion = runBingbuCROSalesOfficeReview({ text, sourceLabel: fromRealityState(sourceReality) });
    const gate = evaluateBingbuQualityGate(opinion);
    const facts = extractSalesFacts(text);

    const missingSnippet = opinion.missingEvidence.length > 0
      ? opinion.missingEvidence[0]
      : '无';

    return {
      sourceTaskId: task.id,
      command: `兵部呈报待决:${task.title} — CRO裁决【${opinion.position}】(问题类型:${questionType}/质门:${gate.signal}/缺证:${missingSnippet})。原由:${task.command}`,
      title: `兵部·${task.title}`,
      priority: gate.signal === 'RED' ? 10 : gate.signal === 'YELLOW' ? 5 : 1,
      reality: sourceReality,
      meta: {
        questionType,
        subOffices,
        position: opinion.position,
        signal: gate.signal,
        verdict: gate.verdict,
        missing: opinion.missingEvidence,
        humanConfirmationRequired: opinion.humanConfirmationRequired,
        amount: facts.amount,
        terms: facts.terms,
      },
    };
  },
};
