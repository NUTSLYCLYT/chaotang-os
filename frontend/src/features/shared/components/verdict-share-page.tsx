'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Copy, Download, ExternalLink, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  copyVerdictCardToClipboard,
  downloadVerdictCard,
  renderVerdictCard,
  type VerdictCardData,
} from '@/features/scribe/lib/verdict-card';

export function VerdictSharePage({ data }: { data: VerdictCardData }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [rendering, setRendering] = useState(true);
  const [copyingLink, setCopyingLink] = useState(false);

  useEffect(() => {
    let active = true;

    async function generate() {
      setRendering(true);
      try {
        const nextUrl = await renderVerdictCard(data);
        if (active) setDataUrl(nextUrl);
      } catch (error) {
        toast.error('公开朱批卡生成失败', {
          description: error instanceof Error ? error.message : '未知错误',
        });
      } finally {
        if (active) setRendering(false);
      }
    }

    void generate();
    return () => {
      active = false;
    };
  }, [data]);

  const shareText = useMemo(
    () =>
      encodeURIComponent(
        `今日陛下朱批 · ${data.highlights[0] ?? '朝堂今日决断'}\n— 朝堂 OS · AI 决策驾驶舱`,
      ),
    [data.highlights],
  );

  const handleCopyImage = async () => {
    if (!dataUrl) return;
    const ok = await copyVerdictCardToClipboard(dataUrl);
    if (!ok) {
      toast.error('浏览器不支持复制图片', {
        description: '请改用下载 PNG',
      });
      return;
    }

    toast.success('已复制朱批卡图片', {
      description: '可直接粘贴到微信、飞书或 Slack',
    });
  };

  const handleCopyLink = async () => {
    if (typeof window === 'undefined') return;
    setCopyingLink(true);
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('已复制公开链接', {
        description: '外部打开后可直接查看这张朱批卡',
      });
    } catch {
      toast.error('复制链接失败', {
        description: '请手动复制浏览器地址栏',
      });
    } finally {
      setCopyingLink(false);
    }
  };

  const handleDownload = () => {
    if (!dataUrl) return;
    downloadVerdictCard(dataUrl, `朝堂-公开朱批-${new Date().toISOString().slice(0, 10)}.png`);
  };

  const handleShareX = () => {
    if (typeof window === 'undefined') return;
    const url = encodeURIComponent(window.location.href);
    window.open(`https://twitter.com/intent/tweet?text=${shareText}&url=${url}`, '_blank');
  };

  return (
    <main className="min-h-screen bg-[#04060E] text-[#EAEEFB]">
      <div
        className="border-b px-6 py-4"
        style={{ borderColor: 'rgba(240,198,106,0.12)', background: 'rgba(10,16,32,0.95)' }}
      >
        <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.25em] text-[#8F835F]">
              朝堂 OS · 公开朱批卡
            </div>
            <h1
              className="mt-2 text-[26px] font-semibold tracking-[0.08em] text-[#F5E9C9]"
              style={{ fontFamily: '"Noto Serif SC", serif' }}
            >
              陛下今日朱批
            </h1>
          </div>
          <Link
            href="/throne"
            className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-[12px] font-semibold tracking-[0.06em] text-[#EAEEFB] transition hover:border-white/30 hover:bg-white/10"
          >
            返回朝堂
            <ExternalLink size={12} />
          </Link>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1180px] gap-8 px-6 py-10 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-[28px] border border-[#F0C66A]/15 bg-[rgba(10,7,4,0.7)] p-4 shadow-[0_30px_80px_rgba(0,0,0,0.5)]">
          <div
            className="relative overflow-hidden rounded-[22px] border"
            style={{
              borderColor: 'rgba(240,198,106,0.24)',
              background:
                'linear-gradient(135deg, rgba(28,22,10,0.98) 0%, rgba(10,7,4,0.98) 60%, rgba(7,5,15,0.98) 100%)',
              aspectRatio: '1',
            }}
          >
            {rendering && (
              <div className="absolute inset-0 flex items-center justify-center text-[13px] text-[#F0C66A]">
                <span className="animate-pulse">公开朱批卡渲染中 ...</span>
              </div>
            )}
            {dataUrl ? (
              <img src={dataUrl} alt="朝堂 OS 公开朱批卡" className="h-full w-full object-contain" />
            ) : null}
          </div>
        </section>

        <aside className="space-y-5">
          <section className="rounded-3xl border border-[#F0C66A]/15 bg-white/[0.03] p-5">
            <div className="text-[11px] uppercase tracking-[0.24em] text-[#8F835F]">决断摘要</div>
            <ul className="mt-4 space-y-3 text-[14px] leading-7 text-[#EAEEFB]">
              {data.highlights.map((item, index) => (
                <li key={`${item}-${index}`} className="rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3">
                  <span className="mr-2 text-[#F0C66A]">0{index + 1}</span>
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-4 rounded-2xl border border-[#F0C66A]/15 bg-[#F0C66A]/[0.06] px-4 py-3 text-[13px] leading-6 text-[#F5E9C9]">
              {data.primeMinisterVerdict}
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <div className="text-[11px] uppercase tracking-[0.24em] text-[#8F835F]">分享动作</div>
            <div className="mt-4 grid gap-3">
              <button
                type="button"
                onClick={handleCopyLink}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#F0C66A]/30 bg-[#F0C66A]/10 px-4 py-3 text-[13px] font-semibold text-[#F0C66A] transition hover:bg-[#F0C66A]/18"
              >
                <Share2 size={14} />
                {copyingLink ? '复制中 ...' : '复制公开链接'}
              </button>
              <button
                type="button"
                onClick={handleCopyImage}
                disabled={!dataUrl}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-[13px] font-semibold text-[#EAEEFB] transition hover:bg-white/[0.08] disabled:opacity-40"
              >
                <Copy size={14} />
                复制图片
              </button>
              <button
                type="button"
                onClick={handleDownload}
                disabled={!dataUrl}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-[13px] font-semibold text-[#EAEEFB] transition hover:bg-white/[0.08] disabled:opacity-40"
              >
                <Download size={14} />
                下载 PNG
              </button>
              <button
                type="button"
                onClick={handleShareX}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#1DA1F2]/30 bg-[#1DA1F2]/10 px-4 py-3 text-[13px] font-semibold text-[#6ACDF5] transition hover:bg-[#1DA1F2]/16"
              >
                <ExternalLink size={14} />
                分享到 X
              </button>
            </div>
            <p className="mt-4 text-[12px] leading-6 text-[#9AA3C4]">
              这是一张纯客户端生成的只读分享卡，不会上传原始画布；外部打开时会按链接中的数据重新渲染。
            </p>
          </section>
        </aside>
      </div>
    </main>
  );
}

