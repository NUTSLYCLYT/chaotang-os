import type { ReactNode } from 'react';

export function ShiguanThreeColumnLayout({
  left,
  center,
  right,
}: {
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
}) {
  return (
    <section className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[320px_minmax(520px,1fr)_360px]">
      <aside className="min-h-0">{left}</aside>
      <section className="min-h-0">{center}</section>
      <aside className="min-h-0">{right}</aside>
    </section>
  );
}
