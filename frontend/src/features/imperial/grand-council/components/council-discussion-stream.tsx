'use client';

import { CouncilMessageCard } from './council-message-card';

export interface CouncilDiscussionStreamProps {
  items: Array<{
    speaker: string;
    content: string;
    tone: string;
  }>;
  filter?: 'all' | 'prime' | 'ministries' | 'risk';
}

export function CouncilDiscussionStream({ items, filter = 'all' }: CouncilDiscussionStreamProps) {
  const filtered = items.filter((item) => {
    if (filter === 'all') return true;
    if (filter === 'prime') return item.speaker === '丞相';
    if (filter === 'risk') return item.tone === '#F43F5E';
    return item.speaker !== '丞相';
  });

  return (
    <div className="space-y-3">
      {filtered.map((item, index) => (
        <CouncilMessageCard
          key={`${item.speaker}-${index}`}
          speaker={item.speaker}
          content={item.content}
          tone={item.tone}
        />
      ))}
    </div>
  );
}
