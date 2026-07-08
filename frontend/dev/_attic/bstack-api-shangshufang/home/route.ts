import { NextResponse } from 'next/server';
import { apiError, apiOk, courtosHomeSnapshot, latestDraftForTask } from '@/lib/db/courtos-decision-store';
import { requireSessionUserId, SessionUserError } from '@/lib/auth/require-session-user';

export const runtime = 'nodejs';

export async function GET(): Promise<NextResponse> {
  try {
    const userId = await requireSessionUserId();
    const snapshot = await courtosHomeSnapshot({ user_id: userId });
    const withDraft = async (task: (typeof snapshot.pending_decisions)[number]) => {
      const draft = await latestDraftForTask(task.id);
      return { ...task, draft_edict: draft?.payload ?? null };
    };
    const [pendingDecisions, awaitingEvidence] = await Promise.all([
      Promise.all(snapshot.pending_decisions.map(withDraft)),
      Promise.all(snapshot.awaiting_evidence.map(withDraft)),
    ]);
    return NextResponse.json(apiOk({
      source_label: snapshot.source_label,
      user_visible_message: snapshot.recommended_issue ? '上书房已有待处理经营问题。' : '暂无真实建议，可从一句话下旨开始。',
      next_action: snapshot.recommended_issue ? '查看待裁决或待补证任务' : '输入真实经营问题',
      data: {
        ...snapshot,
        pending_decisions: pendingDecisions,
        awaiting_evidence: awaitingEvidence,
      },
    }));
  } catch (error) {
    if (error instanceof SessionUserError) {
      return NextResponse.json(apiError({
        message: '请先登录，再查看上书房。',
        next_action: 'login_required',
        error: 'unauthorized',
      }), { status: 401 });
    }
    return NextResponse.json(apiError({
      message: '上书房首页暂不可用，任务不会因此丢失。',
      next_action: '稍后重试或直接创建拟旨',
    }), { status: 503 });
  }
}
