'use client';

import { HanlinScoutingDetailPage } from '@/features/hanlin/pages/scouting-detail';
import { useParams } from 'next/navigation';

export default function Page() {
  const params = useParams<{ candidateId: string }>();
  return <HanlinScoutingDetailPage candidateId={params.candidateId} />;
}
