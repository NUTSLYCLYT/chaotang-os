import { NextResponse } from 'next/server';
import { apiError, apiOk, createDecision, getReviewForUser } from '@/lib/db/courtos-decision-store';
import { requireTenantScope } from '@/lib/auth/tenant-scope';

export const runtime = 'nodejs';

interface Context {
  params: Promise<{ review_id: string }>;
}

export async function POST(req: Request, context: Context): Promise<NextResponse> {
  const scope = await requireTenantScope();
  if (!scope) return NextResponse.json(apiError({ message: '未授权。', next_action: '先登录' }), { status: 401 });
  const { userId, tenantId } = scope;
  const { review_id } = await context.params;
  let body: {
    action?: string;
    reason?: string;
    human_confirmed?: boolean;
    confirmation_record?: Record<string, unknown>;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(apiError({ review_id, message: '请求体不是合法 JSON。', next_action: '重新提交裁决' }), { status: 400 });
  }

  try {
    const review = await getReviewForUser(review_id, userId);
    if (!review) throw new Error('review_not_found');
    const result = await createDecision({
      review_id,
      action: body.action,
      reason: body.reason,
      human_confirmed: body.human_confirmed,
      confirmation_record: body.confirmation_record,
    });
    const archived = Boolean(result.archive);
    return NextResponse.json(apiOk({
      source_label: result.archive?.source_label ?? result.decision.source_label,
      task_id: result.decision.task_id,
      review_id,
      user_visible_message: archived
        ? '裁决已记录，并已进入史馆归档链路。'
        : '裁决已记录；驳回不进入史馆归档，奏折保持当前状态。',
      next_action: archived ? 'view_archive' : 'view_review',
      data: result,
    }), { status: 201 });
  } catch (error) {
    return NextResponse.json(apiError({
      review_id,
      message: '裁决提交失败。',
      next_action: '确认奏折已生成后重试',
      error: error instanceof Error ? error.message : 'decision_failed',
    }), { status: 400 });
  }
}
