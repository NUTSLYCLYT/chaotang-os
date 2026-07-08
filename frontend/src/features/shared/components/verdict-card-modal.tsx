/**
 * 朝堂 OS · 朱批卡分享 Modal
 *
 * 触发方式：
 *   window.dispatchEvent(new CustomEvent('court:verdict-card', { detail: { highlights, primeMinisterVerdict, verdict } }))
 *
 * 展示：
 *   - 1080×1080 预览卡（Canvas 渲染）
 *   - 下载 PNG / 复制到剪贴板 / 复制公开分享链接
 *   - 完全客户端，无上传；分享页通过 URL payload 公开渲染
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { X, Download, Copy, Share2, Check } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { toast } from 'sonner';
import {
  renderVerdictCard,
  downloadVerdictCard,
  copyVerdictCardToClipboard,
  type VerdictCardData,
} from '@/features/scribe/lib/verdict-card';
import { buildVerdictShareHref } from '@/features/shared/lib/verdict-share';

declare global {
  interface WindowEventMap {
    'court:verdict-card': CustomEvent<VerdictCardData>;
  }
}

export function useVerdictCardTrigger() {
  return useCallback((data: VerdictCardData) => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('court:verdict-card', { detail: data }));
  }, []);
}

export function VerdictCardModal() {
  const [data, setData] = useState<VerdictCardData | null>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    const handler = async (evt: Event) => {
      const e = evt as CustomEvent<VerdictCardData>;
      setData(e.detail);
      setRendering(true);
      try {
        const url = await renderVerdictCard(e.detail);
        setDataUrl(url);
      } catch (err) {
        toast.error('朱批卡生成失败', {
          description: err instanceof Error ? err.message : '未知错误',
        });
      } finally {
        setRendering(false);
      }
    };
    window.addEventListener('court:verdict-card', handler);
    return () => window.removeEventListener('court:verdict-card', handler);
  }, []);

  const close = () => {
    setData(null);
    setDataUrl(null);
    setCopied(false);
    setCopiedLink(false);
  };

  const handleDownload = () => {
    if (!dataUrl) return;
    downloadVerdictCard(dataUrl, `朝堂-朱批-${new Date().toISOString().slice(0, 10)}.png`);
    toast.success('朱批卡已下载', {
      description: '快分享给群臣，让人知道陛下今日决断',
      icon: '🏯',
    });
  };

  const handleCopy = async () => {
    if (!dataUrl) return;
    const ok = await copyVerdictCardToClipboard(dataUrl);
    if (ok) {
      setCopied(true);
      toast.success('已复制到剪贴板', {
        description: '可直接粘贴到微信 / 飞书 / Slack / Twitter',
      });
      setTimeout(() => setCopied(false), 2400);
    } else {
      toast.error('浏览器不支持剪贴板图片复制', {
        description: '请用"下载"按钮',
      });
    }
  };

  const handleTweet = () => {
    if (!data || typeof window === 'undefined') return;
    const text = encodeURIComponent(
      `今日陛下朱批 · ${data?.highlights?.[0] ?? ''}\n— 朝堂 OS · AI 决策驾驶舱`,
    );
    const shareUrl = encodeURIComponent(
      new URL(buildVerdictShareHref(data), window.location.origin).toString(),
    );
    window.open(
      `https://twitter.com/intent/tweet?text=${text}&url=${shareUrl}`,
      '_blank',
    );
  };

  const handleCopyLink = async () => {
    if (!data || typeof window === 'undefined') return;

    try {
      const shareUrl = new URL(buildVerdictShareHref(data), window.location.origin).toString();
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      toast.success('已复制公开链接', {
        description: '外部打开后可直接查看这张朱批卡',
      });
      setTimeout(() => setCopiedLink(false), 2400);
    } catch {
      toast.error('复制链接失败', {
        description: '请手动复制浏览器地址栏',
      });
    }
  };

  return (
    <AnimatePresence>
      {data && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[180] flex items-center justify-center bg-black/80 backdrop-blur-md"
          onClick={close}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', stiffness: 280, damping: 26 }}
            className="relative flex max-h-[92vh] w-full max-w-[640px] flex-col overflow-hidden rounded-2xl border-2"
            style={{
              borderColor: 'rgba(240,198,106,0.55)',
              background:
                'linear-gradient(135deg, rgba(28,22,10,0.98) 0%, rgba(10,7,4,0.98) 60%, rgba(7,5,15,0.98) 100%)',
              boxShadow: '0 30px 80px rgba(0,0,0,0.8)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close */}
            <button
              type="button"
              onClick={close}
              className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/5 text-[#9AA3C4] transition hover:border-white/30 hover:bg-white/10 hover:text-white"
            >
              <X size={14} />
            </button>

            {/* Header */}
            <div className="px-6 pt-6 pb-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#F0C66A]">
                朱批卡 · Verdict Card
              </div>
              <div
                className="mt-2 text-[22px] font-bold tracking-[0.08em]"
                style={{ color: '#F5E9C9', fontFamily: '"Noto Serif SC", serif' }}
              >
                陛下今日朱批 · 请分享
              </div>
              <p className="mt-1 text-[12px] leading-6 text-[#9AA3C4]">
                这是你今日决断的印记 · 一键下载或复制 · 朝堂美学水印 · 让群臣看到你的判断
              </p>
            </div>

            {/* Preview */}
            <div className="flex-1 overflow-auto px-6">
              <div
                className="relative overflow-hidden rounded-xl border"
                style={{
                  borderColor: 'rgba(240,198,106,0.3)',
                  aspectRatio: '1',
                  background: '#0a0704',
                }}
              >
                {rendering && (
                  <div className="absolute inset-0 flex items-center justify-center text-[13px] text-[#F0C66A]">
                    <span className="animate-pulse">朱批卡渲染中 ...</span>
                  </div>
                )}
                {dataUrl && (
                  <img
                    src={dataUrl}
                    alt="朝堂 OS 朱批卡"
                    className="h-full w-full object-contain"
                  />
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 px-6 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={!dataUrl}
                  className="flex items-center gap-1.5 rounded-md border border-[#F0C66A]/50 bg-[#F0C66A]/15 px-3.5 py-1.5 text-[12px] font-semibold tracking-[0.06em] text-[#F0C66A] transition hover:bg-[#F0C66A]/25 disabled:opacity-40"
                >
                  <Download size={12} />
                  下载 PNG
                </button>
                <button
                  type="button"
                  onClick={handleCopy}
                  disabled={!dataUrl}
                  className="flex items-center gap-1.5 rounded-md border border-white/20 bg-white/5 px-3.5 py-1.5 text-[12px] font-semibold tracking-[0.06em] text-[#EAEEFB] transition hover:border-white/35 hover:bg-white/10 disabled:opacity-40"
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? '已复制' : '复制图片'}
                </button>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  disabled={!data}
                  className="flex items-center gap-1.5 rounded-md border border-[#F0C66A]/35 bg-[#F0C66A]/10 px-3.5 py-1.5 text-[12px] font-semibold tracking-[0.06em] text-[#F0C66A] transition hover:bg-[#F0C66A]/18 disabled:opacity-40"
                >
                  <Share2 size={12} />
                  {copiedLink ? '已复制链接' : '复制链接'}
                </button>
                <button
                  type="button"
                  onClick={handleTweet}
                  disabled={!dataUrl}
                  className="flex items-center gap-1.5 rounded-md border border-[#1DA1F2]/40 bg-[#1DA1F2]/10 px-3.5 py-1.5 text-[12px] font-semibold tracking-[0.06em] text-[#6ACDF5] transition hover:bg-[#1DA1F2]/18 disabled:opacity-40"
                >
                  <Share2 size={12} />
                  分享 X
                </button>
              </div>
              <div className="text-[11px] tracking-[0.24em] text-[#6A7299]">
                1080×1080 · PNG · 无水印上传
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
