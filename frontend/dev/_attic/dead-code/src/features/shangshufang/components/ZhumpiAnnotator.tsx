'use client';

/**
 * ZhumpiAnnotator · 朱批选文工具条
 * 用户选中文字后弹出朱红工具条，点击即把选区文字作为指令传出。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface ToolbarPos {
  x: number;
  y: number;
}

interface ZhumpiAnnotatorProps {
  children: React.ReactNode;
  onAnnotate: (text: string) => void;
}

export function ZhumpiAnnotator({ children, onAnnotate }: ZhumpiAnnotatorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLButtonElement>(null);
  const [toolbarPos, setToolbarPos] = useState<ToolbarPos | null>(null);
  const selectedTextRef = useRef<string>('');

  const hide = useCallback(() => {
    setToolbarPos(null);
    selectedTextRef.current = '';
  }, []);

  const handleMouseUp = useCallback((e: MouseEvent) => {
    // 如果点的是工具条本身，不处理（由 toolbar 的 mousedown 拦截）
    if (toolbarRef.current?.contains(e.target as Node)) return;

    const sel = window.getSelection();
    const text = sel?.toString().trim() ?? '';

    if (text.length <= 3) {
      hide();
      return;
    }

    const range = sel!.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    selectedTextRef.current = text;
    setToolbarPos({
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
    });
  }, [hide]);

  const handleDocMouseDown = useCallback((e: MouseEvent) => {
    // 工具条内部的 mousedown 不隐藏（让 click 有机会触发）
    if (toolbarRef.current?.contains(e.target as Node)) return;
    hide();
  }, [hide]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousedown', handleDocMouseDown);
    return () => {
      el.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousedown', handleDocMouseDown);
    };
  }, [handleMouseUp, handleDocMouseDown]);

  const handleAnnotateClick = useCallback(() => {
    const text = selectedTextRef.current;
    if (!text) return;
    window.getSelection()?.removeAllRanges();
    hide();
    onAnnotate(text);
  }, [onAnnotate, hide]);

  return (
    <>
      <div ref={containerRef}>{children}</div>
      {toolbarPos &&
        createPortal(
          <button
            ref={toolbarRef}
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={handleAnnotateClick}
            style={{
              position: 'fixed',
              left: toolbarPos.x,
              top: toolbarPos.y,
              transform: 'translate(-50%, -100%)',
              background: 'rgba(192,57,43,0.95)',
              color: '#fff',
              borderRadius: 8,
              padding: '6px 12px',
              fontSize: 12,
              fontFamily: 'var(--font-serif), serif',
              letterSpacing: '0.06em',
              border: '1px solid rgba(255,180,160,0.35)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.45), 0 0 0 1px rgba(192,57,43,0.6)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              zIndex: 9999,
              pointerEvents: 'auto',
            }}
          >
            🖌️ 朱批 · 派遣蜂群
          </button>,
          document.body,
        )}
    </>
  );
}
