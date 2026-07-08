import { NextResponse } from 'next/server';
import { apiError, apiOk, getArchiveForUser } from '@/lib/db/courtos-decision-store';
import { requireTenantScope } from '@/lib/auth/tenant-scope';

export const runtime = 'nodejs';

interface Context {
  params: Promise<{ archive_id: string }>;
}

export async function GET(_req: Request, context: Context): Promise<NextResponse> {
  const scope = await requireTenantScope();
  if (!scope) return NextResponse.json(apiError({ message: '未授权。', next_action: '先登录' }), { status: 401 });
  const { userId, tenantId } = scope;
  const { archive_id } = await context.params;
  const archive = await getArchiveForUser(archive_id, userId);
  if (!archive) {
    return NextResponse.json(apiError({ message: '史馆记录不存在。', next_action: '检查 archive_id' }), { status: 404 });
  }
  return NextResponse.json(apiOk({
    source_label: archive.source_label,
    task_id: archive.task_id,
    review_id: archive.review_id,
    user_visible_message: '史馆记录已载入。',
    next_action: 'retrospective_or_reuse',
    data: { archive },
  }));
}
