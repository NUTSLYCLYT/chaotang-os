export function GoldDivider({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`h-px bg-gradient-to-r from-transparent via-[#F0C66A]/56 to-transparent ${className}`.trim()}
    />
  );
}
