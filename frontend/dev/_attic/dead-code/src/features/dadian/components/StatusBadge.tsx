type Kind = "running" | "executing" | "pending";

const MAP: Record<Kind, { dot: string; text: string; label: string }> = {
  running: { dot: "bg-jade-400", text: "text-jade-400", label: "运行中" },
  executing: { dot: "bg-royal-400", text: "text-royal-300", label: "执行中" },
  pending: { dot: "bg-ember-400", text: "text-ember-400", label: "待审" },
};

export default function StatusBadge({
  kind,
  label,
  className = "",
}: {
  kind: Kind;
  label?: string;
  className?: string;
}) {
  const t = MAP[kind];
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-micro ${t.text} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${t.dot} animate-pulse-soft`} />
      {label ?? t.label}
    </span>
  );
}
