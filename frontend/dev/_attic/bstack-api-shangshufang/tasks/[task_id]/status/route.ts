import { NextResponse } from 'next/server';
import {
  apiError,
  apiOk,
  getDecisionTaskForUser,
  latestDraftForTask,
  latestMemorialForReview,
  latestReviewForTask,
  listDepartmentRuns,
} from '@/lib/db/courtos-decision-store';
import { requireSessionUserId, SessionUserError } from '@/lib/auth/require-session-user';

export const runtime = 'nodejs';

interface Context {
  params: Promise<{ task_id: string }>;
}

export async function GET(_req: Request, context: Context): Promise<NextResponse> {
  const { task_id } = await context.params;
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
        message: '请先登录，再查看任务状态。',
        next_action: 'login_required',
        error: 'unauthorized',
      }), { status: 401 });
    }
    throw error;
  }

  const [draft, review] = await Promise.all([latestDraftForTask(task_id), latestReviewForTask(task_id)]);
  const [memorial, departmentRuns] = review
    ? await Promise.all([latestMemorialForReview(review.id), listDepartmentRuns(review.id)])
    : [null, []];

  return NextResponse.json(apiOk({
    source_label: task.source_label,
    task_id,
    review_id: review?.id,
    user_visible_message: memorial ? '奏折已生成，等待裁决。' : review ? '军机处会审中。' : '拟旨已保存，等待确认。',
    next_action: memorial ? 'submit_decision' : review ? 'run_review' : 'confirm_edict',
    data: {
      task: {
        task_id: task.id,
        status: task.status,
        raw_question: task.raw_question,
        draft_edict: draft?.payload ?? null,
        source_label: task.source_label,
        risk_flags: task.risk_flags,
        known_facts: task.known_facts,
        unknown_gaps: task.unknown_gaps,
        recommended_departments: [],
        created_at: task.created_at,
        updated_at: task.updated_at,
      },
      review: review
        ? {
            review_id: review.id,
            review_status: review.status,
            routing_plan: review.review_plan,
            ministry_outputs: departmentRuns.map((run) => run.output).filter(Boolean),
            conflict_summary: (memorial?.content.conflicts ?? []) as unknown,
            memorial: memorial?.content ?? null,
            created_at: review.created_at,
            updated_at: review.updated_at,
          }
        : null,
    },
  }));
}
