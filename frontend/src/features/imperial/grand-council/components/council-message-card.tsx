'use client';

export interface CouncilMessageCardProps {
  speaker: string;
  content: string;
  tone: string;
}

export function CouncilMessageCard({ speaker, content, tone }: CouncilMessageCardProps) {
  return (
    <div
      className="rounded-2xl border px-4 py-3"
      style={{
        borderColor: `${tone}33`,
        background: `${tone}08`,
      }}
    >
      <div className="text-[11px] font-semibold" style={{ color: tone }}>
        {speaker}
      </div>
      <div className="body-copy mt-1 text-[13px] leading-7 text-[#D3D8E8]">
        {content}
      </div>
    </div>
  );
}
