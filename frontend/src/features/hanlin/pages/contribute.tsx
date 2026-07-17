'use client';

import { useState } from 'react';
import Link from 'next/link';
import { PageBrief } from '@/features/shared/components/page-brief';
import { GlassPanel } from '@/components/ui/glass-panel';
import { HanlinRoleBadge } from '@/features/hanlin/components/hanlin-role-badge';
import { hanlinRoleHeaders, hasHanlinCapability, readHanlinRole } from '@/features/hanlin/lib/access';
import { fetchHanlin } from '@/features/hanlin/lib/api';
import type { Contribution } from '@/features/hanlin/types';

type SubmitState =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'success'; contribution: Contribution }
  | { status: 'error'; message: string };

export function HanlinContributePage() {
  const role = readHanlinRole();
  const canContribute = hasHanlinCapability(role, 'contribute');
  const [title, setTitle] = useState('');
  const [type, setType] = useState('workflow');
  const [summary, setSummary] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [applicationHint, setApplicationHint] = useState('');
  const [originalityClaim, setOriginalityClaim] = useState<'original' | 'improved' | 'mixed'>('original');
  const [submitState, setSubmitState] = useState<SubmitState>({ status: 'idle' });

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitState({ status: 'submitting' });
    try {
      const response = await fetchHanlin('/api/hanlin/contributions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...hanlinRoleHeaders(role) },
        body: JSON.stringify({
          title,
          type,
          summary,
          authorName,
          sourceUrl,
          applicationHint,
          originalityClaim,
        }),
      });
      if (!response.ok) {
        throw new Error('投稿失败');
      }
      const payload = (await response.json()) as { contribution: Contribution };
      setSubmitState({ status: 'success', contribution: payload.contribution });
      setTitle('');
      setType('workflow');
      setSummary('');
      setAuthorName('');
      setSourceUrl('');
      setApplicationHint('');
      setOriginalityClaim('original');
    } catch (error) {
      setSubmitState({
        status: 'error',
        message: error instanceof Error ? error.message : '投稿失败',
      });
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1400px] space-y-5 p-6">
        <PageBrief
          eyebrow="Contribution Vault · 贡献上传"
          title="先把好东西交进来，再让 AI 和人工一起判断它值不值得进榜。"
          hook="翰林院不奖励热闹，而奖励真实价值。"
          brief="这里先支持内部 MVP 投稿。先结构化收集贡献，再进入 AI 评估、推荐池与应用池，不在投稿页直接拍板发奖。"
          primaryAction={{ label: '返回开榜司', href: '/hanlin/rankings' }}
          secondaryAction={{ label: '返回翰林院', href: '/hanlin', tone: 'secondary' }}
        />

        <HanlinRoleBadge
          role={role}
          note={canContribute ? '当前席位可向贡献金库投稿。' : '当前席位无投稿权限。'}
        />

        <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <GlassPanel tone="elevated" padding="lg">
            <form className="space-y-4" onSubmit={onSubmit}>
              <Field label="贡献标题">
                <input value={title} onChange={(e) => setTitle(e.target.value)} required className={inputClass} />
              </Field>
              <Field label="贡献类型">
                <select value={type} onChange={(e) => setType(e.target.value)} className={inputClass}>
                  <option value="workflow">工作流</option>
                  <option value="template">模板</option>
                  <option value="integration">集成</option>
                  <option value="component">组件</option>
                  <option value="research">研究</option>
                </select>
              </Field>
              <Field label="作者 / 提交人">
                <input value={authorName} onChange={(e) => setAuthorName(e.target.value)} required className={inputClass} />
              </Field>
              <Field label="摘要">
                <textarea value={summary} onChange={(e) => setSummary(e.target.value)} required rows={5} className={inputClass} />
              </Field>
              <Field label="来源链接">
                <input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} className={inputClass} placeholder="可留空" />
              </Field>
              <Field label="建议应用位置">
                <input value={applicationHint} onChange={(e) => setApplicationHint(e.target.value)} required className={inputClass} />
              </Field>
              <Field label="原创声明">
                <select
                  value={originalityClaim}
                  onChange={(e) => setOriginalityClaim(e.target.value as 'original' | 'improved' | 'mixed')}
                  className={inputClass}
                >
                  <option value="original">原创</option>
                  <option value="improved">改进型</option>
                  <option value="mixed">混合型</option>
                </select>
              </Field>
              <button
                type="submit"
                disabled={submitState.status === 'submitting' || !canContribute}
                className="inline-flex items-center rounded-full border border-[#F0C66A]/24 bg-[#F0C66A]/12 px-4 py-2 text-[12px] font-semibold text-[#F0C66A] transition hover:bg-[#F0C66A]/18 disabled:opacity-60"
              >
                {!canContribute ? '当前席位无投稿权限' : submitState.status === 'submitting' ? '投稿中...' : '提交到贡献金库'}
              </button>
            </form>
          </GlassPanel>

          <GlassPanel tone="elevated" padding="lg">
            <div className="section-eyebrow">投稿说明</div>
            <h2 className="section-title text-[20px]">当前 MVP 只做三件事</h2>
            <ul className="mt-4 space-y-3 text-[12px] leading-6 text-[#BFC7DA]">
              <li>1. 结构化收集贡献，不靠聊天记录找价值。</li>
              <li>2. 先给出 AI 价值评估建议，再进入推荐池。</li>
              <li>3. 不承诺股权，不在投稿阶段直接发钱。</li>
            </ul>
            {submitState.status === 'success' ? (
              <div className="mt-5 rounded-2xl border border-[#7AD3A1]/20 bg-[#7AD3A1]/10 px-4 py-4 text-[12px] leading-6 text-[#DFF8E8]">
                投稿已进入贡献金库：<span className="font-semibold">{submitState.contribution.title}</span>
                <div className="mt-3 flex flex-wrap gap-3">
                  <Link href="/hanlin/recommendations" className="text-[#EAFBF0] underline decoration-[#7AD3A1]/40 underline-offset-4">
                    去推荐池看下一步
                  </Link>
                  <Link href="/hanlin/rankings" className="text-[#EAFBF0] underline decoration-[#7AD3A1]/40 underline-offset-4">
                    回开榜司看榜单
                  </Link>
                </div>
              </div>
            ) : null}
            {submitState.status === 'error' ? (
              <div className="mt-5 rounded-2xl border border-[#F0C66A]/20 bg-[#F0C66A]/10 px-4 py-4 text-[12px] leading-6 text-[#F6DFA2]">
                {submitState.message}
              </div>
            ) : null}
          </GlassPanel>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-2 text-[11px] uppercase tracking-[0.16em] text-[#8F835F]">{label}</div>
      {children}
    </label>
  );
}

const inputClass =
  'w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-[13px] text-[#F5E9C9] outline-none transition focus:border-[#F0C66A]/30';
