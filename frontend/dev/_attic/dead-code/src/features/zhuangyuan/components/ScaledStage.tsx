"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

const CANVAS_W = 1672;
const CANVAS_H = 941;

/**
 * 固定 1672×941 设计画布，等比缩放填满容器（cover 模式）。
 * 取宽高缩放比中较大者，确保画布始终覆盖整个容器。
 * 内部组件用原图 px 坐标。
 */
export default function ScaledStage({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w > 0 && h > 0) setScale(Math.max(w / CANVAS_W, h / CANVAS_H));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: CANVAS_W,
          height: CANVAS_H,
          transformOrigin: "top left",
          transform: `scale(${scale})`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
