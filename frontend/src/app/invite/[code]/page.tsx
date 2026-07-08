'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { InviteLanding } from '../InviteLanding';

export default function InviteCodePage() {
  return (
    <Suspense fallback={null}>
      <InviteCodeContent />
    </Suspense>
  );
}

function InviteCodeContent() {
  const params = useParams<{ code: string }>();
  const code = (params?.code ?? '').toUpperCase();

  return <InviteLanding code={code} />;
}
