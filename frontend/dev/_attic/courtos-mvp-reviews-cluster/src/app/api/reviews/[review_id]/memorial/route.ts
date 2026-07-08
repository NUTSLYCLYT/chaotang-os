import { NextResponse } from 'next/server';
import { apiError, apiOk, latestMemorialForReview, getReviewForUser } from '@/lib/db/courtos-decision-store';
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
  const memorial = await latestMemorialForReview(review_id);
  if (!memorial) {
    return NextResponse.json(apiError({
      source_label: review.source_label,
      task_id: review.task_id,
      review_id,
      message: '奏折尚未生成。',
      next_action: 'run_review',
    }), { status: 404 });
  }
  return NextResponse.json(apiOk({
    source_label: memorial.source_label,
    task_id: memorial.task_id,
    review_id,
    user_visible_message: '奏折已就绪，等待裁决。',
    next_action: 'submit_decision',
    data: { memorial },
  }));
}
