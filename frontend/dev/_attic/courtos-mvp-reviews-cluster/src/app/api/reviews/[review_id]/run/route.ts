import { NextResponse } from 'next/server';
import { apiError, apiOk, getReviewForUser, runReview } from '@/lib/db/courtos-decision-store';
import { requireTenantScope } from '@/lib/auth/tenant-scope';

export const runtime = 'nodejs';

interface Context {
  params: Promise<{ review_id: string }>;
}

export async function POST(_req: Request, context: Context): Promise<NextResponse> {
  const scope = await requireTenantScope();
  if (!scope) return NextResponse.json(apiError({ message: '未授权。', next_action: '先登录' }), { status: 401 });
  const { userId, tenantId } = scope;
  const { review_id } = await context.params;
  try {
    const review = await getReviewForUser(review_id, userId);
    if (!review) throw new Error('review_not_found');
    const result = await runReview(review_id);
    return NextResponse.json(apiOk({
      source_label: result.memorial.source_label,
      task_id: result.review.task_id,
      review_id,
      user_visible_message: '军机处会审完成，奏折已生成。',
      next_action: 'read_memorial',
      data: result,
    }));
  } catch (error) {
    return NextResponse.json(apiError({
      review_id,
      message: '会审运行失败，但 review 记录不会丢。',
      next_action: '查看 progress 或稍后重试',
      error: error instanceof Error ? error.message : 'run_review_failed',
    }), { status: 500 });
  }
}
