import { NextResponse } from 'next/server';
import { apiError, apiOk, getReviewForUser, getReviewProgress } from '@/lib/db/courtos-decision-store';
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
  try {
    const review = await getReviewForUser(review_id, userId);
    if (!review) throw new Error('review_not_found');
    const progress = await getReviewProgress(review_id);
    return NextResponse.json(apiOk({
      source_label: progress.review.source_label,
      task_id: progress.review.task_id,
      review_id,
      user_visible_message: progress.memorial ? '会审已完成，等待裁决。' : '军机处会审中。',
      next_action: progress.memorial ? 'read_memorial' : 'wait_or_run_review',
      data: progress,
    }));
  } catch (error) {
    return NextResponse.json(apiError({
      review_id,
      message: '未找到 review 进度。',
      next_action: '检查 review_id',
      error: error instanceof Error ? error.message : 'progress_not_found',
    }), { status: 404 });
  }
}
