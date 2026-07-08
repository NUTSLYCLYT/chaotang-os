import { NextResponse } from 'next/server';
import {
  apiError,
  apiOk,
  createDecision,
  getDecisionTask,
  getDecisionTaskForUser,
  latestReviewForTask,
} from '@/lib/db/courtos-decision-store';
import { requireSessionUserId, SessionUserError } from '@/lib/auth/require-session-user';

export const runtime = 'nodejs';

interface Context {
  params: Promise<{ task_id: string }>;
}

function normalizeTaskDecisionAction(action: unknown): 'adopt' | 'request_evidence' | 'recheck' | 'reject' | 'followup' {
  if (action === 'archive' || action === 'approve' || action === 'adopt') return 'adopt';
  if (action === 'reject') return 'reject';
  if (action === 'recheck') return 'recheck';
  if (action === 'followup') return 'followup';
  return 'request_evidence';
}

export async function POST(req: Request, context: Context): Promise<NextResponse> {
  const { task_id } = await context.params;
  let body: {
    action?: string;
    reason?: string;
    human_confirmed?: boolean;
    confirmation_record?: Record<string, unknown>;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(apiError({ task_id, message: '请求体不是合法 JSON。', next_action: '重新提交裁决' }), { status: 400 });
  }

  let task;
  try {
    const userId = await requireSessionUserId();
    task = await getDecisionTaskForUser(task_id, userId);
    if (!task) {
      return NextResponse.json(apiError({
        task_id,
        message: '任务不存在或不属于当前用户。',
        next_action: '回上书房查看自己的任务',
        error: 'task_not_found',
      }), { status: 404 });
    }
  } catch (error) {
    if (error instanceof SessionUserError) {
      return NextResponse.json(apiError({
        task_id,
        message: '请先登录，再提交裁决。',
        next_action: 'login_required',
        error: 'unauthorized',
      }), { status: 401 });
    }
    throw error;
  }
  const review = await latestReviewForTask(task_id);
  if (!review) {
    return NextResponse.json(apiError({ task_id, message: '任务尚未进入军机处。', next_action: '先确认下旨' }), { status: 409 });
  }

  try {
    const result = await createDecision({
      review_id: review.id,
      action: normalizeTaskDecisionAction(body.action),
      reason: body.reason,
      human_confirmed: body.human_confirmed,
      confirmation_record: body.confirmation_record,
    });
    const updatedTask = await getDecisionTask(task_id);
    const archived = Boolean(result.archive);
    return NextResponse.json(apiOk({
      source_label: result.archive?.source_label ?? result.decision.source_label,
      task_id,
      review_id: review.id,
      user_visible_message: archived
        ? '裁决已记录，并已写入史馆归档链路。'
        : '裁决已记录；驳回不进入史馆归档，奏折保持当前状态。',
      next_action: archived ? 'view_archive' : 'view_review',
      data: {
        task_id,
        status: updatedTask?.status ?? task.status,
        decision_id: result.decision.id,
        archive_id: result.archive?.id ?? null,
        review_id: review.id,
      },
    }), { status: 201 });
  } catch (error) {
    return NextResponse.json(apiError({
      task_id,
      review_id: review.id,
      message: '裁决提交失败。',
      next_action: '高风险或弱来源请先人工确认',
      error: error instanceof Error ? error.message : 'decision_failed',
    }), { status: 400 });
  }
}
