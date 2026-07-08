import GlassPanel from "./GlassPanel";
import { knowledgeCategories, graphNodes } from "@/features/shiguan-ui/lib/shiguan-data";

export default function KnowledgeGraph({ id }: { id?: string }) {
  const center = graphNodes[0];

  return (
    <GlassPanel id={id} title="知识库结构" action={<span className="text-base">›</span>}>
      <div className="flex gap-3">
        {/* 分类列表 */}
        <ul className="flex-1 space-y-1.5">
          {knowledgeCategories.map((c) => (
            <li key={c.label} className="flex items-center gap-2">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: c.color, boxShadow: `0 0 6px ${c.color}66` }}
              />
              <span className="flex-1 truncate text-[12px] text-jade-100/85">
                {c.label}
              </span>
              <span className="shrink-0 text-[11.5px] tabular-nums text-slatey-400">
                {c.value}
              </span>
            </li>
          ))}
        </ul>

        {/* 知识图谱 */}
        <div className="w-[140px] shrink-0">
          <svg viewBox="0 0 200 160" className="h-full w-full">
            {graphNodes.slice(1).map((n) => (
              <line
                key={`l-${n.label}`}
                x1={center.cx}
                y1={center.cy}
                x2={n.cx}
                y2={n.cy}
                stroke="rgba(220,180,86,0.28)"
                strokeWidth="1"
              />
            ))}
            {graphNodes.map((n) => (
              <g key={n.label}>
                <circle
                  cx={n.cx}
                  cy={n.cy}
                  r={n.r}
                  fill={`${n.color}22`}
                  stroke={n.color}
                  strokeWidth="1.2"
                />
                <text
                  x={n.cx}
                  y={n.cy + 3}
                  textAnchor="middle"
                  fontSize="8"
                  fill="#eef3fb"
                  fontFamily="var(--font-serif)"
                >
                  {n.label}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </div>
    </GlassPanel>
  );
}
