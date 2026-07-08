import { NextResponse } from 'next/server';
import { apiOk, departmentsSnapshot } from '@/lib/db/courtos-decision-store';

export const runtime = 'nodejs';

export async function GET(): Promise<NextResponse> {
  const departments = departmentsSnapshot();
  return NextResponse.json(apiOk({
    source_label: 'MIXED',
    user_visible_message: '统一部门 registry 已载入。',
    next_action: 'route_by_registry',
    data: { departments },
  }));
}
