export default function QuickActionButton({
  label,
  onClick,
}: {
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-[3px] border border-gold-400/20 bg-ink-800/50 px-2 py-2 text-micro text-parchment-100/85 transition duration-200 hover:border-gold-400/55 hover:bg-ink-700/60 hover:text-gold-100"
    >
      {label}
    </button>
  );
}
