import { NextResponse } from 'next/server';
import { apiError, apiOk, listArchives } from '@/lib/db/courtos-decision-store';
import { requireTenantScope } from '@/lib/auth/tenant-scope';

export const runtime = 'nodejs';

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const scope = await requireTenantScope();
    if (!scope) return NextResponse.json(apiError({ message: '未授权。', next_action: '先登录' }), { status: 401 });
    const { userId, tenantId } = scope;
    const { searchParams } = new URL(request.url);
    const archives = await listArchives({ limit: Number(searchParams.get('limit') ?? 30), user_id: userId });
    return NextResponse.json(apiOk({
      source_label: archives[0]?.source_label ?? 'MIXED',
      user_visible_message: archives.length ? '史馆归档可查看。' : '史馆暂无 CourtOS MVP 归档。',
      next_action: archives.length ? 'open_archive' : 'complete_first_decision',
      data: { archives },
    }));
  } catch {
    return NextResponse.json(apiError({ message: '史馆列表暂不可用。', next_action: '稍后重试' }), { status: 503 });
  }
}
