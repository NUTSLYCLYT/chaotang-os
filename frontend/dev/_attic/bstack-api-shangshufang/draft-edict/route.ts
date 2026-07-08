import { NextResponse } from 'next/server';
import { apiError, apiOk, createDraftEdict } from '@/lib/db/courtos-decision-store';
import { requireSessionUserId, SessionUserError } from '@/lib/auth/require-session-user';

export const runtime = 'nodejs';

export async function POST(req: Request): Promise<NextResponse> {
  let body: { raw_question?: string; question?: string; user_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(apiError({ message: '请求体不是合法 JSON。', next_action: '重新提交问题' }), { status: 400 });
  }

  try {
    const userId = await requireSessionUserId();
    const rawQuestion = (body.raw_question ?? body.question ?? '').trim();
    const { task, draft } = await createDraftEdict({ raw_question: rawQuestion, user_id: userId });
    return NextResponse.json(apiOk({
      source_label: draft.source_label,
      task_id: task.id,
      user_visible_message: '丞相已拟旨，等待确认下旨。',
      next_action: 'confirm_edict',
      data: { task, draft_edict: draft },
    }), { status: 201 });
  } catch (error) {
    if (error instanceof SessionUserError) {
      return NextResponse.json(apiError({
        message: '请先登录，再进入上书房下旨。',
        next_action: 'login_required',
        error: 'unauthorized',
      }), { status: 401 });
    }
    return NextResponse.json(apiError({
      message: '拟旨失败，任务未进入会审。',
      next_action: '补充更具体的问题后重试',
      error: error instanceof Error ? error.message : 'draft_edict_failed',
    }), { status: 400 });
  }
}
