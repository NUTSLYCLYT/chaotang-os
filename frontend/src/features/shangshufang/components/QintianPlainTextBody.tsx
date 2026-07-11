import type { EdictView } from '../edict-content';

export function QintianPlainTextBody({ view }: { view: EdictView }) {
  const paragraphs = view.rows
    .filter((row) => !/来源|追踪/.test(row.label))
    .flatMap((row) => row.body.split(/\n+/))
    .map((line) => line.trim())
    .filter(Boolean);
  const bodyLines = paragraphs.length ? paragraphs : [view.subtitle, view.question].filter((line): line is string => Boolean(line?.trim()));

  return (
    <article
      data-testid="qintian-plain-body"
      className="mx-auto flex min-h-[min(48vh,420px)] w-full max-w-[760px] flex-col justify-start rounded-xl border px-5 py-5 md:px-7 md:py-6"
      style={{
        borderColor: 'rgba(107,74,29,0.22)',
        background: 'linear-gradient(180deg, rgba(255,248,224,0.18), rgba(255,248,224,0.065))',
        boxShadow: 'inset 0 1px 0 rgba(255,248,224,0.36), 0 12px 28px rgba(86,50,16,0.08)',
      }}
    >
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
        <div className="space-y-4 whitespace-pre-wrap text-[15px] leading-8 text-[#3A260B] md:text-[16px]" style={{ fontFamily: 'var(--font-serif)' }}>
          {bodyLines.map((line, index) => (
            <p key={`${view.id}:qintian-line:${index}`}>{line}</p>
          ))}
        </div>
      </div>
    </article>
  );
}
