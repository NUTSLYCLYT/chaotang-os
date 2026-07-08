/**
 * 朝堂 OS · 朱笔批注 Canvas
 *
 * 帝王级的 UX：任何报告都可以按住 Alt / 或点"朱笔"按钮进入批注模式，
 * 鼠标即毛笔，朱红墨迹可自由勾画。
 *
 * 特性：
 *   - 透明 canvas 全屏覆盖（fixed）
 *   - 触发后录制笔迹 · 松开后批注持久化一段时间
 *   - 一键清空 / 导出 PNG / 关闭
 *   - 笔触有压感模拟（按住时间越长越粗）
 *
 * 使用：
 *   <VermilionAnnotator />  挂在 layout，自动监听 Alt 键触发
 */

'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from 'react';
import { Brush, Trash2, Download, X } from 'lucide-react';
import { toast } from 'sonner';

interface Stroke {
  points: Array<{ x: number; y: number; pressure: number }>;
  color: string;
  width: number;
}

export function VermilionAnnotator() {
  const [active, setActive] = useState(false);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef<Stroke | null>(null);
  const sizeRef = useRef({ w: 0, h: 0 });

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const allStrokes = drawingRef.current ? [...strokes, drawingRef.current] : strokes;
    for (const stroke of allStrokes) {
      if (stroke.points.length < 2) continue;
      ctx.strokeStyle = stroke.color;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 1; i < stroke.points.length; i++) {
        const p = stroke.points[i];
        const prev = stroke.points[i - 1];
        if (!p || !prev) continue;
        ctx.lineWidth = stroke.width * (0.6 + p.pressure * 0.9);
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
    }
  }, [strokes]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // 避免与输入框冲突：正在输入时忽略 Alt+B
      const tag = (e.target as HTMLElement | null)?.tagName;
      const inEditable =
        tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable;
      if (inEditable) return;

      if (e.altKey && e.code === 'KeyB' && !e.repeat) {
        e.preventDefault();
        setActive((v) => {
          // 关闭时若有未完成笔迹，丢弃避免残留
          if (v) drawingRef.current = null;
          return !v;
        });
      }
      if (e.key === 'Escape' && active) {
        drawingRef.current = null;
        setActive(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      sizeRef.current = { w: window.innerWidth, h: window.innerHeight };
      canvas.width = window.innerWidth * devicePixelRatio;
      canvas.height = window.innerHeight * devicePixelRatio;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      const ctx = canvas.getContext('2d');
      ctx?.scale(devicePixelRatio, devicePixelRatio);
      redraw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [active, redraw]);

  useEffect(() => {
    redraw();
  }, [strokes, redraw]);

  const onPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    drawingRef.current = {
      points: [
        {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
          pressure: e.pressure || 0.5,
        },
      ],
      color: '#C03030',
      width: 4,
    };
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    drawingRef.current.points.push({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      pressure: e.pressure || 0.5,
    });
    redraw();
  };

  const onPointerUp = () => {
    if (drawingRef.current && drawingRef.current.points.length > 1) {
      setStrokes((s) => [...s, drawingRef.current!]);
    }
    drawingRef.current = null;
  };

  const clearAll = () => {
    setStrokes([]);
    drawingRef.current = null;
    redraw();
  };

  const exportPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `朝堂-朱批-${Date.now()}.png`;
    a.click();
    toast.success('朱批已导出 · 入史馆保存');
  };

  const hint = useMemo(
    () => (strokes.length === 0 ? '按住鼠标 · 自由落笔。Esc 退出批注。' : null),
    [strokes.length],
  );

  if (!active) {
    return (
      <button
        type="button"
        onClick={() => setActive(true)}
        title="朱笔批注 · Alt+B"
        className="fixed bottom-5 right-5 z-[90] hidden h-9 w-9 items-center justify-center rounded-full border shadow-lg opacity-45 transition-all hover:scale-105 hover:opacity-100 md:flex"
        style={{
          borderColor: '#C03030',
          background: 'rgba(192,48,48,0.15)',
          boxShadow: '0 6px 20px rgba(192,48,48,0.3)',
        }}
      >
        <Brush size={16} className="text-[#F43F5E]" />
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[100]">
      {/* 朱笔提示 */}
      {hint && (
        <div
          className="pointer-events-none absolute left-1/2 top-8 -translate-x-1/2 rounded-md border px-4 py-2 text-[12px] tracking-[0.1em]"
          style={{
            borderColor: 'rgba(192,48,48,0.45)',
            background: 'rgba(10,7,4,0.85)',
            color: '#F5E9C9',
            backdropFilter: 'blur(8px)',
          }}
        >
          <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-[#C03030]" />
          朱笔批注模式 · {hint}
        </div>
      )}

      {/* 工具条 */}
      <div
        className="absolute right-6 top-6 flex items-center gap-2 rounded-full border px-2 py-1.5"
        style={{
          borderColor: 'rgba(192,48,48,0.35)',
          background: 'rgba(10,7,4,0.75)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <button
          type="button"
          onClick={clearAll}
          disabled={strokes.length === 0}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-[#9AA3C4] transition hover:bg-white/5 hover:text-[#F5E9C9] disabled:opacity-40"
          title="清空笔迹"
        >
          <Trash2 size={12} />
          清空
        </button>
        <button
          type="button"
          onClick={exportPng}
          disabled={strokes.length === 0}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-[#F0C66A] transition hover:bg-[#F0C66A]/10 disabled:opacity-40"
          title="导出朱批 PNG"
        >
          <Download size={12} />
          导出
        </button>
        <button
          type="button"
          onClick={() => setActive(false)}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-[#F43F5E] transition hover:bg-[#F43F5E]/10"
          title="退出批注模式"
        >
          <X size={12} />
          收朱笔
        </button>
      </div>

      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="h-full w-full cursor-crosshair"
        style={{ touchAction: 'none' }}
      />
    </div>
  );
}
