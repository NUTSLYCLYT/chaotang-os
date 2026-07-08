'use client';

export interface MemorialDraftEditorProps {
  value: string;
  onChange: (next: string) => void;
}

export function MemorialDraftEditor({ value, onChange }: MemorialDraftEditorProps) {
  return (
    <div className="rounded-xl border border-white/6 bg-black/20 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="section-eyebrow">Memorial Draft</div>
          <div className="section-title">御前奏章草稿</div>
        </div>
        <span className="rounded-full border border-[#F0C66A]/20 bg-[#F0C66A]/8 px-2 py-1 text-[11px] text-[#F0C66A]">
          .md
        </span>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-[360px] w-full resize-none rounded-xl border border-white/8 bg-[#060913] px-4 py-3 font-mono text-[12px] leading-7 text-[#D5DBEC] outline-none transition focus:border-[#F0C66A]/35"
        spellCheck={false}
      />
    </div>
  );
}
