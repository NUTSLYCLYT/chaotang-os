import { NextResponse } from 'next/server';
import { apiError, apiOk, getReviewForUser, listDepartmentRuns } from '@/lib/db/courtos-decision-store';
import { requireTenantScope } from '@/lib/auth/tenant-scope';

export const runtime = 'nodejs';

interface Context {
  params: Promise<{ review_id: string }>;
}

export async function GET(_req: Request, context: Context): Promise<NextResponse> {
  const scope = await requireTenantScope();
  if (!scope) return NextResponse.json(apiError({ message: '未授权。', next_action: '先登录' }), { status: 401 });
  const { userId, tenantId } = scope;
  const { review_id } = await context.params;
  const review = await getReviewForUser(review_id, userId);
  if (!review) {
    return NextResponse.json(apiError({ review_id, message: 'review 不存在。', next_action: '检查 review_id' }), { status: 404 });
  }
  const runs = await listDepartmentRuns(review_id);
  return NextResponse.json(apiOk({
    source_label: review.source_label,
    task_id: review.task_id,
    review_id,
    user_visible_message: runs.length ? '部门参审结果可查看。' : '部门参审尚未运行。',
    next_action: runs.length ? 'read_department_runs' : 'run_review',
    data: { selected_departments: review.selected_departments, department_runs: runs },
  }));
}
