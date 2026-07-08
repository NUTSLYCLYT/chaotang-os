import { NextResponse } from 'next/server';
import {
  apiError,
  apiOk,
  createReview,
  getDecisionTaskForUser,
  saveEditedDraftEdict,
} from '@/lib/db/courtos-decision-store';
import { requireSessionUserId, SessionUserError } from '@/lib/auth/require-session-user';

export const runtime = 'nodejs';

export async function POST(req: Request): Promise<NextResponse> {
  let body: {
    task_id?: string;
    confirmed_edict_id?: string;
    draft_edict_id?: string;
    edited_edict?: Record<string, unknown> | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(apiError({ message: '请求体不是合法 JSON。', next_action: '重新确认拟旨' }), { status: 400 });
  }

  if (!body.task_id) {
    return NextResponse.json(apiError({ message: '缺少 task_id。', next_action: '先生成拟旨' }), { status: 400 });
  }

  try {
    const userId = await requireSessionUserId();
    const ownedTask = await getDecisionTaskForUser(body.task_id, userId);
    if (!ownedTask) {
      return NextResponse.json(apiError({
        task_id: body.task_id,
        message: '任务不存在或不属于当前用户。',
        next_action: '回上书房查看自己的任务',
        error: 'task_not_found',
      }), { status: 404 });
    }
    const editedDraft = body.edited_edict
      ? await saveEditedDraftEdict({
          task_id: body.task_id,
          edited_edict: body.edited_edict,
        })
      : null;
    const result = await createReview({
      task_id: body.task_id,
      confirmed_edict_id: editedDraft?.id ?? body.confirmed_edict_id ?? body.draft_edict_id,
    });
    return NextResponse.json(apiOk({
      source_label: result.review.source_label,
      task_id: result.task.id,
      review_id: result.review.id,
      user_visible_message: '圣旨已下，军机处会审中。',
      next_action: 'run_review',
      data: result,
    }), { status: 201 });
  } catch (error) {
    if (error instanceof SessionUserError) {
      return NextResponse.json(apiError({
        task_id: body.task_id,
        message: '请先登录，再确认拟旨。',
        next_action: 'login_required',
        error: 'unauthorized',
      }), { status: 401 });
    }
    return NextResponse.json(apiError({
      task_id: body.task_id,
      message: '确认拟旨失败，任务仍可通过 task_id 找回。',
      next_action: '检查拟旨是否存在后重试',
      error: error instanceof Error ? error.message : 'confirm_edict_failed',
    }), { status: 400 });
  }
}
