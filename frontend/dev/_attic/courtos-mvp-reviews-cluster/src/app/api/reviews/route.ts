import { NextResponse } from 'next/server';
import { apiError, apiOk, createReview, getDecisionTaskForUser } from '@/lib/db/courtos-decision-store';
import { requireTenantScope } from '@/lib/auth/tenant-scope';

export const runtime = 'nodejs';

export async function POST(req: Request): Promise<NextResponse> {
  const scope = await requireTenantScope();
  if (!scope) return NextResponse.json(apiError({ message: '未授权。', next_action: '先登录' }), { status: 401 });
  const { userId, tenantId } = scope;
  let body: { task_id?: string; confirmed_edict_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(apiError({ message: '请求体不是合法 JSON。', next_action: '重新创建 review' }), { status: 400 });
  }

  if (!body.task_id) {
    return NextResponse.json(apiError({ message: '缺少 task_id。', next_action: '先创建任务和拟旨' }), { status: 400 });
  }

  try {
    const task = await getDecisionTaskForUser(body.task_id, userId);
    if (!task) {
      return NextResponse.json(apiError({ message: 'task 不存在。', next_action: '检查 task_id' }), { status: 404 });
    }
    const result = await createReview(body as { task_id: string; confirmed_edict_id?: string });
    return NextResponse.json(apiOk({
      source_label: result.review.source_label,
      task_id: result.task.id,
      review_id: result.review.id,
      user_visible_message: '军机处 review 已创建。',
      next_action: 'run_review',
      data: result,
    }), { status: 201 });
  } catch (error) {
    return NextResponse.json(apiError({
      task_id: body.task_id,
      message: '创建 review 失败。',
      next_action: '检查 task_id 和 confirmed_edict_id',
      error: error instanceof Error ? error.message : 'create_review_failed',
    }), { status: 400 });
  }
}
