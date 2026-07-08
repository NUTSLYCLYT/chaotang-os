import { NextResponse } from 'next/server';
import { apiError, apiOk, getReviewForUser, updateTaskStatus } from '@/lib/db/courtos-decision-store';
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
  let body: { followup_question?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(apiError({ review_id, message: '请求体不是合法 JSON。', next_action: '重新提交追问' }), { status: 400 });
  }
  const review = await getReviewForUser(review_id, userId);
  if (!review) {
    return NextResponse.json(apiError({ review_id, message: 'review 不存在。', next_action: '检查 review_id' }), { status: 404 });
  }
  await updateTaskStatus(review.task_id, 'followuping');
  return NextResponse.json(apiOk({
    source_label: review.source_label,
    task_id: review.task_id,
    review_id,
    user_visible_message: '追问已继承当前任务上下文。',
    next_action: 'continue_same_review_context',
    data: { followup_question: body.followup_question ?? '', inherited_review_id: review_id },
  }));
}
