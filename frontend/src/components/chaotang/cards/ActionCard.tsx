import { ImperialButton } from '../buttons/ImperialButton';
import type { ActionItem } from '../data/mockDadianData';

export function ActionCard({ action }: { action: ActionItem }) {
  const Icon = action.icon;

  return (
    <article className="flex min-h-[118px] flex-col justify-between rounded-[8px] border border-[#F0C66A]/18 bg-[#06111f]/54 p-4 transition duration-200 hover:-translate-y-1 hover:border-[#F0C66A]/40 hover:bg-[#06111f]/72">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[7px] border border-[#F0C66A]/26 bg-[#F0C66A]/8 text-[#F0C66A]">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h3 className="text-[14px] font-semibold text-[#F0C66A]">{action.title}</h3>
          <p className="mt-1 text-[12px] leading-5 text-[#F3EDDF]/70">{action.body}</p>
        </div>
      </div>
      <ImperialButton href={action.href} variant={action.primary ? 'primary' : 'ghost'} className="mt-4 w-full">
        进入
      </ImperialButton>
    </article>
  );
}
